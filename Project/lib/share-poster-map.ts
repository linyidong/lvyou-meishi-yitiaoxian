import { POSTER_MAP_H, POSTER_MAP_W } from '@/lib/route-poster';
import { requestStaticMap } from '@/lib/amap';
import { PLACE_TYPE } from '@/config/enums';
import type { RouteShareSnapshot } from '@/types';

/**
 * T-077 方案 A：免费分享海报的每天静态地图改为「服务端生成 + 进程内缓存」。
 * 根因：海报由客户端 renderRoutePoster 调 /api/amap/staticmap（要求登录），匿名 401 → 「地图暂不可用」占位框。
 * 本模块只在服务端（RSC）引用，**不得被客户端组件 import**：
 * 内部走高德 Web 服务 Key 池（lib/amap.requestStaticMap）并持有进程内缓存，
 * 下发给客户端的只有 PNG data URL，坐标/地址仍不下发。
 *
 * 缓存：key = `v6:${cacheKey}:${dayIndex}:${coordsHash}`，TTL 6 小时；
 * 同一 token 重复打开命中缓存，不再消耗高德额度。
 * v6 前缀：T-079 起按包围盒自适应 zoom + 地名标签（交替上下避让；T-078 编号/配色；无填充），旧「红点紫线」缓存内容作废。
 * 失败结果也缓存（value=null，同样 6h TTL）：否则每次匿名打开都会重试失败调用，
 * 反复消耗 Key 池并拖慢 RSC；额度恢复后最多 6h 即自动重试。
 * 单天失败 catch → null + console.warn，由海报端画占位框，绝不抛出阻断页面。
 */

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const cache = new Map<string, { expiresAt: number; value: string | null }>();

/** 坐标序列哈希（作为缓存 key 的一部分，坐标变化即失效） */
function coordsHash(points: { lng: number; lat: number }[]): string {
  return points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
}

/** T-078：与路线页/结果页同口径的按天线色（route 结果页 DAY_HEX） */
const DAY_HEX = ['#e11d48', '#0d9488', '#d97706', '#4f46e5', '#0284c7'];
/** T-078：marker 配色口径——景点青绿、美食橙（与路线页地图一致） */
const MARKER_ATTRACTION = '#14b8a6';
const MARKER_FOOD = '#f59e0b';

/**
 * T-079：按「点位包围盒 + 输出图片尺寸」算能放下的最大 zoom（10–16，四周留 18% 边距）。
 * 原来的 pickZoom 只看经纬跨度，宽图（984×552）会把小范围路线缩得过远，海报地图显得太空。
 */
function pickFitZoom(
  points: { lng: number; lat: number }[],
  width: number,
  height: number,
): number {
  if (points.length < 2) return 15;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const cos = Math.cos((centerLat * Math.PI) / 180);
  const widthM = (Math.max(...lngs) - Math.min(...lngs)) * 111320 * cos;
  const heightM = (Math.max(...lats) - Math.min(...lats)) * 110540;
  // 实测高德静态图在 984×552 下的可视范围比公式估计窄，留 42% 边距才能保证所有点入镜
  const pad = 0.42;
  for (let z = 16; z >= 10; z -= 1) {
    const metersPerPx = (156543.03392 * cos) / Math.pow(2, z);
    if (widthM <= width * pad * metersPerPx && heightM <= height * pad * metersPerPx) {
      return z;
    }
  }
  return 10;
}

/**
 * 按 snapshot 逐天生成静态地图 data URL；与 renderRoutePoster 的 dayPlans 下标一一对应。
 * 无有限坐标的天返回 null（海报画占位框，与旧行为一致）。
 * T-078：带编号（1..9，>9 留空）与景点/美食配色的 markers，线色按天取 DAY_HEX。
 */
export async function buildSharePosterMapImages(
  snapshot: RouteShareSnapshot,
  cacheKey: string,
): Promise<(string | null)[]> {
  const now = Date.now();
  return Promise.all(
    snapshot.dayPlans.map(async (day, i) => {
      const points = day.places
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        .map((p) => ({ lng: p.lng as number, lat: p.lat as number }));
      if (points.length === 0) return null;

      // markers 与路线页列表编号一致：按当天原始顺序 1 起（跳过无坐标点不改变其余编号）
      const markers = day.places
        .map((p, idx) => ({
          lng: p.lng as number,
          lat: p.lat as number,
          label: idx < 9 ? String(idx + 1) : '',
          color: p.type === PLACE_TYPE.FOOD ? MARKER_FOOD : MARKER_ATTRACTION,
          finite: Number.isFinite(p.lat) && Number.isFinite(p.lng),
        }))
        .filter((m) => m.finite)
        .map(({ lng, lat, label, color }) => ({ lng, lat, label, color }));

      const zoom = pickFitZoom(points, POSTER_MAP_W, POSTER_MAP_H);
      // T-079：地名标签（与路线页一致）；按当前 zoom 把标签抬到 marker 上方约 22px
      const labels = day.places
        .map((p, idx) => ({
          lng: p.lng as number,
          lat: p.lat as number,
          text: p.name,
          finite: Number.isFinite(p.lat) && Number.isFinite(p.lng),
          idx,
        }))
        .filter((m) => m.finite)
        .slice(0, 10)
        .map((m) => {
          const metersPerPx =
            (156543.03392 * Math.cos((m.lat * Math.PI) / 180)) / Math.pow(2, zoom);
          // 交替上/下放置，减少相邻点标签互相压盖（静态图 labels 无自动避让）
          const dir = m.idx % 2 === 0 ? 1 : -1;
          return {
            lng: m.lng,
            lat: m.lat + (dir * 26 * metersPerPx) / 111320,
            text: m.text,
          };
        });

      const key = `v6:${cacheKey}:${i}:${coordsHash(points)}`;
      const hit = cache.get(key);
      if (hit && hit.expiresAt > now) return hit.value;

      try {
        const buf = await requestStaticMap({
          points,
          width: POSTER_MAP_W,
          height: POSTER_MAP_H,
          zoom,
          markers,
          lineColor: DAY_HEX[i % DAY_HEX.length],
          labels,
        });
        const value = `data:image/png;base64,${Buffer.from(buf).toString('base64')}`;
        cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
        return value;
      } catch (err) {
        console.warn(`[share-poster-map] 第 ${i + 1} 天静态地图生成失败，降级占位：`, err);
        cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: null });
        return null;
      }
    }),
  );
}

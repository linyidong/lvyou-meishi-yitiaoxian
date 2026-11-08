import { POSTER_MAP_H, POSTER_MAP_W, pickZoom } from '@/lib/route-poster';
import { requestStaticMap } from '@/lib/amap';
import type { RouteShareSnapshot } from '@/types';

/**
 * T-077 方案 A：免费分享海报的每天静态地图改为「服务端生成 + 进程内缓存」。
 * 根因：海报由客户端 renderRoutePoster 调 /api/amap/staticmap（要求登录），匿名 401 → 「地图暂不可用」占位框。
 * 本模块只在服务端（RSC）引用，**不得被客户端组件 import**：
 * 内部走高德 Web 服务 Key 池（lib/amap.requestStaticMap）并持有进程内缓存，
 * 下发给客户端的只有 PNG data URL，坐标/地址仍不下发。
 *
 * 缓存：key = `${cacheKey}:${dayIndex}:${coordsHash}`，TTL 6 小时；
 * 同一 token 重复打开命中缓存，不再消耗高德额度。
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

/**
 * 按 snapshot 逐天生成静态地图 data URL；与 renderRoutePoster 的 dayPlans 下标一一对应。
 * 无有限坐标的天返回 null（海报画占位框，与旧行为一致）。
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

      const key = `${cacheKey}:${i}:${coordsHash(points)}`;
      const hit = cache.get(key);
      if (hit && hit.expiresAt > now) return hit.value;

      try {
        const buf = await requestStaticMap({
          points,
          width: POSTER_MAP_W,
          height: POSTER_MAP_H,
          zoom: pickZoom(points),
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

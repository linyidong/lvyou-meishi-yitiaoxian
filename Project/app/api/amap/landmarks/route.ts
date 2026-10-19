import { NextResponse, type NextRequest } from 'next/server';
import { BUSINESS } from '@/config/business';
import { MESSAGES } from '@/config/messages';
import { searchLandmarks } from '@/lib/amap';
import { isAmapQuotaCritical } from '@/lib/amap-usage';
import type { AmapPlaceResult } from '@/types';

/**
 * U09 路线周边的知名地点（商场 / 特色商业街 / 风景名胜，按高德评分取前 8）。
 * body: { points: { lat, lng }[]; excludeNames?: string[] }
 *
 * 高德「周边搜索」个人认证额度很小（100 次/日），因此：
 * 1. 每次只按路线范围查一次，结果按「中心点 + 半径」缓存在进程内存里，12 小时内不重复查；
 * 2. 只返回地图需要的少量字段，且只取评分靠前的几个，保持地图干净。
 */
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; items: AmapPlaceResult[] }>();

/** 半径上下限（米）：太小只剩眼前，太大就变成城市级推荐 */
const MIN_RADIUS = 1500;
const MAX_RADIUS = 4000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export async function POST(request: NextRequest) {
  let points: { lat: number; lng: number }[] = [];
  let excludeNames: string[] = [];

  try {
    const body = (await request.json()) as {
      points?: { lat?: unknown; lng?: unknown }[];
      excludeNames?: unknown;
    };
    points = (body.points ?? []).flatMap((p) => {
      const lat = Number(p?.lat);
      const lng = Number(p?.lng);
      return Number.isFinite(lat) && Number.isFinite(lng) ? [{ lat, lng }] : [];
    });
    excludeNames = Array.isArray(body.excludeNames)
      ? body.excludeNames.filter((n): n is string => typeof n === 'string')
      : [];
  } catch {
    return NextResponse.json({ ok: false, error: MESSAGES.NETWORK_ERROR }, { status: 400 });
  }

  if (points.length === 0 || points.length > BUSINESS.MAX_PLACES_PER_ROUTE) {
    return NextResponse.json({ ok: false, error: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  // 熔断降级：本月用量 ≥ 95% 配额时不再查周边 POI，直接返回空并标记「配额紧张」，前端据此提示用户
  if (await isAmapQuotaCritical()) {
    return NextResponse.json({ ok: true, items: [], quotaCritical: true });
  }

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const midLat = (minLat + maxLat) / 2;
  const midLng = (minLng + maxLng) / 2;
  const spanMeters = Math.max(
    (maxLat - minLat) * 110900,
    (maxLng - minLng) * 111320 * Math.cos((midLat * Math.PI) / 180),
  );
  const radius = Math.round(clamp(spanMeters / 2 + 800, MIN_RADIUS, MAX_RADIUS));

  // 中心点取到小数点后 3 位（约 100 米）再当缓存键，避免同一片区域反复查询
  const key = `${midLng.toFixed(3)},${midLat.toFixed(3)}#${radius}`;
  const hit = cache.get(key);
  let items: AmapPlaceResult[];
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    items = hit.items;
  } else {
    try {
      items = await searchLandmarks({ location: `${midLng},${midLat}`, radiusMeters: radius });
      cache.set(key, { at: Date.now(), items });
    } catch (err) {
      console.error('[api/amap/landmarks] 周边知名地点查询失败：', err);
      // 周边地点只是锦上添花，取不到不算错误，前端据此不画灰点即可
      return NextResponse.json({ ok: true, items: [] });
    }
  }

  // 路线自己的站点不重复画成灰点，因此过滤放在返回前，缓存里保留完整列表
  const excluded = new Set(excludeNames);
  return NextResponse.json({ ok: true, items: items.filter((it) => !excluded.has(it.name)) });
}

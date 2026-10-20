import { NextResponse, type NextRequest } from 'next/server';
import { BUSINESS } from '@/config/business';
import { NAV_MODE, NAV_MODE_VALUES, PLACE_TYPE } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import {
  cachedDistanceMatrix,
  planDayRoute,
  planLeg,
  resolveLodgingCoords,
  toAmapLocation,
  type AmapLeg,
} from '@/lib/amap';
import { checkGuestRateLimit, guestCookieOptions, GUEST_COOKIE, resolveGuestKey } from '@/lib/guest-rate-limit';
import { orderByMatrix } from '@/lib/route-order';
import type { NavMode, PlaceType } from '@/types';

/**
 * 游客试用 · 路线排序 + 分段（免登录）。
 * POST /api/try/order
 * body: {
 *   points: { lat: number; lng: number; name?: string; type?: PlaceType }[],
 *   mode: NavMode,
 *   cityAdcode?: string,
 *   manual?: boolean,
 *   lodging?: { name?: string | null; area?: string | null; city?: string | null }
 * }
 * resp: {
 *   ok: true, mode, startIndex, lodgingResolved, lodging,
 *   points: { name, type, isLodging, lat, lng }[],
 *   legs: AmapLeg[], distanceMeters, durationSeconds, estimated
 * }
 *
 * manual=true（游客在结果页手动调整顺序）：按传入顺序算分段，跳过距离矩阵重排，
 * 走 T01c 的宽松限流桶；false / 缺省：按最近邻 + 2-opt 重新排序，走 T01 的 3 次/日。
 *
 * 复用 lib/amap 的 cachedDistanceMatrix（落库缓存的真实路网距离矩阵）与 lib/route-order 的
 * 最近邻 + 2-opt 排序；分段走 planDayRoute，任何一段算不出来就退化为直线距离估算，绝不抛异常。
 * 全程不写库。接口带 IP 日限流（超限 429）。
 */

/** 算不出真实路线时的兜底速度（km/h），与 /api/amap/route 客户端估算口径一致 */
const MODE_ESTIMATE_SPEED: Record<NavMode, number> = {
  [NAV_MODE.WALK]: BUSINESS.WALK_SPEED_KMH,
  [NAV_MODE.BIKE]: BUSINESS.BIKE_SPEED_KMH,
  [NAV_MODE.TRANSIT]: BUSINESS.TRANSIT_SPEED_KMH,
  [NAV_MODE.DRIVE]: BUSINESS.DRIVE_SPEED_KMH,
};

/** 直线距离（米） */
function straightMeters(a: string, b: string): number {
  const [lng1, lat1] = a.split(',').map(Number);
  const [lng2, lat2] = b.split(',').map(Number);
  if (![lng1, lat1, lng2, lat2].every(Number.isFinite)) return 0;
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** 单段算不出来时按直线距离与方式速度估算，保证整条路线仍能显示 */
function estimateLeg(origin: string, destination: string, mode: NavMode): AmapLeg {
  const meters = straightMeters(origin, destination);
  const speed = MODE_ESTIMATE_SPEED[mode];
  return {
    distanceMeters: Math.round(meters * 1.3),
    durationSeconds: Math.round(((meters * 1.3) / 1000 / speed) * 3600),
  };
}

interface PointInput {
  lat?: unknown;
  lng?: unknown;
  name?: unknown;
  type?: unknown;
}

interface MetaPoint {
  name: string;
  type: PlaceType | null;
  isLodging: boolean;
  lat: number;
  lng: number;
}

export async function POST(request: NextRequest) {
  let body: {
    points?: unknown;
    mode?: unknown;
    cityAdcode?: unknown;
    manual?: unknown;
    lodging?: { name?: unknown; area?: unknown; city?: unknown };
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  // 手动调整顺序：按传入顺序算分段，不重排 → 走宽松的 reorder 桶，不占「生成路线」的 3 次额度
  const manual = body.manual === true;

  const { key, newGuestId } = resolveGuestKey(request);
  const rate = checkGuestRateLimit(key, manual ? 'reorder' : 'order');
  if (!rate.ok) {
    return NextResponse.json({ ok: false, message: MESSAGES.TRY.RESULT.rateLimited }, { status: 429 });
  }

  /** 统一出口：无代理头时给浏览器补发访客标识 cookie，保证限流按浏览器区分而不是全站共用 */
  const finish = (body_: unknown, status = 200) => {
    const response = NextResponse.json(body_, { status });
    if (newGuestId) response.cookies.set(GUEST_COOKIE, newGuestId, guestCookieOptions());
    return response;
  };

  const rawPoints = Array.isArray(body.points) ? (body.points as PointInput[]) : [];
  const mode: NavMode = NAV_MODE_VALUES.includes(body.mode as NavMode)
    ? (body.mode as NavMode)
    : NAV_MODE.WALK;
  const cityAdcode = typeof body.cityAdcode === 'string' && body.cityAdcode ? body.cityAdcode : null;

  if (rawPoints.length < BUSINESS.GUEST_TRY_MIN_PLACES || rawPoints.length > BUSINESS.GUEST_TRY_MAX_PLACES) {
    return finish({ ok: false, message: MESSAGES.INVALID_PARAMS }, 400);
  }

  const places: MetaPoint[] = [];
  for (const raw of rawPoints) {
    const lat = typeof raw?.lat === 'number' ? raw.lat : NaN;
    const lng = typeof raw?.lng === 'number' ? raw.lng : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return finish({ ok: false, message: MESSAGES.INVALID_PARAMS }, 400);
    }
    const name = typeof raw?.name === 'string' && raw.name.trim() ? raw.name.trim() : '地点';
    const type = raw?.type === PLACE_TYPE.FOOD ? PLACE_TYPE.FOOD : PLACE_TYPE.ATTRACTION;
    places.push({ name, type, isLodging: false, lat, lng });
  }

  try {
    // 1. 住宿解析（服务端做，走 searchPlaces 的落库缓存）：填了名称/区域 + 有城市才解析
    const lodgingInput = body.lodging;
    const lodgingName = typeof lodgingInput?.name === 'string' ? lodgingInput.name.trim() : '';
    const lodgingArea = typeof lodgingInput?.area === 'string' ? lodgingInput.area.trim() : '';
    const lodgingCity = typeof lodgingInput?.city === 'string' ? lodgingInput.city.trim() : '';

    let lodgingMeta: MetaPoint | null = null;
    if (lodgingCity && (lodgingName || lodgingArea)) {
      try {
        const coords = await resolveLodgingCoords({
          name: lodgingName || null,
          area: lodgingArea || null,
          city: lodgingCity,
        });
        if (coords) {
          lodgingMeta = {
            name: coords.name || lodgingName || lodgingArea,
            type: null,
            isLodging: true,
            lat: coords.lat,
            lng: coords.lng,
          };
        }
      } catch (err) {
        console.warn('[api/try/order] 住宿坐标解析失败，改为以第一个地点为起点：', err);
      }
    }

    // 2. 组装全部点：住宿（解析成功时）作起点，其余为挑选的地点（保持输入顺序）
    const allMeta: MetaPoint[] = lodgingMeta ? [lodgingMeta, ...places] : places;
    const allPoints = allMeta.map((p) => toAmapLocation(p.lng, p.lat));
    // 住宿解析成功 → 指定起点下标 0；否则让系统自选最短起点（等价于以最顺路的第一个地点起步）
    const startIndex = lodgingMeta ? 0 : -1;

    // 3. 按出行方式重排：manual（游客手动调顺序）与两点都保持原顺序，其余走距离矩阵
    let order = allPoints.map((_, i) => i);
    if (!manual && allPoints.length >= 3) {
      try {
        order = orderByMatrix(await cachedDistanceMatrix(allPoints, mode), startIndex);
      } catch (err) {
        console.warn('[api/try/order] 距离矩阵不可用，保持原顺序：', err);
      }
    }

    const orderedPoints = order.map((i) => allPoints[i]);
    const orderedMeta = order.map((i) => allMeta[i]);

    // 4. 分段：先试 planDayRoute；任一段失败则逐段重算，仍失败的那段用直线估算兜底
    let legs: AmapLeg[] = [];
    let estimated = false;
    try {
      legs = (await planDayRoute(orderedPoints, mode, cityAdcode)).legs;
    } catch (err) {
      console.warn('[api/try/order] planDayRoute 失败，逐段兜底：', err);
      estimated = true;
      legs = [];
      for (let i = 0; i < orderedPoints.length - 1; i += 1) {
        try {
          legs.push(
            await planLeg({
              origin: orderedPoints[i],
              destination: orderedPoints[i + 1],
              mode,
              cityAdcode,
            }),
          );
        } catch (legErr) {
          console.warn('[api/try/order] 单段算路失败，改用直线估算：', legErr);
          legs.push(estimateLeg(orderedPoints[i], orderedPoints[i + 1], mode));
        }
      }
    }

    return finish({
      ok: true,
      mode,
      startIndex,
      lodgingResolved: Boolean(lodgingMeta),
      lodging: lodgingMeta ? { name: lodgingMeta.name, lat: lodgingMeta.lat, lng: lodgingMeta.lng } : null,
      points: orderedMeta,
      legs,
      distanceMeters: legs.reduce((sum, leg) => sum + leg.distanceMeters, 0),
      durationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0),
      estimated,
    });
  } catch (err) {
    console.error('[api/try/order] 路线规划失败：', err);
    return finish({ ok: false, message: MESSAGES.TRY.RESULT.error }, 502);
  }
}

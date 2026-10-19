import { NextResponse, type NextRequest } from 'next/server';
import { BUSINESS } from '@/config/business';
import { NAV_MODE, NAV_MODE_VALUES } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { cachedDistanceMatrix, planLeg, type AmapLeg } from '@/lib/amap';
import { isAmapQuotaCritical } from '@/lib/amap-usage';
import { buildStraightMatrix, getQuotaProfile } from '@/lib/member-quota';
import { orderByMatrix } from '@/lib/route-order';
import { createClient } from '@/lib/supabase/server';
import type { NavMode } from '@/types';

/**
 * 一天多点路线规划（技术方案 v1.1 §4.5）：points 为 'lng,lat' 字符串数组。
 * U09 起支持四种出行方式（步行 / 骑行 / 公交地铁 / 驾车）：
 * 切换方式时先按该方式的两两距离矩阵重排顺序（最近邻 + 2-opt 去交叉），再按新顺序逐段算路。
 * body: { points: string[]; mode?: NavMode; cityAdcode?: string; reorder?: boolean; startIndex?: number }
 * resp: { ok: true, order: number[], legs: AmapLeg[], distanceMeters, durationSeconds, estimated }
 */

/** 算不出真实路线时的兜底速度（km/h），与客户端估算口径一致 */
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

/** 单段算不出来时按直线距离与方式速度估算，保证整天仍能显示 */
function estimateLeg(origin: string, destination: string, mode: NavMode): AmapLeg {
  const meters = straightMeters(origin, destination);
  const speed = MODE_ESTIMATE_SPEED[mode];
  return {
    distanceMeters: Math.round(meters * 1.3),
    durationSeconds: Math.round(((meters * 1.3) / 1000 / speed) * 3600),
  };
}

export async function POST(request: NextRequest) {
  let points: string[] = [];
  let mode: NavMode = NAV_MODE.WALK;
  let cityAdcode: string | null = null;
  let reorder = true;
  let startIndex = -1;

  try {
    const body = (await request.json()) as {
      points?: string[];
      mode?: string;
      cityAdcode?: string;
      reorder?: boolean;
      startIndex?: number;
    };
    points = (body.points ?? []).map((point) => String(point));
    mode = NAV_MODE_VALUES.includes(body.mode as NavMode) ? (body.mode as NavMode) : NAV_MODE.WALK;
    cityAdcode = typeof body.cityAdcode === 'string' && body.cityAdcode ? body.cityAdcode : null;
    reorder = body.reorder !== false;
    startIndex = Number.isInteger(body.startIndex) ? (body.startIndex as number) : -1;
  } catch {
    return NextResponse.json({ ok: false, error: MESSAGES.NETWORK_ERROR }, { status: 400 });
  }

  if (points.length < 2 || points.length > BUSINESS.MAX_PLACES_PER_DAY) {
    return NextResponse.json({ ok: false, error: MESSAGES.ROUTE_FAILED }, { status: 400 });
  }

  try {
    // 熔断降级：本月用量 ≥ 95% 配额时跳过距离矩阵（省下 N 次 matrix 调用），保持原顺序；
    // 逐段算路失败仍照旧用 estimateLeg 直线估算，页面不会白屏。
    const quotaCritical = await isAmapQuotaCritical();

    // 阶段 2 会员分层：会员 / 管理员用高德真实距离矩阵排序；免费 / 游客改用
    // cos 校正直线距离构成的「伪矩阵」（复用 orderByMatrix 的最近邻 + 2-opt，不消耗高德配额）。
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const tier = user ? (await getQuotaProfile(user.id)).tier : 'free';
    const useAmapMatrix = tier !== 'free';

    // 1. 按该方式重排顺序：最近邻打底 + 2-opt 去交叉（两个点没有可排的余地，跳过矩阵调用）
    let order = points.map((_, i) => i);
    if (reorder && points.length >= 3) {
      try {
        if (!useAmapMatrix) {
          order = orderByMatrix(buildStraightMatrix(points), startIndex);
        } else if (!quotaCritical) {
          order = orderByMatrix(await cachedDistanceMatrix(points, mode), startIndex);
        }
      } catch (err) {
        console.warn('[api/amap/route] 距离矩阵不可用，保持原顺序：', err);
      }
    }

    // 2. 按新顺序逐段算路；单段失败只影响这一段，用直线估算顶上
    const ordered = order.map((i) => points[i]);
    const legs: AmapLeg[] = [];
    let estimated = false;
    for (let i = 0; i < ordered.length - 1; i += 1) {
      try {
        legs.push(
          await planLeg({
            origin: ordered[i],
            destination: ordered[i + 1],
            mode,
            cityAdcode,
          }),
        );
      } catch (err) {
        console.warn('[api/amap/route] 单段算路失败，改用直线估算：', err);
        estimated = true;
        legs.push(estimateLeg(ordered[i], ordered[i + 1], mode));
      }
    }

    return NextResponse.json({
      ok: true,
      mode,
      order,
      legs,
      estimated,
      distanceMeters: legs.reduce((sum, leg) => sum + leg.distanceMeters, 0),
      durationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0),
    });
  } catch (err) {
    console.error('[api/amap/route] 路线规划失败：', err);
    return NextResponse.json({ ok: false, error: MESSAGES.ROUTE_FAILED }, { status: 502 });
  }
}

import { NextResponse, type NextRequest } from 'next/server';
import { NAV_MODE, NAV_MODE_VALUES } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { cachedDistanceMatrix } from '@/lib/amap';
import { buildStraightMatrix, getQuotaProfile } from '@/lib/member-quota';
import { orderByMatrix } from '@/lib/route-order';
import { createClient } from '@/lib/supabase/server';
import type { NavMode } from '@/types';

/**
 * U07 首次生成路线时的「只排序」接口（按真实路网距离排，不算路）。
 * 背景：原来的首次生成用直线距离排，中纬度城市经度方向被算长、顺序也不保证不绕路；
 * 这里复用高德距离矩阵，先最近邻打底，再 2-opt 去交叉。
 * 与 /api/amap/route 的分工：本接口只返回顺序（便宜，不消耗算路额度），
 * 算路仍由 U09 进页面 / 切换出行方式时走 /api/amap/route。
 *
 * body: { points: string[]; mode?: NavMode; startIndex?: number }
 *   startIndex >= 0 指定起点下标；< 0（默认）表示不指定，由服务端取全程最短的起点。
 * resp: { ok: true, order: number[] }；矩阵不可用时 ok: false，调用方退回直线排序。
 */
export async function POST(request: NextRequest) {
  let points: string[] = [];
  let mode: NavMode = NAV_MODE.WALK;
  let startIndex = -1;

  try {
    const body = (await request.json()) as {
      points?: string[];
      mode?: string;
      startIndex?: number;
    };
    points = (body.points ?? []).map((point) => String(point));
    mode = NAV_MODE_VALUES.includes(body.mode as NavMode) ? (body.mode as NavMode) : NAV_MODE.WALK;
    startIndex = Number.isInteger(body.startIndex) ? (body.startIndex as number) : -1;
  } catch {
    return NextResponse.json({ ok: false, error: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  if (points.length < 2) {
    return NextResponse.json({ ok: false, error: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  try {
    // 阶段 2 会员分层：会员 / 管理员按高德真实路网距离排；免费 / 游客改用
    // cos 校正直线距离的「伪矩阵」（复用 orderByMatrix，不消耗高德距离矩阵配额）。
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const tier = user ? (await getQuotaProfile(user.id)).tier : 'free';
    const matrix =
      tier === 'free'
        ? buildStraightMatrix(points)
        : await cachedDistanceMatrix(points, mode);
    return NextResponse.json({ ok: true, mode, order: orderByMatrix(matrix, startIndex) });
  } catch (err) {
    console.warn('[api/amap/order] 距离矩阵不可用：', err);
    return NextResponse.json({ ok: false, error: MESSAGES.ROUTE_FAILED }, { status: 502 });
  }
}

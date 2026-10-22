import { NextResponse, type NextRequest } from 'next/server';
import { BUSINESS } from '@/config/business';
import { QUOTA_ERROR } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { getQuotaProfile, limitsOf } from '@/lib/member-quota';
import { createClient } from '@/lib/supabase/server';

/**
 * U07 生成路线后写入点位顺序
 * PUT /api/routes/[id]/places
 * body: { items: { placeId, dayIndex, orderIndex }[] }
 *
 * 经数据库函数 replace_route_places（迁移 027）单事务原子替换：
 * delete + insert 同事务，插入失败整体回滚，原地点不被清空（修复并发审计 R1）。
 */

interface ItemInput {
  placeId?: unknown;
  dayIndex?: unknown;
  orderIndex?: unknown;
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: '请先登录' }, { status: 401 });
  }

  let body: { items?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  if (!Array.isArray(body.items)) {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }
  if (body.items.length > BUSINESS.MAX_PLACES_PER_ROUTE) {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  const items: { placeId: string; dayIndex: number; orderIndex: number }[] = [];
  for (const raw of body.items as ItemInput[]) {
    const placeId = typeof raw?.placeId === 'string' ? raw.placeId : '';
    if (!placeId || !isNonNegativeInt(raw?.dayIndex) || !isNonNegativeInt(raw?.orderIndex)) {
      return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
    }
    items.push({ placeId, dayIndex: raw.dayIndex, orderIndex: raw.orderIndex });
  }

  // 只能写本人的路线
  const { data: route } = await supabase
    .from('routes')
    .select('id,days')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!route) {
    return NextResponse.json({ ok: false, message: MESSAGES.ROUTE_NOT_FOUND }, { status: 404 });
  }

  // ==================== 阶段 2 会员分层：单日地点数上限（服务端强制） ====================
  // 管理员不限；会员单日 ≤ MEMBER_MAX_PLACES_PER_DAY，免费单日 ≤ FREE_MAX_PLACES_PER_DAY。
  // 同时校验 dayIndex 不超出该路线天数，避免免费用户拿单日路线塞入多天下标绕过多日限制。
  const { tier } = await getQuotaProfile(user.id);
  const limits = limitsOf(tier);
  const perDay = new Map<number, number>();
  for (const it of items) {
    if (it.dayIndex >= route.days) {
      return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
    }
    perDay.set(it.dayIndex, (perDay.get(it.dayIndex) ?? 0) + 1);
  }
  if (tier !== 'admin' && Array.from(perDay.values()).some((c) => c > limits.placesPerDay)) {
    const maxDay = Array.from(perDay.values()).reduce((a, b) => Math.max(a, b), 0);
    return NextResponse.json(
      {
        ok: false,
        code: QUOTA_ERROR.PLACES_PER_DAY_LIMIT,
        message: MESSAGES.ROUTE_DAY_PLACES_LIMIT(limits.placesPerDay),
        maxPerDay: maxDay,
      },
      { status: 403 },
    );
  }

  const placeIds = Array.from(new Set(items.map((it) => it.placeId)));
  if (placeIds.length > 0) {
    const { data: owned } = await supabase
      .from('places')
      .select('id')
      .in('id', placeIds)
      .eq('user_id', user.id);
    if ((owned?.length ?? 0) !== placeIds.length) {
      return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
    }
  }

  // 单 RPC = 单事务原子替换（迁移 027）；失败时 delete 一并回滚，原数据不被清空。
  const { data: replaced, error: replaceError } = await supabase.rpc('replace_route_places', {
    p_route_id: route.id,
    p_items: items.map((it) => ({
      place_id: it.placeId,
      day_index: it.dayIndex,
      order_index: it.orderIndex,
    })),
  });
  if (replaceError) {
    return NextResponse.json({ ok: false, message: MESSAGES.NETWORK_ERROR }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: replaced ?? 0 });
}

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BUSINESS } from '@/config/business';
import { QUOTA_ERROR } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { getQuotaProfile, limitsOf } from '@/lib/member-quota';

/**
 * U11 收藏动作（技术方案 v1.1 §4.9 埋点在客户端补齐）
 *   DELETE /api/collected?placeId=xxx  移出收藏（软标记 is_collected = false）
 *   POST   /api/collected              把收藏点加入指定路线（写 route_places）
 */

export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: '请先登录' }, { status: 401 });
  }

  const placeId = request.nextUrl.searchParams.get('placeId');
  if (!placeId) {
    return NextResponse.json({ ok: false, message: '缺少 placeId' }, { status: 400 });
  }

  // 软标记而非真删：行保留，避免 route_places 的外键级联把路线上的站点一并删掉
  // 见 supabase/migrations/012_places_collection.sql
  const { error } = await supabase
    .from('places')
    .update({ is_collected: false })
    .eq('id', placeId)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ ok: false, message: '移除失败，请重试' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: '请先登录' }, { status: 401 });
  }

  let body: { placeId?: string; routeId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // 空 body 走下面的参数校验
  }

  const { placeId, routeId } = body;
  if (!placeId || !routeId) {
    return NextResponse.json({ ok: false, message: '缺少 placeId 或 routeId' }, { status: 400 });
  }

  // 只能加入「本人收藏中」的地点
  const { data: place } = await supabase
    .from('places')
    .select('id,name')
    .eq('id', placeId)
    .eq('user_id', user.id)
    .eq('is_collected', true)
    .maybeSingle();
  if (!place) {
    return NextResponse.json({ ok: false, message: '该地点不在你的收藏中' }, { status: 404 });
  }

  // 只能加入本人的路线
  const { data: route } = await supabase
    .from('routes')
    .select('id,days')
    .eq('id', routeId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!route) {
    return NextResponse.json({ ok: false, message: '路线不存在' }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from('route_places')
    .select('place_id,day_index,order_index')
    .eq('route_id', routeId);
  const rows = existing ?? [];

  if (rows.some((r) => r.place_id === placeId)) {
    return NextResponse.json({ ok: false, message: '该地点已在这条路线中' }, { status: 409 });
  }
  if (rows.length >= BUSINESS.MAX_PLACES_PER_ROUTE) {
    return NextResponse.json(
      { ok: false, message: `单条路线最多 ${BUSINESS.MAX_PLACES_PER_ROUTE} 个地点` },
      { status: 400 },
    );
  }

  // 单日地点上限按当前档位强制（免费 6 / 会员 12 / 管理员不限），
  // 与 PUT /api/routes/[id]/places 同一口径，避免从收藏页绕过单日上限。
  const { tier } = await getQuotaProfile(user.id);
  const perDay = limitsOf(tier).placesPerDay;

  // 暂排进第一个还有空位的天，后续在「调整路线」（U08）里再调顺序
  let targetDay = -1;
  for (let d = 0; d < route.days; d += 1) {
    if (rows.filter((r) => r.day_index === d).length < perDay) {
      targetDay = d;
      break;
    }
  }
  if (targetDay === -1) {
    return NextResponse.json(
      {
        ok: false,
        code: QUOTA_ERROR.PLACES_PER_DAY_LIMIT,
        message: MESSAGES.ROUTE_DAY_PLACES_LIMIT(perDay),
      },
      { status: 403 },
    );
  }

  const orderIndex = rows.filter((r) => r.day_index === targetDay).length;

  const { error } = await supabase.from('route_places').insert({
    route_id: routeId,
    place_id: placeId,
    day_index: targetDay,
    order_index: orderIndex,
  });

  if (error) {
    return NextResponse.json({ ok: false, message: '加入失败，请重试' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, dayIndex: targetDay });
}

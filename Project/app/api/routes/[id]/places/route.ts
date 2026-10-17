import { NextResponse, type NextRequest } from 'next/server';
import { BUSINESS } from '@/config/business';
import { MESSAGES } from '@/config/messages';
import { createClient } from '@/lib/supabase/server';

/**
 * U07 生成路线后写入点位顺序
 * PUT /api/routes/[id]/places
 * body: { items: { placeId, dayIndex, orderIndex }[] }
 *
 * 先删旧列表再插入新列表（Supabase JS 无事务，按此顺序执行）。
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
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!route) {
    return NextResponse.json({ ok: false, message: MESSAGES.ROUTE_NOT_FOUND }, { status: 404 });
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

  const { error: deleteError } = await supabase
    .from('route_places')
    .delete()
    .eq('route_id', route.id);
  if (deleteError) {
    return NextResponse.json({ ok: false, message: MESSAGES.NETWORK_ERROR }, { status: 500 });
  }

  if (items.length > 0) {
    const { error: insertError } = await supabase.from('route_places').insert(
      items.map((it) => ({
        route_id: route.id,
        place_id: it.placeId,
        day_index: it.dayIndex,
        order_index: it.orderIndex,
      })),
    );
    if (insertError) {
      return NextResponse.json({ ok: false, message: MESSAGES.NETWORK_ERROR }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, count: items.length });
}

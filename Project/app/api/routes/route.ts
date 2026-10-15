import { NextResponse, type NextRequest } from 'next/server';
import { BUSINESS } from '@/config/business';
import { TRANSPORT } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { createClient } from '@/lib/supabase/server';
import { parseTripSettings } from '@/lib/route-settings';
import type { Transport } from '@/types';

/**
 * U05 新建路线保存（含本期新增的出行设置六列）
 * POST /api/routes
 */

const TRANSPORT_VALUES: readonly string[] = Object.values(TRANSPORT);

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: '请先登录' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) {
    return NextResponse.json({ ok: false, message: MESSAGES.ROUTE_TITLE_REQUIRED }, { status: 400 });
  }

  const daysRaw = body.days;
  const days = typeof daysRaw === 'number' ? daysRaw : Number.parseInt(String(daysRaw ?? ''), 10);
  if (!Number.isInteger(days) || days < 1 || days > BUSINESS.MAX_DAYS) {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  const transportRaw = body.transport;
  if (typeof transportRaw !== 'string' || !TRANSPORT_VALUES.includes(transportRaw)) {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  const parsed = parseTripSettings(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, message: parsed.message }, { status: 400 });
  }

  // 城市可空；传了 id 则校验存在，避免外键报错
  let cityId: string | null = null;
  if (typeof body.cityId === 'string' && body.cityId) {
    const { data: city } = await supabase.from('cities').select('id').eq('id', body.cityId).maybeSingle();
    cityId = city?.id ?? null;
  }

  const { data, error } = await supabase
    .from('routes')
    .insert({
      user_id: user.id,
      city_id: cityId,
      title,
      days,
      transport: transportRaw as Transport,
      ...parsed.value,
    })
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, message: MESSAGES.NETWORK_ERROR }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}

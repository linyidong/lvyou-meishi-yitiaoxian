import { NextResponse, type NextRequest } from 'next/server';
import { BUSINESS } from '@/config/business';
import { QUOTA_ERROR, TRANSPORT } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { createClient } from '@/lib/supabase/server';
import {
  consumeRouteQuota,
  getQuotaProfile,
  getRouteQuota,
  limitsOf,
  markTrialMultiDayUsed,
  routeQuotaErrorBody,
} from '@/lib/member-quota';
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

  // ==================== 阶段 2 会员分层限额（服务端强制） ====================
  // 管理员：不校验、不计数（权益不可取消）；会员 / 免费（含游客）：按档位校验。
  const { tier, trialMultiDayUsed } = await getQuotaProfile(user.id);
  const limits = limitsOf(tier);
  const isMultiDay = days > 1;
  /** 免费用户本次是否走「永久 1 次多日试用额度」 */
  let useMultiDayTrial = false;

  if (tier === 'free' && isMultiDay) {
    if (trialMultiDayUsed) {
      return NextResponse.json(
        { ok: false, code: QUOTA_ERROR.MULTI_DAY_MEMBER_ONLY, message: MESSAGES.ROUTE_MULTI_DAY_MEMBER_ONLY },
        { status: 403 },
      );
    }
    useMultiDayTrial = true;
  }

  if (tier !== 'admin') {
    // 免费按天（每天 1 条）、会员按月（每月 10 条），周期口径见 lib/member-quota.ts
    const routeQuota = await getRouteQuota(user.id, tier);
    if (routeQuota.remaining <= 0) {
      return NextResponse.json({ ok: false, ...routeQuotaErrorBody(routeQuota) }, { status: 429 });
    }
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

  // 计数与试用额度置位放在成功后：计数仅会员 / 免费，管理员不计数
  if (tier !== 'admin') {
    await consumeRouteQuota(user.id, tier);
  }
  if (useMultiDayTrial) {
    await markTrialMultiDayUsed(user.id);
  }

  return NextResponse.json({ ok: true, id: data.id });
}

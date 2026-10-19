import { NextResponse, type NextRequest } from 'next/server';
import { BUSINESS } from '@/config/business';
import { ORDER_STATUS } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * 阶段 3 会员付费订单（收款码人工核销）
 * POST /api/member/orders → 提交订单（金额一律由服务端按套餐 key 取，套餐与付款通道都按 key 校验）
 * GET  /api/member/orders → 返回当前用户最近订单
 *
 * member_orders 只有 select 策略（本人），写入必须走 service_role。
 */

const M = MESSAGES.MEMBER_ORDER;

/** 付款备注最长字数（前端 maxLength 与之保持一致） */
const PAY_NOTE_MAX = 60;

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: MESSAGES.LOGIN_FIRST }, { status: 401 });
  }

  let body: { plan?: unknown; payNote?: unknown; payChannel?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  const planKey = typeof body.plan === 'string' ? body.plan : '';
  const plan = BUSINESS.MEMBER_PLANS.find((p) => p.key === planKey);
  if (!plan) {
    return NextResponse.json({ ok: false, message: M.errInvalidPlan }, { status: 400 });
  }

  const channelKey = typeof body.payChannel === 'string' ? body.payChannel : '';
  const channel = BUSINESS.MEMBER_PAY_CHANNELS.find((c) => c.key === channelKey);
  if (!channel) {
    return NextResponse.json({ ok: false, message: M.errInvalidChannel }, { status: 400 });
  }

  const rawNote = typeof body.payNote === 'string' ? body.payNote.trim() : '';
  if (rawNote.length > PAY_NOTE_MAX) {
    return NextResponse.json({ ok: false, message: M.payNoteTooLong(PAY_NOTE_MAX) }, { status: 400 });
  }
  const payNote = rawNote || null;

  try {
    const admin = createAdminClient();

    const { count } = await admin
      .from('member_orders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', ORDER_STATUS.PENDING);
    if ((count ?? 0) >= BUSINESS.MAX_PENDING_ORDERS) {
      return NextResponse.json({ ok: false, message: M.errPendingFull }, { status: 400 });
    }

    const { data, error } = await admin
      .from('member_orders')
      .insert({
        user_id: user.id,
        plan: plan.key,
        amount_cents: plan.priceCents,
        pay_note: payNote,
        pay_channel: channel.key,
        status: ORDER_STATUS.PENDING,
      })
      .select('id')
      .single();
    if (error || !data) {
      return NextResponse.json({ ok: false, message: M.errOrderFailed }, { status: 500 });
    }

    return NextResponse.json({ ok: true, orderId: data.id });
  } catch {
    return NextResponse.json({ ok: false, message: M.errOrderFailed }, { status: 500 });
  }
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: MESSAGES.LOGIN_FIRST }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('member_orders')
      .select('id,plan,amount_cents,pay_note,pay_channel,status,reject_reason,created_at,reviewed_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      return NextResponse.json({ ok: false, message: M.errLoadFailed }, { status: 500 });
    }
    return NextResponse.json({ ok: true, orders: data ?? [] });
  } catch {
    return NextResponse.json({ ok: false, message: M.errLoadFailed }, { status: 500 });
  }
}

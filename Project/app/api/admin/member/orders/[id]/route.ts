import { NextResponse, type NextRequest } from 'next/server';
import { BUSINESS } from '@/config/business';
import { MEMBER_ACTION, MEMBER_SOURCE, ORDER_STATUS, USER_ROLE } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * A08 管理端会员订单核销
 * POST /api/admin/member/orders/[id]
 * body: { approve: boolean; reason?: string }
 *
 * approve=true  → 目标用户置会员（member_source='paid'，member_until 按套餐天数）+ member_logs 留痕
 * approve=false → 订单置 rejected 并记录驳回原因
 * 全部走 service_role；管理员账号不可被开通（返回 ADMIN_MEMBER_FIXED）。
 */

/** 一天毫秒数 */
const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: MESSAGES.LOGIN_FIRST }, { status: 401 });
  }

  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== USER_ROLE.ADMIN) {
    return NextResponse.json({ ok: false, message: MESSAGES.FORBIDDEN }, { status: 403 });
  }

  const orderId = params.id;
  if (!orderId) {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  let body: { approve?: unknown; reason?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }
  if (typeof body.approve !== 'boolean') {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

  try {
    const admin = createAdminClient();
    const { data: order } = await admin
      .from('member_orders')
      .select('id,user_id,plan,status')
      .eq('id', orderId)
      .maybeSingle();
    if (!order) {
      return NextResponse.json({ ok: false, message: MESSAGES.ADMIN_ORDERS.errNotFound }, { status: 404 });
    }
    if (order.status !== ORDER_STATUS.PENDING) {
      return NextResponse.json({ ok: false, message: MESSAGES.ADMIN_ORDERS.errNotPending }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    if (body.approve) {
      const { data: target } = await admin
        .from('users')
        .select('id,role')
        .eq('id', order.user_id)
        .maybeSingle();
      if (!target) {
        return NextResponse.json({ ok: false, message: MESSAGES.ADMIN_ORDERS.errNotFound }, { status: 404 });
      }
      // 管理员默认最高级会员，不允许通过付费订单开通
      if (target.role === USER_ROLE.ADMIN) {
        return NextResponse.json({ ok: false, message: MESSAGES.ADMIN_MEMBER_FIXED }, { status: 400 });
      }

      const plan = BUSINESS.MEMBER_PLANS.find((p) => p.key === order.plan);
      if (!plan) {
        return NextResponse.json({ ok: false, message: MESSAGES.ADMIN_ORDERS.actionFailed }, { status: 400 });
      }
      const memberUntil = new Date(Date.now() + plan.days * DAY_MS).toISOString();

      const { error: userError } = await admin
        .from('users')
        .update({
          member: true,
          member_since: nowIso,
          member_source: MEMBER_SOURCE.PAID,
          member_until: memberUntil,
        })
        .eq('id', order.user_id);
      if (userError) {
        return NextResponse.json({ ok: false, message: MESSAGES.ADMIN_ORDERS.actionFailed }, { status: 500 });
      }

      // member_logs 无 insert 策略，必须用 service_role 写入
      await admin.from('member_logs').insert({
        target_user: order.user_id,
        action: MEMBER_ACTION.GRANT,
        operator_id: user.id,
        source: MEMBER_SOURCE.PAID,
      });

      const { error: orderError } = await admin
        .from('member_orders')
        .update({
          status: ORDER_STATUS.APPROVED,
          reject_reason: null,
          reviewed_at: nowIso,
          reviewed_by: user.id,
        })
        .eq('id', order.id);
      if (orderError) {
        return NextResponse.json({ ok: false, message: MESSAGES.ADMIN_ORDERS.actionFailed }, { status: 500 });
      }

      return NextResponse.json({ ok: true, status: ORDER_STATUS.APPROVED });
    }

    const { error: rejectError } = await admin
      .from('member_orders')
      .update({
        status: ORDER_STATUS.REJECTED,
        reject_reason: reason || null,
        reviewed_at: nowIso,
        reviewed_by: user.id,
      })
      .eq('id', order.id);
    if (rejectError) {
      return NextResponse.json({ ok: false, message: MESSAGES.ADMIN_ORDERS.actionFailed }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status: ORDER_STATUS.REJECTED });
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.ADMIN_ORDERS.actionFailed }, { status: 500 });
  }
}

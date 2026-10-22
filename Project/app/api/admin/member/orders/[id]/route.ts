import { NextResponse, type NextRequest } from 'next/server';
import { BUSINESS } from '@/config/business';
import { ORDER_STATUS, USER_ROLE } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * A08 管理端会员订单核销
 * POST /api/admin/member/orders/[id]
 * body: { approve: boolean; reason?: string }
 *
 * approve=true  → 经数据库函数 approve_member_order（迁移 027）单事务核销：
 *                 CAS 占单（仅 pending 可翻转）→ 置会员 → member_logs 留痕，任一失败整体回滚；
 *                 并发/重复点击只有先到者生效，后到者返回 409（修复并发审计 R2）
 * approve=false → 订单置 rejected 并记录驳回原因（同样带 status='pending' CAS，0 行 → 409）
 * 全部走 service_role；管理员账号不可被开通（返回 ADMIN_MEMBER_FIXED）。
 */

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
      // 单 RPC = 单事务核销（迁移 027）：CAS 占单 → 置会员 → 留痕，任一失败整体回滚。
      // member_until = now() + plan.days 天，与原应用层 Date.now()+days*DAY_MS 口径一致（时钟源改为 DB）。
      const { data: approved, error: approveError } = await admin.rpc('approve_member_order', {
        p_order_id: order.id,
        p_admin: user.id,
        p_days: plan.days,
      });
      if (approveError) {
        return NextResponse.json({ ok: false, message: MESSAGES.ADMIN_ORDERS.actionFailed }, { status: 500 });
      }
      if ((approved as { result?: string } | null)?.result !== 'OK') {
        // 并发/重复：订单已被他人核销或驳回，本次未产生任何写入
        return NextResponse.json({ ok: false, message: MESSAGES.ADMIN_ORDERS.errNotPending }, { status: 409 });
      }

      return NextResponse.json({ ok: true, status: ORDER_STATUS.APPROVED });
    }

    // 驳回同样带 status='pending' CAS：防止并发 approve 的终态被 rejected 覆盖
    const { data: rejected, error: rejectError } = await admin
      .from('member_orders')
      .update({
        status: ORDER_STATUS.REJECTED,
        reject_reason: reason || null,
        reviewed_at: nowIso,
        reviewed_by: user.id,
      })
      .eq('id', order.id)
      .eq('status', ORDER_STATUS.PENDING)
      .select('id');
    if (rejectError) {
      return NextResponse.json({ ok: false, message: MESSAGES.ADMIN_ORDERS.actionFailed }, { status: 500 });
    }
    if (!rejected?.length) {
      return NextResponse.json({ ok: false, message: MESSAGES.ADMIN_ORDERS.errNotPending }, { status: 409 });
    }

    return NextResponse.json({ ok: true, status: ORDER_STATUS.REJECTED });
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.ADMIN_ORDERS.actionFailed }, { status: 500 });
  }
}

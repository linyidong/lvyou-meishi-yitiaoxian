import { NextResponse } from 'next/server';
import { BUSINESS } from '@/config/business';
import { ORDER_STATUS, USER_ROLE } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * A08 管理端会员订单列表
 * GET /api/admin/member/orders → 待核销优先、再按创建时间倒序；join 出下单用户邮箱
 *
 * 服务端二次校验 role=admin；读取走 service_role（member_orders 无管理端策略）。
 */
export async function GET() {
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

  try {
    const admin = createAdminClient();
    const columns =
      'id,user_id,plan,amount_cents,pay_note,status,reject_reason,created_at,reviewed_at,reviewed_by';

    const [pendingRes, reviewedRes] = await Promise.all([
      admin
        .from('member_orders')
        .select(columns)
        .eq('status', ORDER_STATUS.PENDING)
        .order('created_at', { ascending: false })
        .limit(BUSINESS.ADMIN_ORDER_LIMIT),
      admin
        .from('member_orders')
        .select(columns)
        .neq('status', ORDER_STATUS.PENDING)
        .order('created_at', { ascending: false })
        .limit(BUSINESS.ADMIN_ORDER_LIMIT),
    ]);
    if (pendingRes.error || reviewedRes.error) {
      return NextResponse.json({ ok: false, message: MESSAGES.ADMIN_ORDERS.errorTitle }, { status: 500 });
    }

    const orders = [...(pendingRes.data ?? []), ...(reviewedRes.data ?? [])].slice(
      0,
      BUSINESS.ADMIN_ORDER_LIMIT,
    );

    // 下单用户邮箱映射
    const userIds = Array.from(new Set(orders.map((o) => o.user_id)));
    const emailById = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: users } = await admin.from('users').select('id,email').in('id', userIds);
      for (const u of users ?? []) emailById.set(u.id, u.email ?? '—');
    }

    return NextResponse.json({
      ok: true,
      orders: orders.map((o) => ({ ...o, email: emailById.get(o.user_id) ?? '—' })),
    });
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.ADMIN_ORDERS.errorTitle }, { status: 500 });
  }
}

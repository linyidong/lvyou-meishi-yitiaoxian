import { BUSINESS } from '@/config/business';
import { ORDER_STATUS } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { AdminOrdersClient, type AdminOrderItem } from '@/components/admin/AdminOrdersClient';
import { AdminErrorState } from '@/components/admin/AdminState';
import { AdminShell } from '@/components/layout/AdminShell';
import { createAdminClient } from '@/lib/supabase/admin';
import { DatabaseZap } from 'lucide-react';
import type { MemberPlan, OrderStatus, PayChannel } from '@/types';

/** A08 会员订单：待核销置顶 + 确认开通 / 驳回（收款码人工核销，阶段 3） */
export default async function AdminOrdersPage() {
  const admin = createAdminClient();

  const columns =
    'id,user_id,plan,amount_cents,pay_note,pay_channel,status,reject_reason,created_at,reviewed_at';

  let orders: AdminOrderItem[] = [];
  let failed = false;

  try {
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
      failed = true;
    } else {
      const rows = [...(pendingRes.data ?? []), ...(reviewedRes.data ?? [])].slice(
        0,
        BUSINESS.ADMIN_ORDER_LIMIT,
      );

      const userIds = Array.from(new Set(rows.map((o) => o.user_id)));
      const emailById = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: users } = await admin.from('users').select('id,email').in('id', userIds);
        for (const u of users ?? []) emailById.set(u.id, u.email ?? '—');
      }

      orders = rows.map((o) => ({
        id: o.id,
        email: emailById.get(o.user_id) ?? '—',
        plan: o.plan as MemberPlan,
        amountCents: o.amount_cents,
        payNote: o.pay_note,
        payChannel: o.pay_channel as PayChannel,
        status: o.status as OrderStatus,
        rejectReason: o.reject_reason,
        createdAt: o.created_at,
        reviewedAt: o.reviewed_at,
      }));
    }
  } catch {
    failed = true;
  }

  return (
    <AdminShell
      currentPath={ROUTES.ADMIN_ORDERS}
      title={MESSAGES.ADMIN_SHELL.navOrders}
      badge={MESSAGES.ADMIN_SHELL.badgeOrders}
      showAdminName
    >
      {failed ? (
        <AdminErrorState
          icon={<DatabaseZap className="mx-auto h-12 w-12 text-red-400" />}
          title={MESSAGES.ADMIN_ORDERS.errorTitle}
          desc={MESSAGES.ADMIN_ORDERS.errorDesc}
        />
      ) : (
        <AdminOrdersClient orders={orders} />
      )}
    </AdminShell>
  );
}

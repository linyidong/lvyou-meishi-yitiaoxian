import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { AdminListSkeleton } from '@/components/admin/AdminState';
import { AdminShell } from '@/components/layout/AdminShell';

/** A08 会员订单列表加载骨架 */
export default function AdminOrdersLoading() {
  return (
    <AdminShell
      currentPath={ROUTES.ADMIN_ORDERS}
      title={MESSAGES.ADMIN_SHELL.navOrders}
      badge={MESSAGES.ADMIN_SHELL.badgeOrders}
      showAdminName
    >
      <AdminListSkeleton rows={5} />
    </AdminShell>
  );
}

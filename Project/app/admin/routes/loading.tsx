import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { AdminListSkeleton } from '@/components/admin/AdminState';
import { AdminShell } from '@/components/layout/AdminShell';

/** A06 路线列表加载骨架 */
export default function AdminRoutesLoading() {
  return (
    <AdminShell
      currentPath={ROUTES.ADMIN_ROUTES}
      title={MESSAGES.ADMIN_SHELL.navRoutes}
      badge={MESSAGES.ADMIN_SHELL.badgeReadonly}
    >
      <AdminListSkeleton rows={4} />
    </AdminShell>
  );
}

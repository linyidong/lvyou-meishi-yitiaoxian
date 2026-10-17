import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { AdminListSkeleton } from '@/components/admin/AdminState';
import { AdminShell } from '@/components/layout/AdminShell';

/** A03 用户列表加载骨架 */
export default function AdminUsersLoading() {
  return (
    <AdminShell
      currentPath={ROUTES.ADMIN_USERS}
      title={MESSAGES.ADMIN_SHELL.navUsers}
      badge={MESSAGES.ADMIN_SHELL.badgeUsers}
      showAdminName
    >
      <AdminListSkeleton rows={5} />
    </AdminShell>
  );
}

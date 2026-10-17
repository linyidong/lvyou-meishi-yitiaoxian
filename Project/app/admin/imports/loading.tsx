import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { AdminListSkeleton } from '@/components/admin/AdminState';
import { AdminShell } from '@/components/layout/AdminShell';

/** A07 导入记录加载骨架 */
export default function AdminImportsLoading() {
  return (
    <AdminShell
      currentPath={ROUTES.ADMIN_IMPORTS}
      title={MESSAGES.ADMIN_SHELL.navImports}
      badge={MESSAGES.ADMIN_SHELL.badgeReadonly}
    >
      <AdminListSkeleton rows={4} />
    </AdminShell>
  );
}

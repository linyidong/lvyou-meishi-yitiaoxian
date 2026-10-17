import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { AdminListSkeleton } from '@/components/admin/AdminState';
import { AdminShell } from '@/components/layout/AdminShell';

/** A04 在线用户加载骨架 */
export default function AdminOnlineLoading() {
  return (
    <AdminShell
      currentPath={ROUTES.ADMIN_ONLINE}
      title={MESSAGES.ADMIN_SHELL.navOnline}
      badge={MESSAGES.ADMIN_SHELL.badgeReadonly}
      refresh
    >
      <div className="h-32 animate-pulse rounded-2xl bg-slate-200" />
      <AdminListSkeleton className="mt-5" rows={3} />
    </AdminShell>
  );
}

import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { AdminListSkeleton } from '@/components/admin/AdminState';
import { AdminShell } from '@/components/layout/AdminShell';

/** A05 地点列表加载骨架 */
export default function AdminPlacesLoading() {
  return (
    <AdminShell
      currentPath={ROUTES.ADMIN_PLACES}
      title={MESSAGES.ADMIN_SHELL.navPlaces}
      badge={MESSAGES.ADMIN_SHELL.badgeReadonly}
    >
      <AdminListSkeleton rows={4} />
    </AdminShell>
  );
}

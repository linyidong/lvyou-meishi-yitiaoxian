import { BUSINESS } from '@/config/business';
import { GEO_STATUS } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { AdminPlacesClient, type AdminPlaceRow } from '@/components/admin/AdminPlacesClient';
import { AdminErrorState } from '@/components/admin/AdminState';
import { AdminShell } from '@/components/layout/AdminShell';
import { createClient } from '@/lib/supabase/server';
import { DatabaseZap } from 'lucide-react';
import type { GeoStatus, ImportSource, PlaceType } from '@/types';

/** A05 地点列表：只读全量地点（单次上限 B19） */
export default async function AdminPlacesPage() {
  const supabase = createClient();

  const [placesRes, citiesRes, usersRes] = await Promise.all([
    supabase
      .from('places')
      .select('id,name,type,city_id,source,geo_status,user_id,created_at')
      .order('created_at', { ascending: false })
      .limit(BUSINESS.ADMIN_LIST_LIMIT),
    supabase.from('cities').select('id,name'),
    supabase.from('users').select('id,email'),
  ]);

  if (placesRes.error) {
    return (
      <AdminShell
        currentPath={ROUTES.ADMIN_PLACES}
        title={MESSAGES.ADMIN_SHELL.navPlaces}
        badge={MESSAGES.ADMIN_SHELL.badgeReadonly}
      >
        <AdminErrorState icon={<DatabaseZap className="mx-auto h-12 w-12 text-red-400" />} title={MESSAGES.ADMIN_PLACES.errorTitle} />
      </AdminShell>
    );
  }

  const cityNameById = new Map((citiesRes.data ?? []).map((c) => [c.id, c.name]));
  const emailById = new Map((usersRes.data ?? []).map((u) => [u.id, u.email]));

  const rows: AdminPlaceRow[] = (placesRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type as PlaceType,
    // places.source 允许为空（手动补点时未填）
    cityName: p.city_id ? cityNameById.get(p.city_id) ?? null : null,
    source: (p.source as ImportSource | null) ?? null,
    geoStatus: (p.geo_status as GeoStatus | null) ?? GEO_STATUS.PENDING,
    ownerEmail: emailById.get(p.user_id) ?? null,
    createdAt: p.created_at,
  }));

  return (
    <AdminShell
      currentPath={ROUTES.ADMIN_PLACES}
      title={MESSAGES.ADMIN_SHELL.navPlaces}
      badge={MESSAGES.ADMIN_SHELL.badgeReadonly}
    >
      <AdminPlacesClient rows={rows} />
    </AdminShell>
  );
}

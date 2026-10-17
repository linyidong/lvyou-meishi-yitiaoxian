import { BUSINESS } from '@/config/business';
import { INTERCITY_MODE_LABEL, LODGING_TYPE_LABEL, PLACE_TYPE_LABEL, TRANSPORT_LABEL } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import {
  AdminRoutesClient,
  type AdminRouteItem,
  type AdminRoutePlace,
} from '@/components/admin/AdminRoutesClient';
import { AdminErrorState } from '@/components/admin/AdminState';
import { AdminShell } from '@/components/layout/AdminShell';
import { createClient } from '@/lib/supabase/server';
import { DatabaseZap } from 'lucide-react';
import type { IntercityMode, LodgingType, PlaceType, Transport } from '@/types';

/** A06 路线列表：全站只读，详情抽屉含本期新增的出行设置 */
export default async function AdminRoutesPage() {
  const supabase = createClient();

  const [routesRes, usersRes, citiesRes] = await Promise.all([
    supabase
      .from('routes')
      .select(
        'id,user_id,city_id,title,days,transport,origin_city,intercity_mode,lodging_type,lodging_area,lodging_name,lodging_nights,created_at',
      )
      .order('created_at', { ascending: false })
      .limit(BUSINESS.ADMIN_LIST_LIMIT),
    supabase.from('users').select('id,email').limit(BUSINESS.ADMIN_LIST_LIMIT),
    supabase.from('cities').select('id,name').order('name'),
  ]);

  if (routesRes.error) {
    return (
      <AdminShell
        currentPath={ROUTES.ADMIN_ROUTES}
        title={MESSAGES.ADMIN_SHELL.navRoutes}
        badge={MESSAGES.ADMIN_SHELL.badgeReadonly}
      >
        <AdminErrorState icon={DatabaseZap} title={MESSAGES.ADMIN_ROUTES.errorTitle} />
      </AdminShell>
    );
  }

  const routes = routesRes.data ?? [];
  const routeIds = routes.map((r) => r.id);

  const routePlaces = routeIds.length
    ? (
        await supabase
          .from('route_places')
          .select('route_id,place_id,day_index')
          .in('route_id', routeIds)
          .order('day_index')
      ).data ?? []
    : [];

  const placeIds = Array.from(new Set(routePlaces.map((rp) => rp.place_id)));
  const places = placeIds.length
    ? (await supabase.from('places').select('id,name,type').in('id', placeIds)).data ?? []
    : [];

  const emailById = new Map((usersRes.data ?? []).map((u) => [u.id, u.email ?? '—']));
  const cityById = new Map((citiesRes.data ?? []).map((c) => [c.id, c.name]));
  const placeById = new Map(places.map((p) => [p.id, p]));

  const items: AdminRouteItem[] = routes.map((r) => {
    const cityName = r.city_id ? (cityById.get(r.city_id) ?? '—') : '—';
    const originCity = r.origin_city ?? null;
    const intercityMode = (r.intercity_mode as IntercityMode | null) ?? null;
    const lodgingType = (r.lodging_type as LodgingType | null) ?? null;

    const intercityLabel =
      originCity && originCity === cityName
        ? '同城出发，无需城际交通'
        : intercityMode
          ? `${INTERCITY_MODE_LABEL[intercityMode]}（${originCity ?? '出发城市'} → ${cityName}）`
          : '暂不设置';

    const lodgingLabel = lodgingType
      ? [
          LODGING_TYPE_LABEL[lodgingType],
          r.lodging_area,
          r.lodging_name,
          r.lodging_nights ? `${r.lodging_nights} 晚` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : '暂不预订';

    const picked: AdminRoutePlace[] = routePlaces
      .filter((rp) => rp.route_id === r.id)
      .map((rp) => {
        const place = placeById.get(rp.place_id);
        return {
          name: place?.name ?? rp.place_id,
          typeLabel: place ? PLACE_TYPE_LABEL[place.type as PlaceType] : '—',
          dayIndex: rp.day_index,
        };
      });

    return {
      id: r.id,
      userEmail: emailById.get(r.user_id) ?? '—',
      cityName,
      title: r.title,
      days: r.days,
      transport: r.transport as Transport,
      transportLabel: TRANSPORT_LABEL[r.transport as Transport],
      originCity,
      intercityLabel,
      lodgingLabel,
      placeCount: picked.length,
      createdAt: r.created_at,
      places: picked,
    };
  });

  return (
    <AdminShell
      currentPath={ROUTES.ADMIN_ROUTES}
      title={MESSAGES.ADMIN_SHELL.navRoutes}
      badge={MESSAGES.ADMIN_SHELL.badgeReadonly}
    >
      <AdminRoutesClient routes={items} />
    </AdminShell>
  );
}

import { LODGING_TYPE_LABEL, PLACE_TYPE } from '@/config/enums';
import { MyRoutesClient, type MyRouteItem, type MyRoutePoint } from '@/components/route/MyRoutesClient';
import { createClient } from '@/lib/supabase/server';
import type { LodgingType, Transport } from '@/types';

/** U03 我的路线：只读列表，路线仅自己可见 */

/** route_places 关联 places 的精简行（仅取卡片需要的字段） */
interface RoutePlaceRowForCard {
  route_id: string;
  day_index: number;
  order_index: number;
  places: { type: string; lat: number | null; lng: number | null } | null;
}

export default async function MyRoutesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // middleware.ts 已拦截未登录，这里只做兜底
  if (!user) {
    return <MyRoutesClient routes={[]} denied />;
  }

  const [routesRes, citiesRes] = await Promise.all([
    supabase
      .from('routes')
      .select(
        'id,title,days,transport,city_id,origin_city,intercity_mode,lodging_type,lodging_area,lodging_name,lodging_nights,created_at',
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.from('cities').select('id,name'),
  ]);

  if (routesRes.error) {
    return <MyRoutesClient routes={[]} error />;
  }

  const routes = routesRes.data ?? [];
  const routeIds = routes.map((r) => r.id);

  const rawRoutePlaces =
    routeIds.length > 0
      ? (
          await supabase
            .from('route_places')
            .select('route_id,day_index,order_index,places(type,lat,lng)')
            .in('route_id', routeIds)
        ).data ?? []
      : [];

  const routePlaces = rawRoutePlaces as unknown as RoutePlaceRowForCard[];
  // 按天、按天内顺序排好，卡片迷你地图的折线才连得对
  routePlaces.sort((a, b) => a.day_index - b.day_index || a.order_index - b.order_index);

  const countByRoute = new Map<string, number>();
  const foodByRoute = new Map<string, number>();
  const pointsByRoute = new Map<string, MyRoutePoint[]>();

  for (const rp of routePlaces) {
    countByRoute.set(rp.route_id, (countByRoute.get(rp.route_id) ?? 0) + 1);

    const place = rp.places;
    if (!place) continue;

    const isFood = place.type === PLACE_TYPE.FOOD;
    if (isFood) foodByRoute.set(rp.route_id, (foodByRoute.get(rp.route_id) ?? 0) + 1);

    if (place.lat !== null && place.lng !== null) {
      const list = pointsByRoute.get(rp.route_id) ?? [];
      list.push({ day: rp.day_index, lat: place.lat, lng: place.lng, food: isFood });
      pointsByRoute.set(rp.route_id, list);
    }
  }

  const cityNameById = new Map((citiesRes.data ?? []).map((c) => [c.id, c.name]));

  const items: MyRouteItem[] = routes.map((r) => ({
    id: r.id,
    title: r.title,
    cityName: r.city_id ? cityNameById.get(r.city_id) ?? null : null,
    days: r.days,
    transport: r.transport as Transport,
    placeCount: countByRoute.get(r.id) ?? 0,
    foodCount: foodByRoute.get(r.id) ?? 0,
    createdAt: r.created_at,
    originCity: r.origin_city,
    lodgingLabel: r.lodging_type ? LODGING_TYPE_LABEL[r.lodging_type as LodgingType] : null,
    lodgingNights: r.lodging_nights,
    points: pointsByRoute.get(r.id) ?? [],
  }));

  return <MyRoutesClient routes={items} />;
}

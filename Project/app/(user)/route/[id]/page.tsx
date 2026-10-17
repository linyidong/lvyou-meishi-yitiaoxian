import Link from 'next/link';
import {
  INTERCITY_MODE_LABEL,
  LODGING_TYPE_LABEL,
  TRANSPORT_LABEL,
} from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import {
  RouteResultClient,
  type ResultDay,
  type ResultPlace,
} from '@/components/route/RouteResultClient';
import { createClient } from '@/lib/supabase/server';
import type { IntercityMode, LodgingType, PlaceType, Transport } from '@/types';

/** U09 路线结果：按天顺序展示地点，地图暂不渲染 */
export default async function RouteDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // middleware.ts 已拦截未登录，这里只做兜底
  if (!user) {
    return (
      <p className="text-sm text-muted-foreground">
        请先
        <Link href={ROUTES.LOGIN} className="text-primary underline">
          登录
        </Link>
        后查看路线。
      </p>
    );
  }

  const { data: route } = await supabase
    .from('routes')
    .select(
      'id,title,days,transport,city_id,origin_city,intercity_mode,lodging_type,lodging_area,lodging_name,lodging_nights',
    )
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!route) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-background p-10 text-center">
        <p className="font-semibold">{MESSAGES.ROUTE_NOT_FOUND}</p>
        <Link
          href={ROUTES.MY_ROUTES}
          className="mt-4 inline-flex h-10 items-center rounded-xl border border-border px-5 text-sm font-medium hover:bg-muted"
        >
          返回我的路线
        </Link>
      </div>
    );
  }

  let cityName: string | null = null;
  if (route.city_id) {
    const { data: city } = await supabase
      .from('cities')
      .select('name')
      .eq('id', route.city_id)
      .maybeSingle();
    cityName = city?.name ?? null;
  }

  const { data: rp } = await supabase
    .from('route_places')
    .select('place_id,day_index,order_index')
    .eq('route_id', route.id)
    .order('day_index', { ascending: true })
    .order('order_index', { ascending: true });

  const rows = rp ?? [];
  const placeIds = Array.from(new Set(rows.map((r) => r.place_id)));
  const placeById = new Map<string, ResultPlace>();
  if (placeIds.length > 0) {
    const { data: places } = await supabase
      .from('places')
      .select('id,name,type,address,note')
      .in('id', placeIds);
    for (const p of places ?? []) {
      placeById.set(p.id, {
        name: p.name,
        type: p.type as PlaceType,
        address: p.address,
        note: p.note,
      });
    }
  }

  const resultDays: ResultDay[] = [];
  for (let day = 0; day < route.days; day += 1) {
    const places = rows
      .filter((r) => r.day_index === day)
      .map((r) => placeById.get(r.place_id))
      .filter((p): p is ResultPlace => Boolean(p));
    resultDays.push({ dayIndex: day, places });
  }

  const intercityLabel =
    route.origin_city && route.origin_city === cityName
      ? '同城出发，无需城际交通'
      : route.intercity_mode
        ? `${INTERCITY_MODE_LABEL[route.intercity_mode as IntercityMode]}（${route.origin_city ?? '出发城市'} → ${cityName ?? '旅行城市'}）`
        : '暂不设置';

  const lodgingLabel = route.lodging_type
    ? [
        LODGING_TYPE_LABEL[route.lodging_type as LodgingType],
        route.lodging_area,
        route.lodging_name,
        route.lodging_nights ? `${route.lodging_nights} 晚` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '暂不预订';

  return (
    <RouteResultClient
      routeId={route.id}
      title={route.title}
      cityName={cityName}
      days={route.days}
      transportLabel={TRANSPORT_LABEL[route.transport as Transport]}
      originCity={route.origin_city}
      intercityLabel={intercityLabel}
      lodgingLabel={lodgingLabel}
      resultDays={resultDays}
      totalPlaces={rows.length}
    />
  );
}

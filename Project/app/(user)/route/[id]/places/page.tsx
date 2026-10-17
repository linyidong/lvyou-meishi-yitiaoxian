import Link from 'next/link';
import { TRANSPORT_LABEL } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import {
  RoutePlacesClient,
  type RoutePlaceOption,
} from '@/components/route/RoutePlacesClient';
import { createClient } from '@/lib/supabase/server';
import type { PlaceType, Transport } from '@/types';

/** U07 勾选地点：当前城市地点库 + 已在路线中的点，生成后写入 route_places */
export default async function RoutePlacesPage({ params }: { params: { id: string } }) {
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
        后勾选地点。
      </p>
    );
  }

  const { data: route } = await supabase
    .from('routes')
    .select('id,title,days,transport,city_id')
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

  let places: RoutePlaceOption[] = [];
  if (route.city_id) {
    const { data } = await supabase
      .from('places')
      .select('id,name,type,address,lat,lng')
      .eq('user_id', user.id)
      .eq('city_id', route.city_id)
      .order('created_at', { ascending: false });
    places = (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type as PlaceType,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
    }));
  }

  const { data: rp } = await supabase
    .from('route_places')
    .select('place_id')
    .eq('route_id', route.id);
  const initialCheckedIds = (rp ?? []).map((x) => x.place_id);

  return (
    <RoutePlacesClient
      routeId={route.id}
      cityName={cityName}
      days={route.days}
      transportLabel={TRANSPORT_LABEL[route.transport as Transport]}
      places={places}
      initialCheckedIds={initialCheckedIds}
    />
  );
}

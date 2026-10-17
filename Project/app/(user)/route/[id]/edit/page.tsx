import Link from 'next/link';
import { Lock } from 'lucide-react';
import { FlowSteps } from '@/components/route/FlowSteps';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import {
  RouteEditClient,
  type RouteEditPlace,
} from '@/components/route/RouteEditClient';
import { createClient } from '@/lib/supabase/server';
import type { IntercityMode, LodgingType, PlaceType, Transport } from '@/types';

/** U08 调整路线（第 5 步）：读取 route_places 的按天顺序，微调后保存回 PUT /api/routes/[id]/places */
export default async function RouteEditPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 无权限（路线不存在 / 不属于当前账号）
  if (!user) {
    return <RouteEditDenied />;
  }

  const { data: route } = await supabase
    .from('routes')
    .select('id,title,days,transport,city_id,origin_city,intercity_mode,lodging_type,lodging_area,lodging_nights')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!route) {
    return <RouteEditDenied />;
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

  const { data: rows } = await supabase
    .from('route_places')
    .select('place_id,day_index,order_index,places(name,type,address,lat,lng)')
    .eq('route_id', route.id)
    .order('day_index', { ascending: true })
    .order('order_index', { ascending: true });

  const places: RouteEditPlace[] = (rows ?? [])
    .filter((row) => row.places)
    .map((row) => {
      const place = row.places as unknown as {
        name: string;
        type: PlaceType;
        address: string | null;
        lat: number | null;
        lng: number | null;
      };
      return {
        placeId: row.place_id,
        name: place.name,
        type: place.type,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        dayIndex: row.day_index,
        orderIndex: row.order_index,
      };
    });

  const routeTitle = route.title ?? (cityName ? `${cityName} · 吃喝一条线` : '吃喝一条线');

  return (
    <>
      <FlowSteps current={5} />
      <div className="pt-6 md:pt-10">
        <RouteEditClient
          routeId={route.id}
          routeTitle={routeTitle}
          cityName={cityName}
          days={route.days}
          transport={route.transport as Transport}
          originCity={route.origin_city}
          intercityMode={route.intercity_mode as IntercityMode | null}
          lodgingType={route.lodging_type as LodgingType | null}
          lodgingArea={route.lodging_area}
          lodgingNights={route.lodging_nights}
          places={places}
        />
      </div>
    </>
  );
}

/** 无权编辑（原型 data-state=denied） */
function RouteEditDenied() {
  const M = MESSAGES.ROUTE_EDIT;
  return (
    <>
      <FlowSteps current={5} />
      <div className="pt-6 md:pt-10">
        <div className="rounded-2xl border border-stone-200 bg-white py-16 text-center">
          <span className="w-16 h-16 mx-auto rounded-2xl bg-stone-100 text-stone-400 grid place-items-center">
            <Lock className="h-8 w-8" />
          </span>
          <p className="mt-3 font-semibold">{M.deniedTitle}</p>
          <p className="mt-1 text-sm text-stone-500">{M.deniedDesc}</p>
          <div className="mt-4 flex justify-center px-6">
            <Link
              href={ROUTES.MY_ROUTES}
              className="inline-flex h-10 px-5 items-center rounded-lg bg-gradient-to-r from-primary-from to-primary-to text-white text-sm font-semibold"
            >
              {M.deniedBack}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

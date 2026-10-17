import Link from 'next/link';
import { FlowSteps } from '@/components/route/FlowSteps';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import {
  RoutePlacesClient,
  type RoutePlaceOption,
} from '@/components/route/RoutePlacesClient';
import { createClient } from '@/lib/supabase/server';
import type { PlaceType, Transport } from '@/types';

/** U07 勾选地点（第 4 步）：当前城市地点库 + 已在路线中的点，生成后写入 route_places */
export default async function RoutePlacesPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // middleware.ts 已拦截未登录，这里只做兜底
  if (!user) {
    return (
      <>
        <FlowSteps current={4} />
        <div className="pt-6 md:pt-10">
          <p className="text-sm text-stone-500">
            请先
            <Link href={ROUTES.LOGIN} className="text-primary underline">
              登录
            </Link>
            后勾选地点。
          </p>
        </div>
      </>
    );
  }

  const { data: route } = await supabase
    .from('routes')
    .select('id,title,days,transport,city_id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  // 无权限（路线不存在或不属于当前账号）
  if (!route) {
    return (
      <>
        <FlowSteps current={4} />
        <div className="pt-6 md:pt-10">
          <div className="rounded-2xl border border-stone-200 bg-white py-16 text-center">
            <p className="font-semibold">{MESSAGES.ROUTE_PLACES.deniedTitle}</p>
            <p className="mt-1 text-sm text-stone-500">{MESSAGES.ROUTE_PLACES.deniedDesc}</p>
            <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center px-6">
              <Link
                href={ROUTES.CITY}
                className="h-10 px-5 rounded-lg bg-primary hover:brightness-110 text-white text-sm font-semibold flex items-center justify-center"
              >
                {MESSAGES.ROUTE_PLACES.deniedCreate}
              </Link>
            </div>
          </div>
        </div>
      </>
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
    <>
      <FlowSteps current={4} />
      <div className="pt-6 md:pt-10">
        <RoutePlacesClient
          routeId={route.id}
          cityName={cityName}
          days={route.days}
          transport={route.transport as Transport}
          places={places}
          initialCheckedIds={initialCheckedIds}
        />
      </div>
    </>
  );
}

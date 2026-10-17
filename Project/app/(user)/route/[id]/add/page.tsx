import Link from 'next/link';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import {
  RouteAddClient,
  type CityPlaceOption,
} from '@/components/route/RouteAddClient';
import { createClient } from '@/lib/supabase/server';
import type { PlaceType } from '@/types';

/** U06 添加地点：当前城市收藏 + AI 提取文案，确认后落库并进入 U07 */
export default async function RouteAddPage({ params }: { params: { id: string } }) {
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
        后导入地点。
      </p>
    );
  }

  const { data: route } = await supabase
    .from('routes')
    .select('id,title,days,city_id')
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

  let cityPlaces: CityPlaceOption[] = [];
  if (route.city_id) {
    const { data } = await supabase
      .from('places')
      .select('id,name,type,address')
      .eq('user_id', user.id)
      .eq('is_collected', true)
      .eq('city_id', route.city_id)
      .order('created_at', { ascending: false });
    cityPlaces = (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type as PlaceType,
      address: p.address,
    }));
  }

  const { data: rp } = await supabase.from('route_places').select('place_id').eq('route_id', route.id);
  const addedPlaceIds = (rp ?? []).map((x) => x.place_id);

  return (
    <RouteAddClient
      routeId={route.id}
      cityName={cityName}
      cityId={route.city_id}
      cityPlaces={cityPlaces}
      addedPlaceIds={addedPlaceIds}
    />
  );
}

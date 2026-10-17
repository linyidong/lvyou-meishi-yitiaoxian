import Link from 'next/link';
import { FlowSteps } from '@/components/route/FlowSteps';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import {
  RouteAddClient,
  type CityPlaceOption,
} from '@/components/route/RouteAddClient';
import { createClient } from '@/lib/supabase/server';
import type { PlaceType } from '@/types';

/** U06 导入地点（第 3 步）：当前城市收藏 + AI 提取文案，确认后落库并进入 U07 */
export default async function RouteAddPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // middleware.ts 已拦截未登录，这里只做兜底
  if (!user) {
    return (
      <>
        <FlowSteps current={3} />
        <div className="pt-6 md:pt-10">
          <p className="text-sm text-stone-500">
            请先
            <Link href={ROUTES.LOGIN} className="text-primary underline">
              登录
            </Link>
            后导入地点。
          </p>
        </div>
      </>
    );
  }

  const { data: route } = await supabase
    .from('routes')
    .select('id,title,days,city_id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  // 无权限（路线不存在 / 不属于当前账号）
  if (!route) {
    return (
      <>
        <FlowSteps current={3} />
        <div className="pt-6 md:pt-10">
          <section className="rounded-2xl bg-white border border-stone-200 p-8 text-center">
            <p className="font-semibold">{MESSAGES.ROUTE_ADD.deniedTitle}</p>
            <p className="mt-1 text-sm text-stone-500">{MESSAGES.ROUTE_ADD.deniedDesc}</p>
            <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={ROUTES.CITY}
                className="h-10 px-5 rounded-lg bg-primary hover:brightness-110 text-white text-sm font-semibold flex items-center justify-center"
              >
                {MESSAGES.ROUTE_ADD.deniedGo}
              </Link>
            </div>
          </section>
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
    <>
      <FlowSteps current={3} />
      <div className="pt-6 md:pt-10">
        <RouteAddClient
          routeId={route.id}
          cityName={cityName}
          cityId={route.city_id}
          cityPlaces={cityPlaces}
          addedPlaceIds={addedPlaceIds}
        />
      </div>
    </>
  );
}

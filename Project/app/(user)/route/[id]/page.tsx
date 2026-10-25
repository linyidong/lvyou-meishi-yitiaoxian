import Link from 'next/link';
import { EyeOff } from 'lucide-react';
import { FlowSteps } from '@/components/route/FlowSteps';
import { RouteResultClient, type ResultDay, type ResultPlace } from '@/components/route/RouteResultClient';
import { INTERCITY_MODE_LABEL, LODGING_TYPE_LABEL } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { resolveLodgingCoords } from '@/lib/amap';
import { getQuotaProfile } from '@/lib/member-quota';
import { createClient } from '@/lib/supabase/server';
import type { IntercityMode, LodgingType, PlaceType, Transport } from '@/types';

/** U09 路线结果（第 6 步）：按天顺序展示地点 + 示意地图 */
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
      'id,title,days,transport,city_id,origin_city,intercity_mode,lodging_type,lodging_area,lodging_name,lodging_nights,created_at',
    )
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!route) {
    return (
      <>
        <FlowSteps current={6} />
        <div className="pt-6 md:pt-10">
          <div className="rounded-2xl border border-stone-200 bg-white py-16 text-center">
            <EyeOff className="mx-auto h-12 w-12 text-stone-400" />
            <p className="mt-3 font-semibold">{MESSAGES.ROUTE_RESULT.deniedTitle}</p>
            <p className="mt-1 text-sm text-stone-500">{MESSAGES.ROUTE_RESULT.deniedDesc}</p>
            <Link
              href={ROUTES.HOME}
              className="mt-4 inline-flex h-10 items-center rounded-lg bg-gradient-to-r from-primary-from to-primary-to px-5 text-sm font-semibold text-white hover:brightness-110"
            >
              {MESSAGES.ROUTE_RESULT.deniedBack}
            </Link>
          </div>
        </div>
      </>
    );
  }

  let cityName: string | null = null;
  let cityAdcode: string | null = null;
  if (route.city_id) {
    const { data: city } = await supabase
      .from('cities')
      .select('name,adcode')
      .eq('id', route.city_id)
      .maybeSingle();
    cityName = city?.name ?? null;
    // 公交地铁算路需要高德城市编码（adcode）
    cityAdcode = city?.adcode ?? null;
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
      .select('id,name,type,address,note,lat,lng,image_url')
      .in('id', placeIds);
    for (const p of places ?? []) {
      placeById.set(p.id, {
        id: p.id,
        name: p.name,
        type: p.type as PlaceType,
        address: p.address,
        note: p.note,
        lat: p.lat,
        lng: p.lng,
        imageUrl: p.image_url,
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
      ? MESSAGES.ROUTE_RESULT.intercitySame
      : route.intercity_mode
        ? MESSAGES.ROUTE_RESULT.intercityRoute(
            INTERCITY_MODE_LABEL[route.intercity_mode as IntercityMode],
            route.origin_city ?? MESSAGES.ROUTE_RESULT.originNone,
            cityName ?? MESSAGES.ROUTE_RESULT.noCity,
          )
        : MESSAGES.ROUTE_RESULT.intercityNone;

  const lodgingLabel =
    route.lodging_type
      ? [
          LODGING_TYPE_LABEL[route.lodging_type as LodgingType],
          route.lodging_area,
          route.lodging_name,
          route.lodging_nights ? `${route.lodging_nights} 晚` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : MESSAGES.ROUTE_RESULT.lodgingNone;

  // 住宿坐标：用于地图上的住宿标记，以及「当天走完 → 可选交通方式回住宿」
  const lodging = await resolveLodgingCoords({
    name: route.lodging_name,
    area: route.lodging_area,
    city: cityName,
    cityAdcode,
  });

  // 阶段 2 会员分层：只有会员 / 管理员可用「手机高德导航」，游客按钮转锁定态
  const { tier } = await getQuotaProfile(user.id);

  return (
    <>
      <FlowSteps current={6} />
      <div className="pt-6 md:pt-10">
        <RouteResultClient
          routeId={route.id}
          title={route.title}
          cityName={cityName}
          cityAdcode={cityAdcode}
          days={route.days}
          transport={route.transport as Transport}
          originCity={route.origin_city}
          intercityLabel={intercityLabel}
          lodgingLabel={lodgingLabel}
          lodging={lodging}
          resultDays={resultDays}
          totalPlaces={rows.length}
          createdAt={route.created_at}
          canUseAmapNav={tier !== 'free'}
          canExport={tier !== 'free'}
        />
      </div>
    </>
  );
}

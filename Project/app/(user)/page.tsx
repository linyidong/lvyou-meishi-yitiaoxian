import { TRANSPORT_LABEL } from '@/config/enums';
import { ROUTES } from '@/config/routes';
import {
  HomeClient,
  type HomeDraft,
  type HomeRouteItem,
} from '@/components/home/HomeClient';
import { getQuotaProfile } from '@/lib/member-quota';
import { createClient } from '@/lib/supabase/server';
import type { Transport } from '@/types';

/** U02 首页：服务端查登录态 / 最近路线 / 未完成草稿 / 收藏数量，交互交给 HomeClient */
export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let recentRoutes: HomeRouteItem[] = [];
  let draft: HomeDraft | null = null;
  let collectedCount = 0;
  // T-041 「导入分享路线」按钮的会员判定：member 或 role=admin（游客恒为 false）
  let isMember = false;

  if (user) {
    const { tier } = await getQuotaProfile(user.id);
    isMember = tier !== 'free';
    const [routesRes, citiesRes, placesRes] = await Promise.all([
      supabase
        .from('routes')
        .select('id,title,days,transport,city_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase.from('cities').select('id,name'),
      supabase.from('places').select('id').eq('user_id', user.id).eq('is_collected', true),
    ]);

    collectedCount = (placesRes.data ?? []).length;

    const cityNameById = new Map((citiesRes.data ?? []).map((c) => [c.id, c.name]));
    const routes = routesRes.data ?? [];
    const routeIds = routes.map((r) => r.id);

    const routePlaces =
      routeIds.length > 0
        ? (await supabase.from('route_places').select('route_id').in('route_id', routeIds)).data ?? []
        : [];
    const countByRoute = new Map<string, number>();
    for (const rp of routePlaces) {
      countByRoute.set(rp.route_id, (countByRoute.get(rp.route_id) ?? 0) + 1);
    }

    const items: HomeRouteItem[] = routes.map((r) => ({
      id: r.id,
      title: r.title,
      cityName: r.city_id ? cityNameById.get(r.city_id) ?? null : null,
      days: r.days,
      transportLabel: TRANSPORT_LABEL[r.transport as Transport],
      placeCount: countByRoute.get(r.id) ?? 0,
    }));

    recentRoutes = items.filter((r) => r.placeCount > 0).slice(0, 3);

    const unfinished = items.find((r) => r.placeCount === 0);
    if (unfinished) {
      draft = { city: unfinished.cityName, href: ROUTES.ROUTE_PLACES(unfinished.id) };
    }
  }

  return (
    <HomeClient
      isLoggedIn={Boolean(user)}
      recentRoutes={recentRoutes}
      draft={draft}
      collectedCount={collectedCount}
      isMember={isMember}
    />
  );
}

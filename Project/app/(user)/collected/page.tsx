import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ROUTES } from '@/config/routes';
import {
  CollectedClient,
  type CollectedItem,
  type RouteOption,
} from '@/components/collected/CollectedClient';
import type { ImportSource, PlaceType } from '@/types';

/**
 * U11 我的收藏地点（本期新增）
 * 数据模型说明：收藏 = public.places 中 is_collected = true 的行，不另建收藏表；
 * 「加入路线」写 route_places（引用 place_id），因此收藏与路线天然解耦。
 */
export default async function CollectedPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // middleware.ts 已拦截未登录，这里只做兜底
  if (!user) {
    return (
      <p className="text-sm text-muted-foreground">
        请先<Link href={ROUTES.LOGIN} className="text-primary underline">登录</Link>后查看收藏地点。
      </p>
    );
  }

  const [placesRes, citiesRes, routesRes] = await Promise.all([
    supabase
      .from('places')
      .select('id,name,type,note,source,address,city_id,created_at')
      .eq('user_id', user.id)
      .eq('is_collected', true)
      .order('created_at', { ascending: false }),
    supabase.from('cities').select('id,name'),
    supabase
      .from('routes')
      .select('id,title,days,city_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (placesRes.error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="font-semibold text-red-800">收藏地点加载失败</p>
        <p className="mt-1 text-sm text-red-700">{placesRes.error.message}</p>
      </div>
    );
  }

  const cityNameById = new Map((citiesRes.data ?? []).map((c) => [c.id, c.name]));

  const items: CollectedItem[] = (placesRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type as PlaceType,
    cityName: p.city_id ? cityNameById.get(p.city_id) ?? null : null,
    address: p.address,
    source: p.source as ImportSource | null,
    note: p.note,
    createdAt: p.created_at,
  }));

  const routeRows = routesRes.data ?? [];
  const options: RouteOption[] = routeRows.map((r) => ({
    id: r.id,
    title: r.title,
    cityName: r.city_id ? cityNameById.get(r.city_id) ?? null : null,
    days: r.days,
  }));

  // 哪些收藏点已经出现在某条路线里
  let usedPlaceIds: string[] = [];
  if (routeRows.length > 0) {
    const { data: rp } = await supabase
      .from('route_places')
      .select('place_id')
      .in(
        'route_id',
        routeRows.map((r) => r.id),
      );
    usedPlaceIds = (rp ?? []).map((x) => x.place_id);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">我的收藏地点</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          先从分享文案里收藏地点，再挑选加入路线。收藏库保存在你的账号下。
        </p>
      </div>

      <CollectedClient items={items} routes={options} usedPlaceIds={usedPlaceIds} />
    </div>
  );
}

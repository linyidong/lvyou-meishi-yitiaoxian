import Link from 'next/link';
import { ArrowLeft, CloudOff } from 'lucide-react';
import {
  CollectedClient,
  type CollectedItem,
  type RouteOption,
} from '@/components/collected/CollectedClient';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { createClient } from '@/lib/supabase/server';
import type { ImportSource, PlaceType } from '@/types';

const M = MESSAGES.COLLECTED;

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
        请先
        <Link href={ROUTES.LOGIN} className="text-primary underline">
          登录
        </Link>
        后查看收藏地点。
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

  const header = (
    <div className="flex items-start gap-3">
      <Link
        href={ROUTES.HOME}
        aria-label={M.backAria}
        className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-stone-200 bg-white hover:bg-stone-100"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-stone-900 md:text-3xl">{M.title}</h1>
        <p className="mt-1 text-sm text-stone-600">{M.desc}</p>
      </div>
    </div>
  );

  if (placesRes.error) {
    return (
      <div>
        {header}
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <CloudOff className="mx-auto h-9 w-9 text-red-500" />
          <p className="mt-3 font-semibold text-red-800">{M.errorTitle}</p>
          <p className="mt-1 text-sm text-red-700">{M.errorDesc}</p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href={ROUTES.COLLECTED}
              className="flex h-11 items-center justify-center rounded-xl bg-red-600 px-6 font-semibold text-white hover:bg-red-700"
            >
              {M.errorRetry}
            </Link>
            <Link
              href={`${ROUTES.HOME}#importCollect`}
              className="flex h-11 items-center justify-center rounded-xl border border-red-300 px-6 font-medium text-red-700 hover:bg-red-100"
            >
              {M.errorReimport}
            </Link>
          </div>
        </div>
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
      {header}
      <div className="mt-6">
        <CollectedClient items={items} routes={options} usedPlaceIds={usedPlaceIds} />
      </div>
    </div>
  );
}

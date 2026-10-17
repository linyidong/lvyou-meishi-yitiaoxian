import Link from 'next/link';
import {
  INTERCITY_MODE_LABEL,
  LODGING_TYPE_LABEL,
  TRANSPORT_LABEL,
} from '@/config/enums';
import { ROUTES } from '@/config/routes';
import { MyRoutesClient, type MyRouteItem } from '@/components/route/MyRoutesClient';
import { createClient } from '@/lib/supabase/server';
import type { IntercityMode, LodgingType, Transport } from '@/types';

/** U03 我的路线：只读列表，路线仅自己可见 */

/** 出行设置摘要：三项都未填写时返回 null */
function buildTripSummary(row: {
  origin_city: string | null;
  intercity_mode: string | null;
  lodging_type: string | null;
  lodging_area: string | null;
  lodging_name: string | null;
  lodging_nights: number | null;
}): string | null {
  const parts: string[] = [];
  if (row.origin_city) parts.push(`出发 ${row.origin_city}`);
  if (row.intercity_mode) {
    parts.push(INTERCITY_MODE_LABEL[row.intercity_mode as IntercityMode]);
  }
  if (row.lodging_type) {
    parts.push(
      [
        LODGING_TYPE_LABEL[row.lodging_type as LodgingType],
        row.lodging_area,
        row.lodging_name,
        row.lodging_nights ? `${row.lodging_nights} 晚` : null,
      ]
        .filter(Boolean)
        .join(' '),
    );
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

export default async function MyRoutesPage() {
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
        后查看我的路线。
      </p>
    );
  }

  const [routesRes, citiesRes] = await Promise.all([
    supabase
      .from('routes')
      .select(
        'id,title,days,transport,city_id,origin_city,intercity_mode,lodging_type,lodging_area,lodging_name,lodging_nights,created_at',
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.from('cities').select('id,name'),
  ]);

  if (routesRes.error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="font-semibold text-red-800">路线列表加载失败</p>
        <p className="mt-1 text-sm text-red-700">{routesRes.error.message}</p>
      </div>
    );
  }

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

  const cityNameById = new Map((citiesRes.data ?? []).map((c) => [c.id, c.name]));

  const items: MyRouteItem[] = routes.map((r) => ({
    id: r.id,
    title: r.title,
    cityName: r.city_id ? cityNameById.get(r.city_id) ?? null : null,
    days: r.days,
    transportLabel: TRANSPORT_LABEL[r.transport as Transport],
    placeCount: countByRoute.get(r.id) ?? 0,
    createdAt: r.created_at,
    tripSummary: buildTripSummary(r),
  }));

  return <MyRoutesClient routes={items} />;
}

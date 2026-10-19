import { randomBytes } from 'node:crypto';
import { INTERCITY_MODE_LABEL, LODGING_TYPE_LABEL } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  IntercityMode,
  LodgingType,
  PlaceType,
  RouteShareSnapshot,
  Transport,
} from '@/types';

/**
 * 阶段 3 路线分享（服务端专用）：分享令牌生成 + 自包含快照组装。
 *
 * 快照在写库时一次性组装好，分享页 / 长图 / 导入都只看它，
 * 不依赖原路线的归属与 RLS 权限（places 有 owner 级 RLS，导入方不能复用分享者的 place id）。
 * 本文件用到 service_role 客户端，禁止被前端组件引用。
 */

/** 供 /api/routes/[id]/share、/api/shares/[token]/import、分享页服务端读取共用的一句话口径 */
const R = MESSAGES.ROUTE_RESULT;

/** 分享令牌：12 字符左右的 URL 安全随机串（仅服务端生成） */
export function generateShareToken(): string {
  return randomBytes(9).toString('base64url');
}

/** 城际交通展示文案（与 app/(user)/route/[id]/page.tsx 口径一致） */
export function buildIntercityLabel(
  originCity: string | null,
  cityName: string | null,
  intercityMode: IntercityMode | null,
): string {
  if (originCity && originCity === cityName) return R.intercitySame;
  if (intercityMode) {
    return R.intercityRoute(
      INTERCITY_MODE_LABEL[intercityMode],
      originCity ?? R.originNone,
      cityName ?? R.noCity,
    );
  }
  return R.intercityNone;
}

/** 住宿展示文案（与 app/(user)/route/[id]/page.tsx 口径一致） */
export function buildLodgingLabel(input: {
  lodgingType: LodgingType | null;
  lodgingArea: string | null;
  lodgingName: string | null;
  lodgingNights: number | null;
}): string {
  if (!input.lodgingType) return R.lodgingNone;
  return [
    LODGING_TYPE_LABEL[input.lodgingType],
    input.lodgingArea,
    input.lodgingName,
    input.lodgingNights ? `${input.lodgingNights} 晚` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * 组装路线自包含快照。
 * @param routeId 路线 id
 * @param ownerId 该路线归属用户（调用方需自行完成权限校验，这里只做归属过滤）
 */
export async function buildRouteSnapshot(
  routeId: string,
  ownerId: string,
): Promise<RouteShareSnapshot | null> {
  const admin = createAdminClient();

  const { data: route } = await admin
    .from('routes')
    .select(
      'id,user_id,title,days,transport,city_id,origin_city,intercity_mode,lodging_type,lodging_area,lodging_name,lodging_nights',
    )
    .eq('id', routeId)
    .eq('user_id', ownerId)
    .maybeSingle();
  if (!route) return null;

  let cityName: string | null = null;
  if (route.city_id) {
    const { data: city } = await admin
      .from('cities')
      .select('name')
      .eq('id', route.city_id)
      .maybeSingle();
    cityName = city?.name ?? null;
  }

  const { data: rp } = await admin
    .from('route_places')
    .select('place_id,day_index,order_index')
    .eq('route_id', route.id)
    .order('day_index', { ascending: true })
    .order('order_index', { ascending: true });

  const rows = rp ?? [];
  const placeIds = Array.from(new Set(rows.map((r) => r.place_id)));
  const placeById = new Map<
    string,
    { name: string; type: PlaceType; address: string | null; lat: number | null; lng: number | null }
  >();
  if (placeIds.length > 0) {
    const { data: places } = await admin
      .from('places')
      .select('id,name,type,address,lat,lng')
      .in('id', placeIds);
    for (const p of places ?? []) {
      placeById.set(p.id, {
        name: p.name,
        type: p.type as PlaceType,
        address: p.address,
        lat: p.lat === null ? null : Number(p.lat),
        lng: p.lng === null ? null : Number(p.lng),
      });
    }
  }

  const dayPlans: RouteShareSnapshot['dayPlans'] = [];
  for (let day = 0; day < route.days; day += 1) {
    const places = rows
      .filter((r) => r.day_index === day)
      .map((r) => placeById.get(r.place_id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
    dayPlans.push({ dayIndex: day, places });
  }

  return {
    title: route.title,
    cityName,
    days: route.days,
    transport: route.transport as Transport,
    totalPlaces: rows.length,
    originCity: route.origin_city,
    intercityMode: (route.intercity_mode as IntercityMode | null) ?? null,
    intercityLabel: buildIntercityLabel(
      route.origin_city,
      cityName,
      (route.intercity_mode as IntercityMode | null) ?? null,
    ),
    lodgingType: (route.lodging_type as LodgingType | null) ?? null,
    lodgingArea: route.lodging_area,
    lodgingName: route.lodging_name,
    lodgingNights: route.lodging_nights,
    lodgingLabel: buildLodgingLabel({
      lodgingType: (route.lodging_type as LodgingType | null) ?? null,
      lodgingArea: route.lodging_area,
      lodgingName: route.lodging_name,
      lodgingNights: route.lodging_nights,
    }),
    dayPlans,
    exportedAt: new Date().toISOString(),
  };
}

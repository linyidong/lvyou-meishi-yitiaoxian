import { NextResponse, type NextRequest } from 'next/server';
import { MESSAGES } from '@/config/messages';
import { consumeRouteQuota, getQuotaProfile, getRouteQuota, routeQuotaErrorBody } from '@/lib/member-quota';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { PlaceType, RouteSharePlace, RouteShareSnapshot, Transport } from '@/types';

/** T-041 导入模式：route=建成我的路线（默认，占路线额度）；places=只收藏地点（不建路线、不占额度） */
type ImportMode = 'route' | 'places';

/**
 * 阶段 3 分享路线导入（会员功能）
 * POST /api/shares/[token]/import  body: { mode?: 'route' | 'places' }
 * - route：在自己账号下新建路线 + 复制快照里的全部地点，并写 imported_from = token（占路线额度）
 * - places：只做 place find-or-create 并置 is_collected=true，写进收藏夹；不建 route、不占路线额度
 *
 * places 有 owner 级 RLS，不能复用分享者的 place id：按 (user_id + city_id + name)
 * 在自己账号下 find-or-create 地点；route 模式再写 route_places 指向自己的 place id。
 * 写库走 service_role（user_id 为导入者本人，写完后导入者可通过 RLS 读到）。
 */
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: MESSAGES.LOGIN_FIRST }, { status: 401 });
  }
  const userId = user.id;

  // 游客 / 正常用户不可导入（两种模式同样限制）
  const { tier } = await getQuotaProfile(userId);
  if (tier === 'free') {
    return NextResponse.json({ ok: false, message: MESSAGES.SHARE.needMember }, { status: 403 });
  }

  // 解析 body 中的 mode（非法或缺省一律按 route，保持旧客户端行为兼容）
  let mode: ImportMode = 'route';
  try {
    const body = (await request.json().catch(() => null)) as { mode?: unknown } | null;
    if (body && (body.mode === 'route' || body.mode === 'places')) mode = body.mode;
  } catch {
    mode = 'route';
  }

  // route 模式导入同样占用「生成路线」额度（会员每月 5 条），避免从分享链接绕过路线条数上限；管理员不计数
  if (mode === 'route' && tier !== 'admin') {
    const routeQuota = await getRouteQuota(userId, tier);
    if (routeQuota.remaining <= 0) {
      return NextResponse.json({ ok: false, ...routeQuotaErrorBody(routeQuota) }, { status: 429 });
    }
  }

  try {
    const admin = createAdminClient();
    const { data: share } = await admin
      .from('route_shares')
      .select('snapshot')
      .eq('token', params.token)
      .is('revoked_at', null)
      .maybeSingle();
    if (!share) {
      return NextResponse.json({ ok: false, message: MESSAGES.SHARE.importNotFound }, { status: 404 });
    }

    const snapshot = share.snapshot as RouteShareSnapshot;
    if (!snapshot || !Array.isArray(snapshot.dayPlans)) {
      return NextResponse.json({ ok: false, message: MESSAGES.SHARE.importFailed }, { status: 400 });
    }

    // 城市：能从快照 cityName 匹配到 cities 就带上，否则 null
    let cityId: string | null = null;
    if (snapshot.cityName) {
      const { data: city } = await admin
        .from('cities')
        .select('id')
        .eq('name', snapshot.cityName)
        .maybeSingle();
      cityId = city?.id ?? null;
    }

    // 快照里的全部地点（按天顺序展平）
    const snapshotPlaces: RouteSharePlace[] = [];
    for (const day of snapshot.dayPlans) {
      for (const p of day.places ?? []) snapshotPlaces.push(p);
    }

    // 去重键：user_id（固定为本人） + city_id + name
    const keyOf = (city: string | null, name: string) => `${city ?? ''}|${name}`;
    const placeIdByKey = new Map<string, string>();
    const { data: existing } = await admin.from('places').select('id,name,city_id').eq('user_id', userId);
    for (const p of existing ?? []) {
      placeIdByKey.set(keyOf(p.city_id, p.name), p.id);
    }

    /** 收集模式专用的 is_collected 更新：已存在的地点也要置为已收藏 */
    const collectedIds = new Set<string>();

    async function resolvePlaceId(place: RouteSharePlace, collect: boolean): Promise<string | null> {
      const key = keyOf(cityId, place.name);
      const cached = placeIdByKey.get(key);
      if (cached) {
        if (collect) collectedIds.add(cached);
        return cached;
      }
      const { data, error } = await admin
        .from('places')
        .insert({
          user_id: userId,
          city_id: cityId,
          name: place.name,
          type: place.type as PlaceType,
          address: place.address,
          lat: place.lat,
          lng: place.lng,
          ...(collect ? { is_collected: true } : {}),
        })
        .select('id')
        .single();
      if (error || !data) return null;
      placeIdByKey.set(key, data.id);
      if (collect) collectedIds.add(data.id);
      return data.id;
    }

    // ============ places 模式：只写收藏夹，不建路线、不占路线额度 ============
    if (mode === 'places') {
      let placesCount = 0;
      for (const place of snapshotPlaces) {
        const placeId = await resolvePlaceId(place, true);
        if (!placeId) {
          return NextResponse.json({ ok: false, message: MESSAGES.SHARE.importFailed }, { status: 500 });
        }
        placesCount += 1;
      }
      // 命中的已有地点批量置为已收藏（新建的已在 insert 时带上）
      if (collectedIds.size > 0) {
        const { error: upError } = await admin
          .from('places')
          .update({ is_collected: true })
          .in('id', Array.from(collectedIds));
        if (upError) {
          return NextResponse.json({ ok: false, message: MESSAGES.SHARE.importFailed }, { status: 500 });
        }
      }
      return NextResponse.json({ ok: true, mode, placesCount });
    }

    // ============ route 模式：保持原行为 + imported_from 标记 ============
    const { data: createdRoute, error: routeError } = await admin
      .from('routes')
      .insert({
        user_id: userId,
        city_id: cityId,
        title: snapshot.title,
        days: snapshot.days,
        transport: snapshot.transport as Transport,
        origin_city: snapshot.originCity,
        intercity_mode: snapshot.intercityMode ?? null,
        lodging_type: snapshot.lodgingType ?? null,
        lodging_area: snapshot.lodgingArea ?? null,
        lodging_name: snapshot.lodgingName ?? null,
        lodging_nights: snapshot.lodgingNights ?? null,
        imported_from: params.token,
      })
      .select('id')
      .single();
    if (routeError || !createdRoute) {
      return NextResponse.json({ ok: false, message: MESSAGES.SHARE.importFailed }, { status: 500 });
    }

    const routePlaces: {
      route_id: string;
      place_id: string;
      day_index: number;
      order_index: number;
    }[] = [];

    let placeCursor = 0;
    for (const day of snapshot.dayPlans) {
      const dayIndex = Number.isInteger(day.dayIndex) ? day.dayIndex : 0;
      for (let i = 0; i < (day.places ?? []).length; i += 1) {
        const placeId = await resolvePlaceId(day.places[i], false);
        if (!placeId) {
          // 关联写入失败时回滚已建的路线（cascade 清掉半截 route_places），避免留下空壳路线
          await admin.from('routes').delete().eq('id', createdRoute.id);
          return NextResponse.json({ ok: false, message: MESSAGES.SHARE.importFailed }, { status: 500 });
        }
        routePlaces.push({
          route_id: createdRoute.id,
          place_id: placeId,
          day_index: dayIndex,
          order_index: i,
        });
        placeCursor += 1;
      }
    }

    if (routePlaces.length > 0) {
      const { error: rpError } = await admin.from('route_places').insert(routePlaces);
      if (rpError) {
        await admin.from('routes').delete().eq('id', createdRoute.id);
        return NextResponse.json({ ok: false, message: MESSAGES.SHARE.importFailed }, { status: 500 });
      }
    }

    // 计数放在成功后：导入也占「生成路线」额度，管理员不计数
    if (tier !== 'admin') {
      await consumeRouteQuota(userId, tier);
    }

    return NextResponse.json({ ok: true, mode, routeId: createdRoute.id, placesCount: placeCursor });
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.SHARE.importFailed }, { status: 500 });
  }
}

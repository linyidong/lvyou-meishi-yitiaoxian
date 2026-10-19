import { NextResponse, type NextRequest } from 'next/server';
import { MESSAGES } from '@/config/messages';
import { consumeRouteQuota, getQuotaProfile, getRouteQuota, routeQuotaErrorBody } from '@/lib/member-quota';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { PlaceType, RouteSharePlace, RouteShareSnapshot, Transport } from '@/types';

/**
 * 阶段 3 分享路线导入（会员功能）
 * POST /api/shares/[token]/import → 在自己账号下新建路线 + 复制快照里的全部地点
 *
 * places 有 owner 级 RLS，不能复用分享者的 place id：按 (user_id + city_id + name)
 * 在自己账号下 find-or-create 地点，再写 route_places 指向自己的 place id。
 * 写库走 service_role（user_id 为导入者本人，写完后导入者可通过 RLS 读到）。
 */
export async function POST(_request: NextRequest, { params }: { params: { token: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: MESSAGES.LOGIN_FIRST }, { status: 401 });
  }
  const userId = user.id;

  // 游客 / 免费用户不可导入
  const { tier } = await getQuotaProfile(userId);
  if (tier === 'free') {
    return NextResponse.json({ ok: false, message: MESSAGES.SHARE.needMember }, { status: 403 });
  }

  // 导入同样占用「生成路线」额度（会员每月 10 条），避免从分享链接绕过路线条数上限；管理员不计数
  if (tier !== 'admin') {
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

    // 新建路线（复制 title / days / transport / origin_city / 城际交通 / 住宿设置）
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
      })
      .select('id')
      .single();
    if (routeError || !createdRoute) {
      return NextResponse.json({ ok: false, message: MESSAGES.SHARE.importFailed }, { status: 500 });
    }

    // 去重键：user_id（固定为本人） + city_id + name
    const keyOf = (city: string | null, name: string) => `${city ?? ''}|${name}`;
    const placeIdByKey = new Map<string, string>();
    const { data: existing } = await admin.from('places').select('id,name,city_id').eq('user_id', userId);
    for (const p of existing ?? []) {
      placeIdByKey.set(keyOf(p.city_id, p.name), p.id);
    }

    async function resolvePlaceId(place: RouteSharePlace): Promise<string | null> {
      const key = keyOf(cityId, place.name);
      const cached = placeIdByKey.get(key);
      if (cached) return cached;
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
        })
        .select('id')
        .single();
      if (error || !data) return null;
      placeIdByKey.set(key, data.id);
      return data.id;
    }

    const routePlaces: {
      route_id: string;
      place_id: string;
      day_index: number;
      order_index: number;
    }[] = [];

    for (const day of snapshot.dayPlans) {
      const dayIndex = Number.isInteger(day.dayIndex) ? day.dayIndex : 0;
      for (let i = 0; i < day.places.length; i += 1) {
        const placeId = await resolvePlaceId(day.places[i]);
        if (!placeId) {
          return NextResponse.json({ ok: false, message: MESSAGES.SHARE.importFailed }, { status: 500 });
        }
        routePlaces.push({
          route_id: createdRoute.id,
          place_id: placeId,
          day_index: dayIndex,
          order_index: i,
        });
      }
    }

    if (routePlaces.length > 0) {
      const { error: rpError } = await admin.from('route_places').insert(routePlaces);
      if (rpError) {
        // 关联写入失败时回滚已建的路线（cascade 清掉半截 route_places），避免留下空壳路线
        await admin.from('routes').delete().eq('id', createdRoute.id);
        return NextResponse.json({ ok: false, message: MESSAGES.SHARE.importFailed }, { status: 500 });
      }
    }

    // 计数放在成功后：导入也占「生成路线」额度，管理员不计数
    if (tier !== 'admin') {
      await consumeRouteQuota(userId, tier);
    }

    return NextResponse.json({ ok: true, routeId: createdRoute.id });
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.SHARE.importFailed }, { status: 500 });
  }
}

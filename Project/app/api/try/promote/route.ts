import { NextResponse, type NextRequest } from 'next/server';
import { BUSINESS } from '@/config/business';
import { GEO_STATUS, LODGING_TYPE, PLACE_TYPE, QUOTA_ERROR, TRANSPORT } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { consumeRouteQuota, getQuotaProfile, getRouteQuota, limitsOf, routeQuotaErrorBody } from '@/lib/member-quota';
import { createClient } from '@/lib/supabase/server';
import type { LodgingType, PlaceType, Transport } from '@/types';

/**
 * 游客试用 · 草稿转正（登录后：把 sessionStorage 草稿落库成当前登录用户的真实路线）。
 * POST /api/try/promote
 * body: {
 *   cityId?: string, cityName?: string, cityAdcode?: string,
 *   title: string, transport: string,
 *   lodgingName?: string, lodgingArea?: string,
 *   places: { name, type, lat, lng, address?, imageUrl? }[]  // 按结果页顺序
 * }
 * resp: { ok: true, routeId: string }
 *
 * 复用既有约定：
 * - 字段与 POST /api/routes 对齐（days=1，transport 取草稿）；
 * - 配额按当前档位强制：免费按天（每天 1 条）、会员按月（每月 5 条），成功后累加对应计数桶；
 *   地点数再校验一次当前档位单日上限（免费 = FREE_MAX_PLACES_PER_DAY）；
 * - places 按 user_id + city_id + name 去重（同 POST /api/places 与分享导入的 find-or-create）；
 * - route_places 顺序照抄分享导入：day_index=0、order_index 从 0 递增，住宿点不占号位；
 * - 草稿里已有坐标，全程不调高德（不消耗额度），也不重算排序。
 * 任一步失败回滚：删本请求新建的 places、删刚建的 route（级联清 route_places），不留半条路线。
 */

const PLACE_TYPE_VALUES: readonly string[] = Object.values(PLACE_TYPE);
const TRANSPORT_VALUES: readonly string[] = Object.values(TRANSPORT);

interface PlaceInput {
  name?: unknown;
  type?: unknown;
  lat?: unknown;
  lng?: unknown;
  address?: unknown;
  imageUrl?: unknown;
}

function nullableText(value: unknown): string | null {
  const t = typeof value === 'string' ? value.trim() : '';
  return t.length > 0 ? t : null;
}

/**
 * 服务端短期幂等（T-054/R4：登记前置为 in-flight）：
 * 同一用户 15 秒窗口内用完全相同的草稿重复提交——第一个请求先登记 in-flight Promise，
 * 并发请求 await 同一结果（只成功一次、不产生重复路线）；leader 失败则删除登记，
 * 后续请求自行重试。进程内 Map 跨实例无效（与 known-issues B2 同根因，已在汇报备案）。
 */
const PROMOTE_DEDUPE_MS = 15_000;
interface PromoteOutcome {
  status: number;
  body: Record<string, unknown>;
}
const recentPromotions = new Map<string, { signature: string; at: number; outcome: Promise<PromoteOutcome> }>();

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: MESSAGES.LOGIN_FIRST }, { status: 401 });
  }

  let body: {
    cityId?: unknown;
    cityName?: unknown;
    title?: unknown;
    transport?: unknown;
    lodgingName?: unknown;
    lodgingArea?: unknown;
    places?: unknown;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  // 标题：取草稿，受 B14 长度约束，空则报错
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, BUSINESS.MAX_ROUTE_TITLE_LENGTH) : '';
  if (!title) {
    return NextResponse.json({ ok: false, message: MESSAGES.ROUTE_TITLE_REQUIRED }, { status: 400 });
  }

  const transportRaw = body.transport;
  if (typeof transportRaw !== 'string' || !TRANSPORT_VALUES.includes(transportRaw)) {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  // 城市可空：优先 cityId（校验存在），否则按 cityName 到内置城市表解析，避免外键报错
  let cityId: string | null = null;
  if (typeof body.cityId === 'string' && body.cityId) {
    const { data: city } = await supabase.from('cities').select('id').eq('id', body.cityId).maybeSingle();
    cityId = city?.id ?? null;
  }
  if (!cityId) {
    const cityName = typeof body.cityName === 'string' ? body.cityName.trim() : '';
    if (cityName) {
      const { data: city } = await supabase.from('cities').select('id').eq('name', cityName).maybeSingle();
      cityId = city?.id ?? null;
    }
  }

  // 地点：按草稿顺序（结果页已排好序），只做字段校验，不重排、不调高德
  if (!Array.isArray(body.places) || body.places.length === 0) {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }
  if (body.places.length > BUSINESS.MAX_PLACES_PER_ROUTE) {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  const items: {
    name: string;
    type: PlaceType;
    lat: number;
    lng: number;
    address: string | null;
    imageUrl: string | null;
  }[] = [];
  for (const raw of body.places as PlaceInput[]) {
    const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
    const type = raw?.type;
    const lat = typeof raw?.lat === 'number' ? raw.lat : NaN;
    const lng = typeof raw?.lng === 'number' ? raw.lng : NaN;
    if (!name || typeof type !== 'string' || !PLACE_TYPE_VALUES.includes(type)) {
      return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
    }
    items.push({
      name,
      type: type as PlaceType,
      lat,
      lng,
      address: nullableText(raw?.address),
      imageUrl: nullableText(raw?.imageUrl),
    });
  }

  // 幂等：完全相同的草稿在窗口内重复提交，直接复用上次结果，不重复建路线
  const now = Date.now();
  for (const [k, v] of recentPromotions) {
    if (now - v.at >= PROMOTE_DEDUPE_MS) recentPromotions.delete(k);
  }
  const signature = `${cityId ?? ''}|${title}|${transportRaw}|${items.map((it) => it.name).join('\u0001')}`;
  const prev = recentPromotions.get(user.id);
  if (prev && prev.signature === signature && now - prev.at < PROMOTE_DEDUPE_MS) {
    // T-054：prev 可能是 in-flight（leader 仍在执行）——await 同一结果而非直接复用字段
    const shared = await prev.outcome;
    if (shared.status === 200) {
      return NextResponse.json({ ...shared.body, deduped: true });
    }
    // 前一次尝试失败：不复用失败结果，本请求继续自行执行
  }

  // T-054：登记前置为 in-flight。此后所有出口必须经 finish() 兑现 Promise，避免并发等待方悬挂。
  let settle!: (o: PromoteOutcome) => void;
  const outcome = new Promise<PromoteOutcome>((resolve) => {
    settle = resolve;
  });
  const record = { signature, at: Date.now(), outcome };
  recentPromotions.set(user.id, record);

  const finish = (status: number, body: Record<string, unknown>): NextResponse => {
    const ok = status === 200 && body.ok === true;
    if (ok) {
      // 成功：保留登记供窗口内重试复用，窗口起点刷新为完成时刻
      recentPromotions.set(user.id, { ...record, at: Date.now() });
    } else if (recentPromotions.get(user.id) === record) {
      // 失败：删除登记，允许后续请求自行重试
      recentPromotions.delete(user.id);
    }
    settle({ status, body });
    return NextResponse.json(body, { status });
  };

  try {
    // ==================== 配额（服务端强制，口径照抄 POST /api/routes） ====================
    // 管理员：不校验、不计数；会员 / 免费：按档位校验（免费按天、会员按月）。
    const { tier } = await getQuotaProfile(user.id);
    const limits = limitsOf(tier);
    if (tier !== 'admin') {
      const routeQuota = await getRouteQuota(user.id, tier);
      if (routeQuota.remaining <= 0) {
        return finish(429, { ok: false, ...routeQuotaErrorBody(routeQuota) });
      }
      if (items.length > limits.placesPerDay) {
        return finish(403, {
          ok: false,
          code: QUOTA_ERROR.PLACES_PER_DAY_LIMIT,
          message: MESSAGES.ROUTE_DAY_PLACES_LIMIT(limits.placesPerDay),
          maxPerDay: items.length,
        });
      }
    }

    // ==================== 落库（失败即回滚，不留半条路线） ====================
    /** 本请求新建的 places（回滚时删除；已存在的复用记录不动） */
    const createdPlaceIds: string[] = [];
    const rollbackPlaces = async () => {
      if (createdPlaceIds.length > 0) {
        await supabase.from('places').delete().in('id', createdPlaceIds);
      }
    };

    // a) places：按 user_id + city_id + name 去重，已存在复用，不存在才插入
    const keyOf = (city: string | null, name: string) => `${city ?? ''}|${name}`;
    const placeIdByKey = new Map<string, string>();
    const { data: existing, error: readError } = await supabase
      .from('places')
      .select('id,name,city_id')
      .eq('user_id', user.id);
    if (readError) {
      return finish(500, { ok: false, message: MESSAGES.NETWORK_ERROR });
    }
    for (const p of existing ?? []) {
      placeIdByKey.set(keyOf(p.city_id, p.name), p.id);
    }

    for (const it of items) {
      const key = keyOf(cityId, it.name);
      if (placeIdByKey.has(key)) continue;
      const { data, error } = await supabase
        .from('places')
        .insert({
          user_id: user.id,
          city_id: cityId,
          name: it.name,
          type: it.type,
          address: it.address,
          lat: it.lat,
          lng: it.lng,
          image_url: it.imageUrl,
          is_collected: true,
          geo_status: GEO_STATUS.MATCHED,
        })
        .select('id')
        .single();
      if (error || !data) {
        await rollbackPlaces();
        return finish(500, { ok: false, message: MESSAGES.NETWORK_ERROR });
      }
      placeIdByKey.set(key, data.id);
      createdPlaceIds.push(data.id);
    }

    // b) routes：单日路线，字段与默认值对齐 POST /api/routes；住宿文本取草稿（无类型时按「其他」落库，便于结果页展示）
    const lodgingName = nullableText(body.lodgingName);
    const lodgingArea = nullableText(body.lodgingArea);
    const hasLodging = Boolean(lodgingName || lodgingArea);
    const { data: routeRow, error: routeError } = await supabase
      .from('routes')
      .insert({
        user_id: user.id,
        city_id: cityId,
        title,
        days: 1,
        transport: transportRaw as Transport,
        lodging_type: hasLodging ? (LODGING_TYPE.OTHER as LodgingType) : null,
        lodging_name: lodgingName,
        lodging_area: lodgingArea,
      })
      .select('id')
      .single();
    if (routeError || !routeRow) {
      await rollbackPlaces();
      return finish(500, { ok: false, message: MESSAGES.NETWORK_ERROR });
    }

    // c) route_places：按草稿顺序写入，day_index=0、order_index 从 0 递增（住宿点不占号位，照抄分享导入）
    const routePlaces = items.map((it, index) => ({
      route_id: routeRow.id,
      place_id: placeIdByKey.get(keyOf(cityId, it.name)) as string,
      day_index: 0,
      order_index: index,
    }));
    const { error: rpError } = await supabase.from('route_places').insert(routePlaces);
    if (rpError) {
      // 关联写入失败：删刚建的路线（级联清 route_places），再清掉本请求新建的 places
      await supabase.from('routes').delete().eq('id', routeRow.id);
      await rollbackPlaces();
      return finish(500, { ok: false, message: MESSAGES.NETWORK_ERROR });
    }

    // 计数放在成功后：仅会员 / 免费，管理员不计数
    if (tier !== 'admin') {
      await consumeRouteQuota(user.id, tier);
    }

    return finish(200, { ok: true, routeId: routeRow.id });
  } catch {
    // 异常兜底：兑现 500 并删除登记，避免并发等待方悬挂（常规失败路径已由 finish 处理）
    return finish(500, { ok: false, message: MESSAGES.NETWORK_ERROR });
  }
}

import { NextResponse, type NextRequest } from 'next/server';
import { BUSINESS } from '@/config/business';
import { PLACE_TYPE, USER_ROLE } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { searchPlaces } from '@/lib/amap';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { PlaceType } from '@/types';

/**
 * A09 一键补充示例数据（仅管理员，幂等，可重复执行）
 * POST /api/admin/seed-demo             → 为 92 座城市补示例地点
 * POST /api/admin/seed-demo?cities=成都,重庆 → 只补指定城市（重复执行时用于局部补齐）
 *
 * 为什么要这个接口：库里有地点的城市太少时，游客试用在 U02 选城市会大面积置灰。
 * 这里按城市用高德文本搜索拉「风景名胜 + 美食」两批 POI，落成 is_collected = true
 * 的示例地点，归属发起请求的管理员账号（与 016 的示例数据同一口径，游客读的是
 * 跨用户 is_collected 汇总池，所以谁拥有不影响使用）。
 *
 * 省额度：全程走 lib/amap.ts 的 searchPlaces —— 串行 ≥350ms、Key 池轮询、
 *        结果落库缓存 30 天；重复执行命中缓存**不再消耗高德额度**。
 * 幂等：同账号 + 同城市 + 同名 已存在则跳过，不会产生重复地点。
 */

/** 每座城市抓取的示例地点条数（够免费档单日 6 地点、会员档单日 12 地点用） */
const ATTRACTION_PER_CITY = 8;
const FOOD_PER_CITY = 6;
/** 首轮关键词返回空时的兜底关键词（部分小城对「风景名胜」这类类目词不敏感） */
const CATEGORIES: ReadonlyArray<{
  keyword: string;
  fallback: string;
  type: PlaceType;
  limit: number;
}> = [
  { keyword: '风景名胜', fallback: '景点', type: PLACE_TYPE.ATTRACTION, limit: ATTRACTION_PER_CITY },
  { keyword: '美食', fallback: '餐厅', type: PLACE_TYPE.FOOD, limit: FOOD_PER_CITY },
];

export const dynamic = 'force-dynamic';
export const maxDuration = 800;

/**
 * PostgREST 单次响应默认最多返回 1000 行（supabase-js 的 .select() 不带 range 时
 * 就受此限制，且**不会报错**，只会静默截断）。示例数据规模已远超 1000 行，
 * 「已覆盖城市」「已存在地点」这类需要取全量的查询必须显式分页，否则会把已经
 * 有数据的城市误判为空城、把已经存在的同名地点判为新地点，从而重复插入。
 */
const PG_PAGE = 1000;

async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PG_PAGE) {
    const { data, error } = await build(from, from + PG_PAGE - 1);
    if (error || !data) break;
    out.push(...data);
    if (data.length < PG_PAGE) break;
  }
  return out;
}

interface SeedRow {
  user_id: string;
  city_id: string;
  name: string;
  address: string;
  type: PlaceType;
  source: 'manual';
  is_collected: true;
  geo_status: 'matched';
  lat: number;
  lng: number;
  image_url: string | null;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: MESSAGES.LOGIN_FIRST }, { status: 401 });
  }
  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== USER_ROLE.ADMIN) {
    return NextResponse.json({ ok: false, message: MESSAGES.FORBIDDEN }, { status: 403 });
  }

  const admin = createAdminClient();
  const only = (request.nextUrl.searchParams.get('cities') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  let cityQuery = admin.from('cities').select('id,name,adcode').order('name');
  if (only.length) cityQuery = cityQuery.in('name', only);
  const { data: cityRows, error: cityError } = await cityQuery;
  if (cityError) {
    return NextResponse.json({ ok: false, message: cityError.message }, { status: 500 });
  }

  /**
   * 默认只补「一个示例地点都没有」的城市。
   * 原因：高德文本搜索对同一城市的关键词结果在不同次调用间会小幅轮换（同一城市两次
   * 取到的 top 榜单并不完全一致），若对已有数据的城市重复执行，会不断追加近义重复地点。
   * 需要重扫已有数据的城市时显式传 ?force=1（或 ?cities=指定城市）。
   * 判定口径与游客试用一致：is_collected = true 的地点（任意账号）都算「该城已有数据」。
   */
  const force = request.nextUrl.searchParams.get('force') === '1';
  let targets = cityRows ?? [];
  if (!only.length && !force) {
    const covered = await fetchAll<{ city_id: string }>((from, to) =>
      admin
        .from('places')
        .select('city_id')
        .eq('is_collected', true)
        .order('id')
        .range(from, to),
    );
    const coveredIds = new Set(covered.map((p) => p.city_id));
    targets = targets.filter((c) => !coveredIds.has(c.id));
  }
  if (targets.length === 0) {
    return NextResponse.json({ ok: true, cityCount: 0, inserted: 0, perCity: [], emptyCities: [] });
  }

  /** 已存在的地点（示例数据属主）：「城市 + 名称」作为幂等键 */
  const { data: ownerRow } = await admin
    .from('users')
    .select('id')
    .eq('email', BUSINESS.ADMIN_EMAIL)
    .maybeSingle();
  const ownerId = ownerRow?.id ?? user.id;
  const existing = await fetchAll<{ name: string; city_id: string }>((from, to) =>
    admin
      .from('places')
      .select('name,city_id')
      .eq('user_id', ownerId)
      .order('id')
      .range(from, to),
  );
  const seen = new Set(existing.map((p) => `${p.city_id}\u0000${p.name}`));

  const rows: SeedRow[] = [];
  const perCity: Array<{ city: string; added: number; fetched: number }> = [];

  for (const city of targets) {
    let added = 0;
    let fetched = 0;
    for (const category of CATEGORIES) {
      let pois: Awaited<ReturnType<typeof searchPlaces>> = [];
      try {
        // T-058：带城市 adcode 锁定搜索范围，防止示例数据串城
        pois = await searchPlaces(category.keyword, city.name, city.adcode);
        if (pois.length === 0) pois = await searchPlaces(category.fallback, city.name, city.adcode);
      } catch (err) {
        // 单个城市/关键词失败不影响整体，继续下一批
        console.warn(`[seed-demo] ${city.name} / ${category.keyword} 拉取失败：`, err);
        continue;
      }
      fetched += pois.length;

      let taken = 0;
      for (const poi of pois) {
        if (taken >= category.limit) break;
        const name = poi.name.trim();
        const key = `${city.id}\u0000${name}`;
        if (!name || seen.has(key)) continue;
        if (!Number.isFinite(poi.lat) || !Number.isFinite(poi.lng)) continue;
        seen.add(key);
        taken += 1;
        added += 1;
        rows.push({
          user_id: ownerId,
          city_id: city.id,
          name,
          address: poi.address || name,
          type: category.type,
          source: 'manual',
          is_collected: true,
          geo_status: 'matched',
          lat: poi.lat,
          lng: poi.lng,
          image_url: poi.imageUrl ?? null,
        });
      }
    }
    perCity.push({ city: city.name, added, fetched });
  }

  /** 分批写入，避免单次请求体过大 */
  const CHUNK = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await admin.from('places').insert(chunk);
    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message, inserted, cities: perCity },
        { status: 500 },
      );
    }
    inserted += chunk.length;
  }

  const empty = perCity.filter((c) => c.fetched === 0).map((c) => c.city);
  return NextResponse.json({
    ok: true,
    cityCount: targets.length,
    inserted,
    /** 两批关键词都没搜到 POI 的城市（可能城市名在高德里对不上，需要人工核对） */
    emptyCities: empty,
    perCity,
  });
}

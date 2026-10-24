import { NextResponse, type NextRequest } from 'next/server';
import { BUSINESS } from '@/config/business';
import { CITIES } from '@/config/cities';
import { GEO_STATUS, IMPORT_SOURCE, IMPORT_STATUS, PLACE_TYPE } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { searchPlaces, resolveCityAdcode } from '@/lib/amap';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { ImportSource, PlaceType } from '@/types';

/**
 * U06 批量写入地点（AI 提取结果 / 手动添加统一走这里）
 * POST /api/places
 * body: { routeId?, cityId?, cityName?, source?, rawText?, items: { name, type, note? }[] }
 *
 * 城市归属：优先取 cityId；只给了 cityName（AI 从文案里识别出的城市）时，
 * 到内置城市表 public.cities 里按名称解析出 city_id，地点与美食都归到该城市下。
 *
 * 写入前调高德文本搜索补经纬度与地址（geo_status：matched / unmatched / pending），
 * 补不到不阻断收藏，U09 结果页的示意图只在有坐标时才画站点与站间距离。
 *
 * 只写 places（is_collected = true，进入收藏库）与可选的 imports 记录；
 * 是否加入路线由 U07 勾选后经 PUT /api/routes/[id]/places 完成。
 */

const PLACE_TYPE_VALUES: readonly string[] = Object.values(PLACE_TYPE);
const IMPORT_SOURCE_VALUES: readonly string[] = Object.values(IMPORT_SOURCE);

/** 单次导入并发调用高德的上限，避免瞬时打满配额 */
const GEOCODE_CONCURRENCY = 4;

interface ItemInput {
  name?: unknown;
  type?: unknown;
  note?: unknown;
}

/** 高德补坐标结果 */
interface Geocoded {
  lat: number | null;
  lng: number | null;
  address: string | null;
  /** 高德 POI 首张照片地址（U09 路线站点缩略图），取不到为 null */
  imageUrl: string | null;
  status: string;
}

const GEO_EMPTY: Geocoded = {
  lat: null,
  lng: null,
  address: null,
  imageUrl: null,
  status: GEO_STATUS.PENDING,
};

/**
 * 用高德文本搜索补经纬度、地址与照片（技术方案 v1.1 §4.4）。
 * 搜到 → matched，带回高德地址与照片；搜不到 → unmatched；
 * 高德调用失败（网络 / 额度）→ pending，都不阻断收藏，留给后续重试。
 */
async function geocodeOne(name: string, city: string): Promise<Geocoded> {
  try {
    const [hit] = await searchPlaces(name, city);
    if (!hit) return { ...GEO_EMPTY, status: GEO_STATUS.UNMATCHED };
    return {
      lat: hit.lat,
      lng: hit.lng,
      address: hit.address || null,
      imageUrl: hit.imageUrl,
      status: GEO_STATUS.MATCHED,
    };
  } catch {
    return GEO_EMPTY;
  }
}

/** 分批并发补坐标，返回顺序与入参一致 */
async function geocodeAll(list: { name: string }[], city: string): Promise<Geocoded[]> {
  const out: Geocoded[] = [];
  for (let i = 0; i < list.length; i += GEOCODE_CONCURRENCY) {
    out.push(
      ...(await Promise.all(
        list.slice(i, i + GEOCODE_CONCURRENCY).map((it) => geocodeOne(it.name, city)),
      )),
    );
  }
  return out;
}

/**
 * T-042：AI 识别出的新城市自动加入 public.cities。
 * cities 表 RLS 只有 SELECT 策略，写入走 service_role 客户端；
 * adcode 优先取 config/cities.ts 已核实的编码（保证与种子迁移一致，如喀什=653101），
 * 不在 config 里再用高德 config/district 解析（返回名与查询词完全一致才采用），
 * 解析不到写空串（字段 NOT NULL 但允许空串；注意 adcode 有唯一索引，
 * 两个都解析失败的空串行会冲突，此时按插入失败降级）。
 * 并发插入撞 name 唯一索引时按名称回查兜底。
 * 返回新（或已存在的）城市 id；确实写不进返回 null，由调用方降级为「地点已收藏但无城市」。
 */
async function ensureCityInDb(name: string): Promise<string | null> {
  const admin = createAdminClient();
  const adcode = CITIES.find((c) => c.name === name)?.adcode ?? (await resolveCityAdcode(name));

  const { data: inserted, error } = await admin
    .from('cities')
    .insert({ name, adcode })
    .select('id')
    .maybeSingle();
  if (!error && inserted) return inserted.id as string;

  // 唯一索引冲突多半是并发同名插入：按名称回查
  const { data: existing } = await admin
    .from('cities')
    .select('id')
    .eq('name', name)
    .maybeSingle();
  return (existing?.id as string) ?? null;
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: '请先登录' }, { status: 401 });
  }

  let body: {
    routeId?: unknown;
    cityId?: unknown;
    cityName?: unknown;
    source?: unknown;
    rawText?: unknown;
    items?: unknown;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }
  if (body.items.length > BUSINESS.MAX_AI_EXTRACT) {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  const items: { name: string; type: PlaceType; note: string | null }[] = [];
  for (const raw of body.items as ItemInput[]) {
    const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
    const type = raw?.type;
    if (!name || typeof type !== 'string' || !PLACE_TYPE_VALUES.includes(type)) {
      return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
    }
    const note = typeof raw?.note === 'string' ? raw.note.trim() : '';
    items.push({ name, type: type as PlaceType, note: note || null });
  }

  // 城市归属：优先用传入的 cityId，其次按城市名到内置城市表解析
  let cityId = typeof body.cityId === 'string' && body.cityId ? body.cityId : null;
  const cityName = typeof body.cityName === 'string' ? body.cityName.trim() : '';
  let cityMatched = true;
  if (!cityId && cityName) {
    const { data: cityRow, error: cityError } = await supabase
      .from('cities')
      .select('id')
      .eq('name', cityName)
      .maybeSingle();
    if (cityError) {
      return NextResponse.json({ ok: false, message: MESSAGES.NETWORK_ERROR }, { status: 500 });
    }
    if (cityRow) {
      cityId = cityRow.id;
    } else {
      // T-042：城市不在城市库里 → 自动解析 adcode 并插入 cities，再按新城市归属地点
      const newCityId = await ensureCityInDb(cityName);
      if (newCityId) {
        cityId = newCityId;
      } else {
        // 自动入库失败：地点照常收藏，但城市为空，前端据此提示用户
        cityMatched = false;
      }
    }
  }

  // 高德搜索要带上城市名，结果才准；只有 cityId（如从路线页添加）时按 id 回查一次
  let geoCity = cityName;
  if (!geoCity && cityId) {
    const { data: cityRow } = await supabase
      .from('cities')
      .select('name')
      .eq('id', cityId)
      .maybeSingle();
    geoCity = cityRow?.name ?? '';
  }

  const sourceRaw = body.source;
  const source: ImportSource | null =
    typeof sourceRaw === 'string' && IMPORT_SOURCE_VALUES.includes(sourceRaw)
      ? (sourceRaw as ImportSource)
      : null;

  const rawText = typeof body.rawText === 'string' ? body.rawText.trim() : '';

  // 同一用户 + 同城市下按 name 去重
  const { data: existing, error: readError } = await supabase
    .from('places')
    .select('name,city_id')
    .eq('user_id', user.id);
  if (readError) {
    return NextResponse.json({ ok: false, message: MESSAGES.NETWORK_ERROR }, { status: 500 });
  }

  const existingKeys = new Set(
    (existing ?? [])
      .filter((p) => (cityId ? p.city_id === cityId : p.city_id === null))
      .map((p) => p.name),
  );

  const toInsert = items.filter((it) => {
    if (existingKeys.has(it.name)) return false;
    // 同一次提交内的重名也要跳过
    existingKeys.add(it.name);
    return true;
  });

  const skipped = items.length - toInsert.length;

  if (toInsert.length === 0) {
    if (rawText) {
      await supabase.from('imports').insert({
        user_id: user.id,
        raw_text: rawText,
        source: source ?? IMPORT_SOURCE.MANUAL,
        status: IMPORT_STATUS.UNRECOGNIZED,
      });
    }
    return NextResponse.json({ ok: true, inserted: 0, skipped, cityMatched });
  }

  // 写入前用高德补经纬度与地址：搜到 → matched，搜不到 → unmatched，
  // 高德调用失败 → pending；一律不阻断收藏（技术方案 v1.1 §4.4）
  const geocoded = await geocodeAll(toInsert, geoCity);

  const { data: insertedRows, error: insertError } = await supabase
    .from('places')
    .insert(
      toInsert.map((it, index) => {
        const geo = geocoded[index];
        return {
          user_id: user.id,
          city_id: cityId,
          name: it.name,
          type: it.type,
          note: it.note,
          address: geo.address,
          lat: geo.lat,
          lng: geo.lng,
          image_url: geo.imageUrl,
          source,
          is_collected: true,
          geo_status: geo.status,
        };
      }),
    )
    .select('id');

  if (insertError) {
    return NextResponse.json({ ok: false, message: MESSAGES.NETWORK_ERROR }, { status: 500 });
  }

  const inserted = insertedRows?.length ?? 0;

  // 导入记录为审计用途，写入失败不阻断主流程
  if (rawText) {
    await supabase.from('imports').insert({
      user_id: user.id,
      raw_text: rawText,
      source: source ?? IMPORT_SOURCE.MANUAL,
      status: inserted > 0 ? IMPORT_STATUS.SUCCESS : IMPORT_STATUS.UNRECOGNIZED,
    });
  }

  return NextResponse.json({ ok: true, inserted, skipped, cityMatched });
}

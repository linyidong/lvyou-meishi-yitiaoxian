import { NextResponse, type NextRequest } from 'next/server';
import { BUSINESS } from '@/config/business';
import { MESSAGES } from '@/config/messages';
import { searchPlaces } from '@/lib/amap';
import { extractPlacesAndCity } from '@/lib/deepseek';
import {
  GUEST_COOKIE,
  checkGuestRateLimit,
  guestCookieOptions,
  resolveGuestKey,
} from '@/lib/guest-rate-limit';
import { fetchTextFromUrl, firstUrlIn, isUrlOnly } from '@/lib/link-fetch';
import type { PlaceType } from '@/types';

/**
 * 游客试用 · 导入地点（免登录）
 * POST /api/try/extract  body: { text, cityName }
 * resp: { ok, places: { key,name,type,lat,lng,address,imageUrl }[], failed, linkReadFailed }
 *
 * 与登录用户的 /api/ai/extract + /api/places 组合等价，但**全程不落库**：
 * 游客没有账号，places 表（RLS 只允许 owner 写）写不进去，所以提取出的地点
 * 只用高德补上坐标后直接返回，由前端存进 sessionStorage 草稿，与库内已有地点一起参与勾选和排路线。
 *
 * 两条与登录路径不同的约束，都是「试用路线是单城」这个前提决定的：
 *   1. 文案里识别到的城市必须与当前出发城市一致 —— 否则地点落在别的城市，整条路线没有意义，
 *      此时返回 409 + code=CITY_MISMATCH，由前端提示换文案或换城市；
 *   2. 高德搜不到坐标的地点直接丢弃 —— 没有经纬度就排不了路线、画不了地图，
 *      丢弃数量放在 failed 里回给前端提示。
 *
 * 接口带 IP 日限流（与其它试用接口同一额度），超限 429。
 */
export const dynamic = 'force-dynamic';

/** 补坐标的并发上限，与 /api/places 保持一致，避免瞬时打满高德配额 */
const GEOCODE_CONCURRENCY = 4;

interface GuestPlace {
  key: string;
  name: string;
  type: PlaceType;
  lat: number;
  lng: number;
  address: string | null;
  imageUrl: string | null;
}

export async function POST(request: NextRequest) {
  const { key, newGuestId } = resolveGuestKey(request);
  const rate = checkGuestRateLimit(key, 'import');
  if (!rate.ok) {
    return NextResponse.json({ ok: false, message: MESSAGES.TRY.PICK.rateLimited }, { status: 429 });
  }

  /** 统一出口：无代理头时给浏览器补发访客标识 cookie */
  const finish = (body: unknown, status = 200) => {
    const response = NextResponse.json(body, { status });
    if (newGuestId) response.cookies.set(GUEST_COOKIE, newGuestId, guestCookieOptions());
    return response;
  };

  let body: { text?: unknown; cityName?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return finish({ ok: false, message: MESSAGES.INVALID_PARAMS }, 400);
  }

  const cityName = typeof body.cityName === 'string' ? body.cityName.trim() : '';
  if (!cityName) return finish({ ok: false, message: MESSAGES.INVALID_PARAMS }, 400);

  let text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return finish({ ok: false, message: MESSAGES.LINK_NEED_TEXT }, 400);
  if (text.length > BUSINESS.MAX_IMPORT_TEXT_LENGTH) {
    return finish({ ok: false, message: MESSAGES.IMPORT_TEXT_TOO_LONG }, 400);
  }

  // 与 /api/ai/extract 相同的链接兜底：几乎只有链接 → 按链接抓正文；
  // 文案 + 链接混输 → 抓一次链接正文并合并，读不到则静默回退到文案本身
  let linkReadFailed = false;
  const found = firstUrlIn(text);
  if (found) {
    const fetched = await fetchTextFromUrl(found);
    if (fetched) {
      text = (isUrlOnly(text) ? fetched : `${text}\n${fetched}`).slice(
        0,
        BUSINESS.MAX_IMPORT_TEXT_LENGTH,
      );
    } else if (isUrlOnly(text)) {
      return finish({ ok: false, message: MESSAGES.LINK_NEED_TEXT }, 422);
    } else {
      linkReadFailed = true;
    }
  }

  // 先识别文案里的城市，再按该城市提取地点（与登录用户同一条 AI 链路）
  let extracted;
  try {
    extracted = await extractPlacesAndCity(text);
  } catch {
    return finish({ ok: false, message: MESSAGES.AI_FAILED }, 502);
  }

  if (extracted.city && extracted.city !== cityName) {
    return finish(
      {
        ok: false,
        code: 'CITY_MISMATCH',
        detectedCity: extracted.city,
        message: MESSAGES.TRY.PICK.importCityMismatch(extracted.city, cityName),
      },
      409,
    );
  }

  if (extracted.places.length === 0) {
    return finish({ ok: true, places: [], failed: 0, linkReadFailed });
  }

  // 按当前出发城市补坐标；命中 amap_geocode_cache 时不消耗高德额度
  const geocoded: GuestPlace[] = [];
  let failed = 0;
  const seen = new Set<string>();

  for (let i = 0; i < extracted.places.length; i += GEOCODE_CONCURRENCY) {
    const chunk = extracted.places.slice(i, i + GEOCODE_CONCURRENCY);
    const hits = await Promise.all(
      chunk.map(async (place) => {
        try {
          const [hit] = await searchPlaces(place.name, cityName);
          return { place, hit };
        } catch {
          return { place, hit: undefined };
        }
      }),
    );

    for (const { place, hit } of hits) {
      if (seen.has(place.name)) continue;
      seen.add(place.name);
      if (!hit || !Number.isFinite(hit.lat) || !Number.isFinite(hit.lng)) {
        failed += 1;
        continue;
      }
      geocoded.push({
        key: place.name,
        name: place.name,
        type: place.type,
        lat: hit.lat,
        lng: hit.lng,
        address: hit.address || null,
        imageUrl: hit.imageUrl,
      });
    }
  }

  return finish({ ok: true, places: geocoded, failed, linkReadFailed });
}

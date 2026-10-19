import { NextResponse, type NextRequest } from 'next/server';
import { PLACE_TYPE } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { GUEST_COOKIE, checkGuestRateLimit, guestCookieOptions, resolveGuestKey } from '@/lib/guest-rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import type { PlaceType } from '@/types';

/**
 * 游客试用 · 库内已有地点（免登录）。
 * GET /api/try/city-places?cityId=xxx
 *
 * 说明：places 表是跨用户的私有数据（RLS 只允许 owner 读），所以这里用 service_role
 * （lib/supabase/admin.ts 的 createAdminClient）跨用户读取，并且：
 *   1. 按 city_id 过滤，只取 is_collected = true 的库内地点；
 *   2. 按 name 去重（同名只留一条，key 就是 name）；
 *   3. 只返回坐标非空的行；
 *   4. 只暴露公共字段（name / type / lat / lng / address / imageUrl），绝不返回 user_id。
 * 这条路径零高德消耗。接口带 IP 日限流（超限 429）。
 */

interface CityPlaceItem {
  key: string;
  name: string;
  type: PlaceType;
  lat: number;
  lng: number;
  address: string | null;
  imageUrl: string | null;
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { key, newGuestId } = resolveGuestKey(request);
  const rate = checkGuestRateLimit(key, 'city-places');
  if (!rate.ok) {
    return NextResponse.json({ ok: false, message: MESSAGES.TRY.PICK.rateLimited }, { status: 429 });
  }

  /** 统一出口：无代理头时给浏览器补发访客标识 cookie，保证限流按浏览器区分而不是全站共用 */
  const finish = (body: unknown, status = 200) => {
    const response = NextResponse.json(body, { status });
    if (newGuestId) response.cookies.set(GUEST_COOKIE, newGuestId, guestCookieOptions());
    return response;
  };

  const cityId = request.nextUrl.searchParams.get('cityId')?.trim() ?? '';
  if (!cityId) {
    return finish({ ok: false, message: MESSAGES.INVALID_PARAMS }, 400);
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('places')
      .select('name,type,address,image_url,lat,lng')
      .eq('city_id', cityId)
      .eq('is_collected', true);
    if (error) throw error;

    const seen = new Set<string>();
    const items: CityPlaceItem[] = [];
    for (const row of data ?? []) {
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      const lat = typeof row.lat === 'number' ? row.lat : NaN;
      const lng = typeof row.lng === 'number' ? row.lng : NaN;
      // 只保留坐标非空的行（高德没匹配上的地点画不到地图上）
      if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      // 按 name 去重，同名只留一条
      if (seen.has(name)) continue;
      seen.add(name);

      items.push({
        key: name,
        name,
        type: row.type === PLACE_TYPE.FOOD ? PLACE_TYPE.FOOD : PLACE_TYPE.ATTRACTION,
        lat,
        lng,
        address: typeof row.address === 'string' && row.address ? row.address : null,
        imageUrl: typeof row.image_url === 'string' && row.image_url ? row.image_url : null,
      });
    }

    // 景点在前、美食在后，同类按名称排，展示更稳定
    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === PLACE_TYPE.ATTRACTION ? -1 : 1;
      return a.name.localeCompare(b.name, 'zh');
    });

    return finish({ ok: true, items });
  } catch (err) {
    console.warn('[api/try/city-places] 读取库内地点失败：', err);
    return finish({ ok: false, message: MESSAGES.TRY.PICK.error }, 500);
  }
}

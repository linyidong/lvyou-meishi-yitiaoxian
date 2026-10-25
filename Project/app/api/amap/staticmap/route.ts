import { NextResponse, type NextRequest } from 'next/server';
import { MESSAGES } from '@/config/messages';
import { requestStaticMap } from '@/lib/amap';
import { createClient } from '@/lib/supabase/server';

/**
 * T-061 长图导出用的静态地图代理：GET /api/amap/staticmap?coords=lng,lat;lng,lat;...&size=W*H&zoom=10-16
 * - 仅登录用户（未登录 401，写法同 api/amap/landmarks）；
 * - 服务端走高德 Key 池并记 amap_usage(service='staticmap')；
 * - 参数非法 400；上游失败 502；成功返回 image/png。
 */

/** 单日最多 30 个点（与分享快照的站点上限同口径） */
const MAX_POINTS = 30;
/** 高德静态地图尺寸上限（像素） */
const MAX_SIZE = 1024;
const MIN_SIZE = 100;

function bad(msg?: string) {
  return NextResponse.json({ ok: false, error: msg ?? MESSAGES.INVALID_PARAMS }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: MESSAGES.LOGIN_FIRST }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;

  // coords：'lng,lat;lng,lat;...'，逐段解析并丢弃非法段
  const rawCoords = sp.get('coords') ?? '';
  const points = rawCoords.split(';').flatMap((seg) => {
    const parts = seg.split(',');
    if (parts.length !== 2) return [];
    const lng = Number(parts[0]);
    const lat = Number(parts[1]);
    if (
      !Number.isFinite(lng) ||
      !Number.isFinite(lat) ||
      lng < -180 ||
      lng > 180 ||
      lat < -90 ||
      lat > 90
    ) {
      return [];
    }
    return [{ lng, lat }];
  });
  if (points.length === 0 || points.length > MAX_POINTS) return bad();

  // size：'W*H'，两边都必须在 [100, 1024]
  const sizeParts = (sp.get('size') ?? '640*360').split('*');
  if (sizeParts.length !== 2) return bad();
  const width = Number(sizeParts[0]);
  const height = Number(sizeParts[1]);
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < MIN_SIZE ||
    height < MIN_SIZE ||
    width > MAX_SIZE ||
    height > MAX_SIZE
  ) {
    return bad();
  }

  // zoom：10-16 整数
  const zoom = Number(sp.get('zoom') ?? '12');
  if (!Number.isInteger(zoom) || zoom < 10 || zoom > 16) return bad();

  try {
    const buf = await requestStaticMap({ points, width, height, zoom });
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        // 同一天的地图短期内不变，允许浏览器 / CDN 侧私有缓存，省配额
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    console.error('[api/amap/staticmap] 静态地图获取失败：', err);
    return NextResponse.json({ ok: false, error: MESSAGES.NETWORK_ERROR }, { status: 502 });
  }
}

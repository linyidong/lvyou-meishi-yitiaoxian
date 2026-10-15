import { NextResponse, type NextRequest } from 'next/server';
import { MESSAGES } from '@/config/messages';
import { AmapError, searchPlaces } from '@/lib/amap';

/** 高德额度相关错误码（超额 / 调用过于频繁） */
const QUOTA_INFOCODES = ['10003', '10044'];

/** 高德地点搜索（技术方案 v1.1 §4.4） */
export async function POST(request: NextRequest) {
  let keywords = '';
  let city = '';

  try {
    const body = (await request.json()) as { keywords?: string; city?: string };
    keywords = (body.keywords ?? '').trim();
    city = (body.city ?? '').trim();
  } catch {
    return NextResponse.json({ ok: false, error: MESSAGES.NETWORK_ERROR }, { status: 400 });
  }

  if (!keywords) {
    return NextResponse.json({ ok: false, error: MESSAGES.NETWORK_ERROR }, { status: 400 });
  }

  try {
    const results = await searchPlaces(keywords, city);
    if (results.length === 0) {
      return NextResponse.json({ ok: false, error: MESSAGES.AMAP_NOT_FOUND, results: [] }, { status: 404 });
    }
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    if (error instanceof AmapError && QUOTA_INFOCODES.includes(error.infocode)) {
      return NextResponse.json({ ok: false, error: MESSAGES.AMAP_QUOTA_EXCEEDED }, { status: 429 });
    }
    return NextResponse.json({ ok: false, error: MESSAGES.AMAP_NOT_FOUND }, { status: 502 });
  }
}

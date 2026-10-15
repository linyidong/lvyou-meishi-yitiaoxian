import { NextResponse, type NextRequest } from 'next/server';
import { BUSINESS } from '@/config/business';
import { TRANSPORT } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { planDayRoute } from '@/lib/amap';
import type { Transport } from '@/types';

const VALID_TRANSPORT: Transport[] = [TRANSPORT.WALK, TRANSPORT.BIKE];

/** 一天多点路线规划（技术方案 v1.1 §4.5）：points 为 'lng,lat' 字符串数组 */
export async function POST(request: NextRequest) {
  let points: string[] = [];
  let transport: Transport = TRANSPORT.WALK;

  try {
    const body = (await request.json()) as { points?: string[]; transport?: Transport };
    points = (body.points ?? []).map((point) => String(point));
    transport = VALID_TRANSPORT.includes(body.transport as Transport)
      ? (body.transport as Transport)
      : TRANSPORT.WALK;
  } catch {
    return NextResponse.json({ ok: false, error: MESSAGES.NETWORK_ERROR }, { status: 400 });
  }

  if (points.length < 2 || points.length > BUSINESS.MAX_PLACES_PER_DAY) {
    return NextResponse.json({ ok: false, error: MESSAGES.ROUTE_FAILED }, { status: 400 });
  }

  try {
    const route = await planDayRoute(points, transport);
    return NextResponse.json({ ok: true, route });
  } catch {
    return NextResponse.json({ ok: false, error: MESSAGES.ROUTE_FAILED }, { status: 502 });
  }
}

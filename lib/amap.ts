import { ENV } from '@/config/env';
import { TRANSPORT } from '@/config/enums';
import type { AmapPlaceResult, Transport } from '@/types';

const AMAP_BASE = 'https://restapi.amap.com';

/** 高德返回的错误，带 infocode，便于上层区分额度用尽等情况 */
export class AmapError extends Error {
  readonly infocode: string;

  constructor(info: string, infocode: string) {
    super(info || '高德接口调用失败');
    this.name = 'AmapError';
    this.infocode = infocode;
  }
}

export interface AmapLeg {
  distanceMeters: number;
  durationSeconds: number;
}

export interface AmapDayRoute {
  distanceMeters: number;
  durationSeconds: number;
  legs: AmapLeg[];
}

/** 'lng,lat' -> { lng, lat } */
function parseLocation(location: string): { lng: number; lat: number } | null {
  const [lng, lat] = location.split(',').map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return { lng, lat };
}

/** 'lng,lat' 字符串（高德路线接口要求的格式） */
export function toAmapLocation(lng: number, lat: number): string {
  return `${lng},${lat}`;
}

async function amapGet(path: string, params: Record<string, string>) {
  if (!ENV.AMAP_WEB_KEY) {
    throw new Error('缺少 AMAP_WEB_SERVICE_KEY，请在 .env.local 中配置');
  }

  const url = new URL(AMAP_BASE + path);
  url.searchParams.set('key', ENV.AMAP_WEB_KEY);
  url.searchParams.set('output', 'JSON');
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`高德接口 HTTP ${res.status}`);
  }

  return (await res.json()) as Record<string, unknown>;
}

/** 单段路线（v3 步行 / v4 骑行均只支持起终点，途经点由上层分段调用） */
export async function planLeg(params: {
  origin: string;
  destination: string;
  transport: Transport;
}): Promise<AmapLeg> {
  const { origin, destination, transport } = params;

  if (transport === TRANSPORT.BIKE) {
    const data = await amapGet('/v4/direction/bicycling', { origin, destination });
    if (data.errcode !== 0) {
      throw new AmapError(String(data.errmsg ?? ''), String(data.errcode ?? ''));
    }
    const path = ((data.data as { paths?: unknown[] } | undefined)?.paths?.[0] ?? {}) as {
      distance?: string | number;
      duration?: string | number;
    };
    return {
      distanceMeters: Number(path.distance ?? 0),
      durationSeconds: Number(path.duration ?? 0),
    };
  }

  const data = await amapGet('/v3/direction/walking', { origin, destination });
  if (data.status !== '1') {
    throw new AmapError(String(data.info ?? ''), String(data.infocode ?? ''));
  }
  const path = ((data.route as { paths?: unknown[] } | undefined)?.paths?.[0] ?? {}) as {
    distance?: string | number;
    duration?: string | number;
  };
  return {
    distanceMeters: Number(path.distance ?? 0),
    durationSeconds: Number(path.duration ?? 0),
  };
}

/** 一天多点：按相邻两点分段规划后求和（技术方案 v1.1 §4.5） */
export async function planDayRoute(points: string[], transport: Transport): Promise<AmapDayRoute> {
  if (points.length < 2) {
    throw new Error('至少需要两个点才能规划路线');
  }

  const legs: AmapLeg[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    legs.push(await planLeg({ origin: points[i], destination: points[i + 1], transport }));
  }

  return {
    distanceMeters: legs.reduce((sum, leg) => sum + leg.distanceMeters, 0),
    durationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0),
    legs,
  };
}

/** 关键词搜地点（v3 文本搜索） */
export async function searchPlaces(keywords: string, city: string): Promise<AmapPlaceResult[]> {
  const data = await amapGet('/v3/place/text', {
    keywords,
    city,
    offset: '20',
    page: '1',
    extensions: 'base',
  });

  if (data.status !== '1') {
    throw new AmapError(String(data.info ?? ''), String(data.infocode ?? ''));
  }

  const pois = (data.pois as Array<Record<string, unknown>> | undefined) ?? [];

  return pois.flatMap((poi) => {
    const location = parseLocation(String(poi.location ?? ''));
    if (!location) return [];
    const name = String(poi.name ?? '');
    return [
      {
        name,
        address: String(poi.address ?? '') || name,
        lat: location.lat,
        lng: location.lng,
      },
    ];
  });
}

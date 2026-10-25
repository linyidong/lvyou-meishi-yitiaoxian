import { createHash } from 'node:crypto';
import { BUSINESS } from '@/config/business';
import { ENV } from '@/config/env';
import { NAV_MODE } from '@/config/enums';
import { pickWebKeySlot, webKeyAt } from '@/lib/amap-key-pool';
import { getExhaustedWebKeySlots } from '@/lib/amap-usage';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AmapPlaceResult, NavMode } from '@/types';

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

/** 高德部分照片地址给的是 http，页面上会变成混合内容被浏览器拦掉，统一转 https */
function httpsPhoto(url: unknown): string | null {
  if (typeof url !== 'string' || url === '') return null;
  return url.startsWith('http://') ? `https://${url.slice('http://'.length)}` : url;
}

/** 'lng,lat' 字符串（高德路线接口要求的格式） */
export function toAmapLocation(lng: number, lat: number): string {
  return `${lng},${lat}`;
}

/**
 * 高德 Web 服务「数字签名」：把除 sig 外的参数按参数名字典序拼成
 * key1=value1&key2=value2…，末尾追加私钥，取 MD5 小写。
 * 仅在 Key 开启了数字签名（.env.local 配了私钥）时才需要。
 */
function amapSignature(params: Record<string, string>, privateKey: string): string {
  const raw = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('md5').update(raw + privateKey).digest('hex');
}

/**
 * 高德个人认证 Key 的并发上限很低：连续突发调用会被限流（infocode 10021
 * CUQPS_HAS_EXCEEDED_THE_LIMIT），表现为「切一次出行方式就有几段算不出来」。
 * 这里把所有高德请求串成一条队列，保证两次请求之间至少间隔 MIN_GAP_MS，
 * 遇到限流再退避重试；单次失败仍由上层兜底（改用直线距离估算），不会白屏。
 */
const MIN_GAP_MS = 350;
const RATE_LIMIT_INFOCODES = new Set(['10021', '10019', '10020', '10003']);
const MAX_RETRY = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let amapQueue: Promise<unknown> = Promise.resolve();
let amapLastAt = 0;

/** 串行 + 限速地发一次请求 */
function throttledFetch(url: string): Promise<Response> {
  const run = amapQueue.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - amapLastAt);
    if (wait > 0) await sleep(wait);
    try {
      return await fetch(url, { cache: 'no-store' });
    } finally {
      amapLastAt = Date.now();
    }
  });
  // 队列不能因为某次请求失败而断开
  amapQueue = run.catch(() => undefined);
  return run;
}

/** 取一次 JSON，被限流时退避重试（v3 用 status/infocode，v4 骑行用 errcode/errmsg）；slot 为本次使用的 Key 槽位 */
async function amapGetJson(url: string, slot: number): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt <= MAX_RETRY; attempt += 1) {
    if (attempt > 0) await sleep(600 * attempt);
    let res: Response;
    try {
      res = await throttledFetch(url);
    } catch (err) {
      // 网络异常：记为一次失败调用后原样抛出（由上层兜底）
      recordAmapCall(url, true, slot);
      throw err;
    }
    if (!res.ok) {
      recordAmapCall(url, true, slot);
      throw new Error(`高德接口 HTTP ${res.status}`);
    }
    const json = (await res.json()) as Record<string, unknown>;

    const success = json.status === '1' || json.errcode === 0;
    // 每次 HTTP 请求都算一次调用；本次不是成功响应就记一次失败
    recordAmapCall(url, !success, slot);
    if (success) return json;

    const message = `${json.info ?? ''} ${json.errmsg ?? ''}`;
    const limited =
      RATE_LIMIT_INFOCODES.has(String(json.infocode ?? '')) || message.includes('CUQPS');
    if (!limited || attempt === MAX_RETRY) return json;
  }
  // 循环内必然已 return，这里只为类型收尾
  throw new Error('高德接口调用失败');
}

async function amapGet(path: string, params: Record<string, string>) {
  if (ENV.AMAP_WEB_KEYS.length === 0) {
    throw new Error('缺少 AMAP_WEB_SERVICE_KEY，请在 .env.local 中配置');
  }

  // Key 池：轮询选一个「本月未耗尽」的 Key 槽位（多账号叠加额度；只有 1 个 Key 时恒为它）
  const exhausted = await getExhaustedWebKeySlots();
  const slot = pickWebKeySlot(exhausted);
  const entry = webKeyAt(slot);

  const query: Record<string, string> = { key: entry!.key, output: 'JSON', ...params };
  // 该槽位的 Key 若在高德控制台开启了数字签名，需要用对应的私钥签名
  if (entry!.privateKey) {
    query.sig = amapSignature(query, entry!.privateKey);
  }

  const url = new URL(AMAP_BASE + path);
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));

  return amapGetJson(url.toString(), slot >= 0 ? slot : 0);
}

/* ==================== 落库缓存 / 用量统计的公共基础设施 ====================
 * 高德个人认证配额很小（15 万次/月），因此：
 * 1. 距离 / 算路结果落到 public.amap_leg_cache，跨进程 / 跨用户共享，避免同一对地点反复请求；
 * 2. 文本搜索结果（place/text，导入补坐标 / 住宿解析 / 手动搜索都走它）落到 public.amap_geocode_cache，
 *    同一城市 + 同一关键词只消耗一次额度；
 * 3. 每次高德调用都按服务名累加到 public.amap_usage，供 A02 用量看板与熔断降级使用。
 * 以上都属于「锦上添花」：表不存在、请求失败、超时一律 console.warn 后静默降级，
 * 绝不能打断路线生成（这是既有经验教训：外部依赖失败要兜底）。
 * ========================================================================== */

/** service_role 客户端（惰性单例）；缺 key 或初始化异常返回 null，缓存 / 统计据此静默降级 */
let amapDbClient: ReturnType<typeof createAdminClient> | null = null;
function amapDb(): ReturnType<typeof createAdminClient> | null {
  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) return null;
  if (!amapDbClient) {
    try {
      amapDbClient = createAdminClient();
    } catch (err) {
      console.warn('[amap] service_role 客户端不可用，缓存 / 用量统计降级：', err);
      return null;
    }
  }
  return amapDbClient;
}

/** 'lng,lat' 两端按字符串排序：一对地点只占一行，天然利用对称性（from 存较小者） */
function sortedPair(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

function legCacheKey(mode: string, from: string, to: string): string {
  return `${mode}|${from}|${to}`;
}

interface LegCacheRow {
  mode: string;
  from_lnglat: string;
  to_lnglat: string;
  distance_meters: number;
  duration_seconds: number;
}

/** 缓存 TTL：超过视为未命中，重新请求并覆盖（见 config/business.ts AMAP_CACHE_TTL_DAYS） */
const AMAP_CACHE_TTL_MS = BUSINESS.AMAP_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
/** 单次读取的批大小：PostgREST 的 in 列表不宜过长，每批 ≤ 50 对 */
const LEG_CACHE_CHUNK = 50;

/**
 * 批量读缓存（每批 ≤ 50 对，跨批用 in 过滤后按精确 key 匹配）。
 * 表不存在 / 请求失败 / 超时一律当未命中返回空 Map，不影响后续请求高德。
 */
async function readLegCache(
  pairs: { mode: string; from: string; to: string }[],
): Promise<Map<string, AmapLeg>> {
  const out = new Map<string, AmapLeg>();
  const db = amapDb();
  if (!db || pairs.length === 0) return out;

  const cutoff = new Date(Date.now() - AMAP_CACHE_TTL_MS).toISOString();
  try {
    for (let i = 0; i < pairs.length; i += LEG_CACHE_CHUNK) {
      const chunk = pairs.slice(i, i + LEG_CACHE_CHUNK);
      const modes = Array.from(new Set(chunk.map((p) => p.mode)));
      const froms = Array.from(new Set(chunk.map((p) => sortedPair(p.from, p.to)[0])));
      const tos = Array.from(new Set(chunk.map((p) => sortedPair(p.from, p.to)[1])));

      const { data, error } = await db
        .from('amap_leg_cache')
        .select('mode,from_lnglat,to_lnglat,distance_meters,duration_seconds')
        .in('mode', modes)
        .in('from_lnglat', froms)
        .in('to_lnglat', tos)
        .gte('updated_at', cutoff);
      if (error) throw error;

      for (const row of (data ?? []) as LegCacheRow[]) {
        out.set(legCacheKey(row.mode, row.from_lnglat, row.to_lnglat), {
          distanceMeters: row.distance_meters,
          durationSeconds: row.duration_seconds,
        });
      }
    }
    return out;
  } catch (err) {
    console.warn('[amap] 距离 / 算路缓存读取失败，按未命中处理：', err);
    return out;
  }
}

/**
 * 批量写缓存：upsert（on conflict (mode,from_lnglat,to_lnglat) 覆盖）。
 * 覆盖时要显式带上 updated_at，否则过期行被覆盖后仍是旧时间、又被判为过期。
 * 失败静默（只 warn）。
 */
async function writeLegCache(rows: LegCacheRow[]): Promise<void> {
  const db = amapDb();
  if (!db || rows.length === 0) return;

  const now = new Date().toISOString();
  const payload = rows.map((row) => ({ ...row, updated_at: now }));
  try {
    const { error } = await db
      .from('amap_leg_cache')
      .upsert(payload, { onConflict: 'mode,from_lnglat,to_lnglat', ignoreDuplicates: false });
    if (error) throw error;
  } catch (err) {
    console.warn('[amap] 距离 / 算路缓存写入失败，忽略：', err);
  }
}

/**
 * 文本搜索结果缓存（public.amap_geocode_cache）：
 * 键 = (city, keywords)，值与 searchPlaces 的返回结构一致（归一化后的 POI 数组）。
 * 命中直接复用，不再请求高德；只写非空结果（空结果不缓存，避免某次临时搜不到被记 30 天）。
 * 读写失败一律静默降级为「未命中」，继续正常请求高德。
 */
async function readGeocodeCache(city: string, keywords: string): Promise<AmapPlaceResult[] | null> {
  const db = amapDb();
  if (!db || !city || !keywords) return null;

  const cutoff = new Date(Date.now() - AMAP_CACHE_TTL_MS).toISOString();
  try {
    const { data, error } = await db
      .from('amap_geocode_cache')
      .select('results')
      .eq('city', city)
      .eq('keywords', keywords)
      .gte('updated_at', cutoff)
      .maybeSingle();
    if (error) throw error;

    const rows = (data?.results as AmapPlaceResult[] | undefined) ?? null;
    return rows && rows.length > 0 ? rows : null;
  } catch (err) {
    console.warn('[amap] 文本搜索缓存读取失败，按未命中处理：', err);
    return null;
  }
}

/** 写文本搜索结果缓存：upsert（on conflict (city,keywords) 覆盖），失败只 warn */
async function writeGeocodeCache(
  city: string,
  keywords: string,
  results: AmapPlaceResult[],
): Promise<void> {
  const db = amapDb();
  if (!db || !city || !keywords || results.length === 0) return;

  try {
    const { error } = await db.from('amap_geocode_cache').upsert(
      { city, keywords, results, updated_at: new Date().toISOString() },
      { onConflict: 'city,keywords', ignoreDuplicates: false },
    );
    if (error) throw error;
  } catch (err) {
    console.warn('[amap] 文本搜索缓存写入失败，忽略：', err);
  }
}

/** 高德服务名归类（用量统计口径）：其它未列出的服务统一归 other */
function amapServiceName(url: string): string {
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    // 解析失败就用原串做匹配
  }
  if (path.includes('/v3/place/text')) return 'place_text';
  if (path.includes('/v3/distance')) return 'distance';
  if (path.includes('/v3/direction/walking')) return 'direction_walking';
  if (path.includes('/v3/direction/driving')) return 'direction_driving';
  if (path.includes('/v3/direction/transit')) return 'direction_transit';
  if (path.includes('/v4/direction/bicycling')) return 'direction_bicycling';
  return 'other';
}

/** 服务器本地日期（YYYY-MM-DD），用量按天累加；写入与看板查询用同一口径 */
function amapUsageDay(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

interface UsageBucket {
  /** 本次调用所用的 Key 槽位（写入 amap_usage.key_slot，看板据此按高德账号区分用量） */
  slot: number;
  service: string;
  calls: number;
  failures: number;
}

/** 内存累加的待上报用量（键 = `槽位|服务名`）；每累计 20 次或每 60 秒 flush 一次 */
const usagePending = new Map<string, UsageBucket>();
let usagePendingTotal = 0;
let usageTimer: ReturnType<typeof setInterval> | null = null;
const USAGE_FLUSH_CALLS = 20;
const USAGE_FLUSH_INTERVAL_MS = 60 * 1000;

/** 惰性启动定时 flush；Node 环境下 unref，避免定时器阻止进程退出 */
function ensureUsageTimer(): void {
  if (usageTimer) return;
  usageTimer = setInterval(() => {
    void flushAmapUsage();
  }, USAGE_FLUSH_INTERVAL_MS);
  const timer = usageTimer as unknown as { unref?: () => void };
  if (typeof timer.unref === 'function') timer.unref();
}

/**
 * 记一次高德调用：按服务名内存累加，达到阈值（20 次）立即 flush。
 * failure = 该次请求失败（高德返回 status != 1 / errcode != 0，或请求抛错 / 非 2xx）。
 */
function recordAmapCall(url: string, failure: boolean, slot: number): void {
  const service = amapServiceName(url);
  const bucketKey = `${slot}|${service}`;
  const bucket = usagePending.get(bucketKey) ?? { slot, service, calls: 0, failures: 0 };
  bucket.calls += 1;
  if (failure) bucket.failures += 1;
  usagePending.set(bucketKey, bucket);
  usagePendingTotal += 1;
  ensureUsageTimer();
  if (usagePendingTotal >= USAGE_FLUSH_CALLS) void flushAmapUsage();
}

/**
 * 把内存里待上报的用量 flush 到 bump_amap_usage（service_role rpc）。
 * 先清空本地累加再上报：统计允许少量丢失（进程重启会丢失未 flush 的计数，可接受），
 * 上报失败只 warn，绝不回滚 / 阻塞主流程。
 */
async function flushAmapUsage(): Promise<void> {
  const pending = Array.from(usagePending.entries());
  if (pending.length === 0) return;

  usagePending.clear();
  usagePendingTotal = 0;

  const db = amapDb();
  if (!db) return;

  const day = amapUsageDay();
  try {
    const results = await Promise.all(
      pending.map(([, bucket]) =>
        db.rpc('bump_amap_usage', {
          p_day: day,
          p_service: bucket.service,
          p_key_slot: bucket.slot,
          p_calls: bucket.calls,
          p_failures: bucket.failures,
        }),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) console.warn('[amap] 用量上报失败，忽略：', failed.error);
  } catch (err) {
    console.warn('[amap] 用量上报失败，忽略：', err);
  }
}


/** 真正调用高德算路的纯函数（不做缓存）；带缓存的包装见下面的 planLeg */
async function requestLeg(params: {
  origin: string;
  destination: string;
  mode: NavMode;
  /** 公交地铁必填：城市 adcode（如成都 510100），来自内置城市表 */
  cityAdcode?: string | null;
}): Promise<AmapLeg> {
  const { origin, destination, mode, cityAdcode } = params;

  if (mode === NAV_MODE.BIKE) {
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

  if (mode === NAV_MODE.DRIVE) {
    const data = await amapGet('/v3/direction/driving', { origin, destination, strategy: '0' });
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

  if (mode === NAV_MODE.TRANSIT) {
    if (!cityAdcode) {
      throw new AmapError('公交地铁需要城市编码', '');
    }
    const data = await amapGet('/v3/direction/transit/integrated', {
      origin,
      destination,
      city: cityAdcode,
      cityd: cityAdcode,
      strategy: '0',
    });
    if (data.status !== '1') {
      throw new AmapError(String(data.info ?? ''), String(data.infocode ?? ''));
    }
    const route = (data.route ?? {}) as {
      distance?: string | number;
      transits?: { duration?: string | number }[];
    };
    const transit = route.transits?.[0];
    if (!transit) {
      throw new AmapError('这段没有可用的公交地铁方案', '');
    }
    return {
      distanceMeters: Number(route.distance ?? 0),
      durationSeconds: Number(transit.duration ?? 0),
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

/**
 * 单段路线：按导航方式调用对应高德接口（步行 / 骑行 / 驾车 / 公交地铁）。
 * 落库缓存包装：先查库 → 只对未命中的段请求高德 → 结果写库 → 返回。
 * 缓存键 mode：公交地铁的算路结果与城市编码有关，拼成 `transit:<cityAdcode>`；其余方式只用 navmode。
 * 与距离矩阵用 `dist:<navmode>` 分开存，避免「矩阵只有距离、时长为 0」污染算路结果。
 * 两端按字符串排序后存取（对称近近似：忽略单向路 / 公交方向差异，一对地点只占一行）。
 * 缓存读写静默降级，失败一律当未命中继续请求高德。
 */
export async function planLeg(params: {
  origin: string;
  destination: string;
  mode: NavMode;
  /** 公交地铁必填：城市 adcode（如成都 510100），来自内置城市表 */
  cityAdcode?: string | null;
}): Promise<AmapLeg> {
  const { origin, destination, mode, cityAdcode } = params;

  const cacheMode = mode === NAV_MODE.TRANSIT && cityAdcode ? `${mode}:${cityAdcode}` : mode;
  const [from, to] = sortedPair(origin, destination);

  const cached = await readLegCache([{ mode: cacheMode, from, to }]);
  const hit = cached.get(legCacheKey(cacheMode, from, to));
  if (hit) return hit;

  const leg = await requestLeg(params);
  void writeLegCache([
    {
      mode: cacheMode,
      from_lnglat: from,
      to_lnglat: to,
      distance_meters: Math.round(leg.distanceMeters),
      duration_seconds: Math.round(leg.durationSeconds),
    },
  ]);
  return leg;
}

/** 一天多点：按相邻两点分段规划后求和（技术方案 v1.1 §4.5） */
export async function planDayRoute(
  points: string[],
  mode: NavMode,
  cityAdcode?: string | null,
): Promise<AmapDayRoute> {
  if (points.length < 2) {
    throw new Error('至少需要两个点才能规划路线');
  }

  const legs: AmapLeg[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    legs.push(
      await planLeg({
        origin: points[i],
        destination: points[i + 1],
        mode,
        cityAdcode,
      }),
    );
  }

  return {
    distanceMeters: legs.reduce((sum, leg) => sum + leg.distanceMeters, 0),
    durationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0),
    legs,
  };
}

/** 高德距离测量的 type：步行=3，驾车=1；骑行并入步行、公交地铁并入驾车做近似比较 */
const DISTANCE_TYPE: Record<NavMode, string> = {
  [NAV_MODE.WALK]: '3',
  [NAV_MODE.BIKE]: '3',
  [NAV_MODE.TRANSIT]: '1',
  [NAV_MODE.DRIVE]: '1',
};

/**
 * 按导航方式算两两距离矩阵（米），供「按该方式重排顺序」使用。
 * 落库缓存：先一次性读全部无序对（键 dist:<navmode>），整列命中的终点直接填充；
 * 只对「该终点整列还有未命中」的终点请求高德（v3/distance 一次取「多个起点 → 一个终点」），
 * 拿到的结果批量写库；反向距离取同值（对称）。缓存读写静默降级。
 * 注：距离矩阵的 mode 用 `dist:<navmode>` 前缀，与 planLeg 的算路缓存 key 分开，
 *     避免矩阵「只有距离、时长为 0」的行被当成算路结果命中。
 */
export async function distanceMatrix(points: string[], mode: NavMode): Promise<number[][]> {
  const n = points.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const cacheMode = `dist:${mode}`;

  // 1. 先读缓存：所有无序对（i < j）
  const pairs: { mode: string; from: string; to: string }[] = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const [from, to] = sortedPair(points[i], points[j]);
      pairs.push({ mode: cacheMode, from, to });
    }
  }
  const cached = await readLegCache(pairs);

  // 2. 逐终点：整列命中直接填；只要该终点还有未命中，就请求一次该终点
  for (let i = 0; i < n; i += 1) {
    let missing = false;
    for (let j = 0; j < n; j += 1) {
      if (j === i) continue;
      const [from, to] = sortedPair(points[j], points[i]);
      const hit = cached.get(legCacheKey(cacheMode, from, to));
      if (hit) {
        matrix[j][i] = hit.distanceMeters;
        matrix[i][j] = hit.distanceMeters;
      } else {
        missing = true;
      }
    }
    if (!missing) continue;

    const data = await amapGet('/v3/distance', {
      origins: points.join('|'),
      destination: points[i],
      type: DISTANCE_TYPE[mode],
    });
    if (data.status !== '1') {
      throw new AmapError(String(data.info ?? ''), String(data.infocode ?? ''));
    }

    const results = (data.results as Array<Record<string, unknown>> | undefined) ?? [];
    const toWrite: LegCacheRow[] = [];
    for (const row of results) {
      const j = Number(row.origin_id ?? 0) - 1;
      if (j < 0 || j >= n) continue;
      const distance = Math.round(Number(row.distance ?? 0));
      matrix[j][i] = distance;
      matrix[i][j] = distance;
      if (j !== i) {
        const [from, to] = sortedPair(points[j], points[i]);
        // 距离矩阵只给距离、没有时长，时长记 0（已与算路缓存用 dist: 前缀分开）
        toWrite.push({
          mode: cacheMode,
          from_lnglat: from,
          to_lnglat: to,
          distance_meters: distance,
          duration_seconds: 0,
        });
      }
    }
    await writeLegCache(toWrite);
  }

  return matrix;
}

/**
 * 距离矩阵的进程内快速缓存（在落库缓存之上再加一层，减少同一次页面加载里
 * /api/amap/order 与 /api/amap/route 对同一批点的重复查询 / 请求）。
 * 落库缓存由 distanceMatrix 负责，跨进程 / 跨用户共享。
 */
const MATRIX_TTL_MS = 10 * 60 * 1000;
const matrixCache = new Map<string, { at: number; matrix: number[][] }>();

export async function cachedDistanceMatrix(points: string[], mode: NavMode): Promise<number[][]> {
  const key = `${mode}|${points.join('|')}`;
  const hit = matrixCache.get(key);
  if (hit && Date.now() - hit.at < MATRIX_TTL_MS) return hit.matrix;
  const matrix = await distanceMatrix(points, mode);
  matrixCache.set(key, { at: Date.now(), matrix });
  return matrix;
}

/** 周边知名地点的分类编码：商场 / 特色商业街 / 风景名胜 */
const LANDMARK_TYPES = '060100|061000|110000';
/** 周边知名地点最多取几个（用户口径：高德评分取前 8） */
const LANDMARK_LIMIT = 8;
/** 评分门槛：低于它的先不算「知名」 */
const LANDMARK_MIN_RATING = 4.0;
/** 明显不是「知名地点」的名称关键词，先剔除，免得小点位挤掉大商场 */
const LANDMARK_NOISE = [
  '地铁站',
  '公交站',
  '停车场',
  '遗址',
  '营业厅',
  '公厕',
  '厕所',
  '收费站',
  '酒店',
  '宾馆',
  '旅馆',
  '公寓',
  '民宿',
];

/** 周边知名地点（地图上的灰点），按高德评分排序取前 8 */
export async function searchLandmarks(params: {
  location: string;
  radiusMeters: number;
}): Promise<AmapPlaceResult[]> {
  const data = await amapGet('/v3/place/around', {
    location: params.location,
    radius: String(Math.round(params.radiusMeters)),
    types: LANDMARK_TYPES,
    offset: '25',
    page: '1',
    sortrule: 'weight',
    extensions: 'all',
  });

  if (data.status !== '1') {
    throw new AmapError(String(data.info ?? ''), String(data.infocode ?? ''));
  }

  const pois = (data.pois as Array<Record<string, unknown>> | undefined) ?? [];

  const mapped = pois.flatMap((poi) => {
    const location = parseLocation(String(poi.location ?? ''));
    if (!location) return [];
    const name = String(poi.name ?? '').trim();
    if (!name) return [];
    if (LANDMARK_NOISE.some((word) => name.includes(word))) return [];
    const bizExt = (poi.biz_ext ?? {}) as { rating?: unknown };
    const rating = Number(bizExt.rating ?? NaN);
    const photos = (poi.photos as Array<{ url?: unknown }> | undefined) ?? [];
    return [
      {
        name,
        address: String(poi.address ?? '') || name,
        lat: location.lat,
        lng: location.lng,
        imageUrl: httpsPhoto(photos[0]?.url),
        rating: Number.isFinite(rating) ? rating : null,
      },
    ];
  });

  const rated = mapped
    .filter((poi) => poi.rating !== null && poi.rating >= LANDMARK_MIN_RATING)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  // 周边实在没有评分达标的地点时，退回按高德综合排序取前几个，别让地图空着
  const picked = rated.length > 0 ? rated : mapped;

  return picked.slice(0, LANDMARK_LIMIT).map(({ name, address, lat, lng, imageUrl }) => ({
    name,
    address,
    lat,
    lng,
    imageUrl,
  }));
}

/**
 * 住宿坐标：routes 表只存了住宿文本（lodging_name / lodging_area），没有经纬度，
 * 需要拿文本去高德做一次关键词搜索才能得到坐标。
 */
export interface LodgingCoords {
  /** 住宿名称（用户填的名称优先，没填就用搜到的 POI 名） */
  name: string;
  lat: number;
  lng: number;
}

/** 把住宿文本解析成坐标；填了名称先用名称搜，搜不到再用区域搜；都搜不到返回 null */
export async function resolveLodgingCoords(params: {
  name: string | null;
  area: string | null;
  city: string | null;
  /** T-058：城市 adcode（有则锁定城市搜索，防止住宿被解析到外城） */
  cityAdcode?: string | null;
}): Promise<LodgingCoords | null> {
  const { name, area, city, cityAdcode } = params;
  if (!city) return null;

  for (const keyword of [name, area]) {
    if (!keyword) continue;
    try {
      const pois = await searchPlaces(keyword, city, cityAdcode);
      const hit = pois[0];
      if (hit) return { name: name ?? hit.name, lat: hit.lat, lng: hit.lng };
    } catch (err) {
      console.warn('[amap] 住宿坐标解析失败：', err);
      return null;
    }
  }
  return null;
}

/**
 * 关键词搜地点（v3 文本搜索，extensions=all 以便一并取回照片与评分）。
 * T-058 串城修复：
 * - 请求加 `citylimit=true`，并优先用 adcode（6 位数字）作为 city，锁定目标城市；
 * - 结果保留 POI 的 adcode / cityname；给定 cityAdcode 时只保留同城结果
 *   （adcode 前 4 位一致，或 cityname 与目标城市同名——兼容「北京」这类直辖市 adcode 前 4 位为 00 的情况）；
 *   过滤后为空返回 []，调用方据此走 unmatched，绝不回填错城市地址。
 * - 缓存键用 adcode 优先（adcode || city），不同城市不再共用同一缓存。
 * 带落库缓存：同一城市 + 同一关键词命中缓存直接返回，不再消耗高德额度（见 readGeocodeCache）。
 */
export async function searchPlaces(
  keywords: string,
  city: string,
  cityAdcode?: string | null,
): Promise<AmapPlaceResult[]> {
  const adcode = typeof cityAdcode === 'string' && /^\d{6}$/.test(cityAdcode) ? cityAdcode : '';
  const cacheCity = adcode || city;

  const cached = await readGeocodeCache(cacheCity, keywords);
  if (cached) return cached;

  const data = await amapGet('/v3/place/text', {
    keywords,
    city: cacheCity,
    citylimit: 'true',
    offset: '20',
    page: '1',
    extensions: 'all',
  });

  if (data.status !== '1') {
    throw new AmapError(String(data.info ?? ''), String(data.infocode ?? ''));
  }

  const pois = (data.pois as Array<Record<string, unknown>> | undefined) ?? [];

  const results = pois.flatMap((poi) => {
    const location = parseLocation(String(poi.location ?? ''));
    if (!location) return [];
    const name = String(poi.name ?? '');
    const photos = (poi.photos as Array<{ url?: unknown }> | undefined) ?? [];
    return [
      {
        name,
        address: String(poi.address ?? '') || name,
        lat: location.lat,
        lng: location.lng,
        imageUrl: httpsPhoto(photos[0]?.url),
        adcode: String(poi.adcode ?? ''),
        cityname: String(poi.cityname ?? ''),
      },
    ];
  });

  // 城市一致性过滤：给定 adcode 时只保留同城结果（前 4 位一致 或 cityname 同名）
  let filtered = results;
  if (adcode) {
    const prefix = adcode.slice(0, 4);
    filtered = results.filter(
      (poi) =>
        poi.adcode!.slice(0, 4) === prefix ||
        poi.cityname === city ||
        poi.cityname === `${city}市`,
    );
  }

  void writeGeocodeCache(cacheCity, keywords, filtered);
  return filtered;
}

/**
 * 解析新城市的 adcode（T-042 AI 城市自动入库）。
 * 调高德 v3/config/district，依次尝试 `name`、`name+县`、`name+市`、`name+区`；
 * 只有返回区划名与查询词**完全一致**才采用——防止「东山」被错配成黑龙江「东山区」
 * （查询词「东山」不会命中名为「东山区」的区划，「县」先于「区」尝试保证东山县 350626 先命中）。
 * 全部尝试都解析不到时返回空串（cities.adcode NOT NULL 但允许空串）。
 */
export async function resolveCityAdcode(name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) return '';

  for (const keyword of [trimmed, `${trimmed}县`, `${trimmed}市`, `${trimmed}区`]) {
    try {
      const data = await amapGet('/v3/config/district', {
        keywords: keyword,
        subdistrict: '0',
      });
      if (data.status !== '1') continue;
      const districts = (data.districts as Array<Record<string, unknown>> | undefined) ?? [];
      const hit = districts.find(
        (d) =>
          String(d.name ?? '').trim() === keyword &&
          String(d.level ?? '') !== 'country',
      );
      if (hit) return String(hit.adcode ?? '').trim();
    } catch (err) {
      // 网络 / 额度异常：换下一个写法继续试，最终解析不到由调用方写空串
      console.warn('[amap] district 解析失败，继续尝试其它写法：', err);
    }
  }
  return '';
}

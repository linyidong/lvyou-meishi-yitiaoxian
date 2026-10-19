import type { NextRequest } from 'next/server';
import { BUSINESS } from '@/config/business';

/**
 * 游客试用（免登录）接口的限流键与 IP 日限流（仅服务端使用）。
 *
 * 用内存 Map 按「接口 + 限流键 + 服务器本地日期」计数，超限返回 ok=false 由调用方回 429。
 * 口径与 lib/member-quota.ts 的「每天」一致（服务器本地日期）。
 * 上限取 config/business.ts GUEST_TRY_RATE_LIMIT_PER_DAY。
 *
 * 限流键的取法（resolveGuestKey）：
 *  1. 有反向代理头（X-Forwarded-For / X-Real-IP）→ 按真实客户端 IP 计数，最准；
 *  2. 没有代理头（本地 dev、裸 `next start` 直连）→ 退回按浏览器访客标识 cookie 计数。
 *     这一步很关键：直连时所有客户端 IP 都取不到，若统一记成同一个 'local'，
 *     限流会变成「全站共用一个额度」，把正常游客挡在门外。
 */
export type GuestRateBucket = 'city-places' | 'order' | 'import' | 'ai-extract';

/** 浏览器访客标识 cookie 名（无代理头时用于区分不同游客） */
export const GUEST_COOKIE = 'tfl_guest';

/** 访客标识 cookie 有效期（天）：与限流「每天」口径无关，只用于长期区分浏览器 */
const GUEST_COOKIE_MAX_AGE_DAYS = 30;

interface BucketRecord {
  day: string;
  count: number;
}

/** key = `${bucket}|${限流键}`，value 记录当天已用次数 */
const buckets = new Map<string, BucketRecord>();

/** 触发一次过期清理的阈值：超过后清掉非当天的旧记录，避免长期运行内存膨胀 */
const CLEANUP_THRESHOLD = 2000;

/** 服务器本地日期（YYYY-MM-DD），与限额「每天」口径一致 */
function localDayString(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 访客标识：32 位十六进制随机串（够用且无需额外依赖） */
function newGuestId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 内网 / 本机地址判断：127.*、::1、10.*、192.168.*、172.16-31.*、fc00::/7。
 * 这类地址出现在 x-forwarded-for 里说明是「本机或局域网直连」（开发联调、局域网试用），
 * 不是真实访客；按 IP 计数会把同一台机器上所有浏览器算成一个人，
 * 导致开发者的自测请求先把额度用光、再去浏览器点就全是 429。这类情况改按浏览器 cookie 计数。
 */
function isPrivateOrLoopbackIp(ip: string): boolean {
  const v = ip.trim().toLowerCase().replace(/^::ffff:/, '');
  if (v === '::1' || v === 'localhost') return true;
  if (v.startsWith('127.')) return true;
  if (v.startsWith('10.') || v.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(v)) return true;
  if (/^f[cd][0-9a-f]{2}:/.test(v)) return true;
  return false;
}

/**
 * 解析本次请求的限流键。
 * @returns key 用于计数；newGuestId 非空时调用方需把它写进响应 cookie（浏览器第一次来）。
 */
export function resolveGuestKey(request: NextRequest): { key: string; newGuestId: string | null } {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim();
  if (ip && !isPrivateOrLoopbackIp(ip)) return { key: `ip:${ip}`, newGuestId: null };

  const existing = request.cookies.get(GUEST_COOKIE)?.value ?? '';
  if (/^[0-9a-f]{32}$/.test(existing)) return { key: `ck:${existing}`, newGuestId: null };

  const id = newGuestId();
  return { key: `ck:${id}`, newGuestId: id };
}

/** 访客标识 cookie 的统一选项（HttpOnly，避免被前端脚本改写绕过限流） */
export function guestCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: GUEST_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60,
  };
}

/**
 * 记一次调用并返回是否放行：
 * 达到上限（>= GUEST_TRY_RATE_LIMIT_PER_DAY）时返回 ok=false，调用方据此回 429。
 */
export function checkGuestRateLimit(
  key: string,
  bucket: GuestRateBucket,
): { ok: boolean; limit: number; remaining: number } {
  const limit = BUSINESS.GUEST_TRY_RATE_LIMIT_PER_DAY;
  const day = localDayString();

  if (buckets.size >= CLEANUP_THRESHOLD) {
    for (const [k, record] of buckets) {
      if (record.day !== day) buckets.delete(k);
    }
  }

  const bucketKey = `${bucket}|${key}`;
  const record = buckets.get(bucketKey);
  const count = record && record.day === day ? record.count : 0;

  if (count >= limit) {
    buckets.set(bucketKey, { day, count });
    return { ok: false, limit, remaining: 0 };
  }

  const next = count + 1;
  buckets.set(bucketKey, { day, count: next });
  return { ok: true, limit, remaining: limit - next };
}

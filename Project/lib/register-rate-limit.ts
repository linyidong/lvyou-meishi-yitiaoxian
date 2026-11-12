import { BUSINESS } from '@/config/business';

/**
 * T-104 注册限流（防批量注册刷免费额度）。
 *
 * 单实例进程内计数（与 guest-rate-limit 同一取舍：当前只有一台云机，够用；
 * 将来多实例需迁 Redis/DB，见 known-issues 的限流跨实例说明）。
 *
 * 三层上限（config/business.ts）：
 *  - 单 IP 每小时 3 次
 *  - 单 IP 每天 10 次
 *  - 全站每天 50 次（防止大量代理 IP 分摊绕过单 IP 限制）
 */

export type RegisterRateReason = 'ip-hour' | 'ip-day' | 'global-day';
export type RegisterRateResult = { ok: true } | { ok: false; reason: RegisterRateReason };

interface IpState {
  hourKey: string;
  hourCount: number;
  dayKey: string;
  dayCount: number;
}

const ipStates = new Map<string, IpState>();
let globalState: { dayKey: string; count: number } = { dayKey: '', count: 0 };

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** 服务器本地时区的小时键（YYYY-MM-DD-HH） */
export function hourKeyOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}`;
}

/** 服务器本地时区的日期键（YYYY-MM-DD） */
export function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 尝试占用一个注册名额：允许则累加并返回 ok；超限返回原因（不累加）。
 * now 参数便于单测注入固定时间。
 */
export function takeRegisterSlot(ip: string, now: Date = new Date()): RegisterRateResult {
  const dayKey = dayKeyOf(now);
  const hourKey = hourKeyOf(now);

  if (globalState.dayKey !== dayKey) globalState = { dayKey, count: 0 };
  if (globalState.count >= BUSINESS.REGISTER_GLOBAL_PER_DAY) {
    return { ok: false, reason: 'global-day' };
  }

  const key = ip || 'local';
  const prev = ipStates.get(key);
  const state: IpState =
    prev && prev.dayKey === dayKey
      ? prev
      : { hourKey: '', hourCount: 0, dayKey, dayCount: 0 };
  if (state.hourKey !== hourKey) {
    state.hourKey = hourKey;
    state.hourCount = 0;
  }

  if (state.hourCount >= BUSINESS.REGISTER_IP_PER_HOUR) return { ok: false, reason: 'ip-hour' };
  if (state.dayCount >= BUSINESS.REGISTER_IP_PER_DAY) return { ok: false, reason: 'ip-day' };

  state.hourCount += 1;
  state.dayCount += 1;
  ipStates.set(key, state);
  globalState.count += 1;
  return { ok: true };
}

/** 仅测试用：清空计数 */
export function resetRegisterRateForTest(): void {
  ipStates.clear();
  globalState = { dayKey: '', count: 0 };
}

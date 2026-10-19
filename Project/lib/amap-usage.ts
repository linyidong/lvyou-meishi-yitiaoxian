import { BUSINESS } from '@/config/business';
import { ENV } from '@/config/env';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * 高德用量查询与熔断降级判定（服务端专用）。
 * 数据源是 public.amap_usage（由 lib/amap.ts 的计数上报写入），只允许 service_role 读，
 * 因此这里固定走 service_role 客户端，绝不能被客户端组件引用。
 * 查询结果进程内缓存 60 秒：看板与熔断判定每 60 秒最多查一次库，不每个请求都查。
 * 查询失败一律静默降级为「空用量」（不触发任何预警 / 降级），不影响主流程。
 *
 * 多 Key（多高德账号）叠加：amap_usage 按 (day, service, key_slot) 分行，这里除了汇总，
 * 还给出每个 Key 槽位单独的用量；熔断降级只在「所有 Key 都达到红色阈值」时才触发。
 */

export interface AmapServiceUsage {
  service: string;
  calls: number;
  failures: number;
}

/** 单个 Key 槽位（= 一个高德账号的 Key）的本月用量 */
export interface AmapKeyUsage {
  /** 槽位下标，与 config/env.ts 的 AMAP_WEB_KEYS 顺序一致，也等于 amap_usage.key_slot */
  slot: number;
  /** 本月累计调用次数 */
  calls: number;
  /** 占该 Key 自身配额百分比（四舍五入） */
  percent: number;
  /** ≥ 黄色预警阈值 */
  warn: boolean;
  /** ≥ 红色阈值（该 Key 已耗尽，Key 池会跳过它） */
  critical: boolean;
}

export interface AmapUsageSummary {
  /** 已配置的 Key 数量（≥1） */
  keyCount: number;
  /** 全部 Key 合计月配额（每个 Key AMAP_MONTHLY_QUOTA × keyCount） */
  quotaTotal: number;
  /** 本月累计调用次数（全部 Key 合计） */
  monthTotal: number;
  /** 今日累计调用次数 */
  todayTotal: number;
  /** 各服务明细，当月按调用量降序 */
  services: AmapServiceUsage[];
  /** 各 Key 槽位明细，按槽位升序 */
  keys: AmapKeyUsage[];
  /** 占合计月配额百分比（四舍五入） */
  percent: number;
  /** ≥ 黄色预警阈值（合计或任一 Key） */
  warn: boolean;
  /** 所有 Key 都已达红色阈值 → 才整体熔断降级 */
  critical: boolean;
}

interface UsageRow {
  day: string;
  service: string;
  key_slot: number;
  calls: number;
  failures: number;
}

/** 查询失败时的安全默认值：全 0、不触发任何预警 */
function emptySummary(): AmapUsageSummary {
  return {
    keyCount: Math.max(ENV.AMAP_WEB_KEYS.length, 1),
    quotaTotal: BUSINESS.AMAP_MONTHLY_QUOTA * Math.max(ENV.AMAP_WEB_KEYS.length, 1),
    monthTotal: 0,
    todayTotal: 0,
    services: [],
    keys: [],
    percent: 0,
    warn: false,
    critical: false,
  };
}

/** 服务器本地日期（YYYY-MM-DD），与 lib/amap.ts 的 amapUsageDay 同口径 */
function localDayString(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 本月第一天（YYYY-MM-01） */
function monthStartString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/** 用量查询结果的进程内缓存（60 秒） */
const USAGE_CACHE_TTL_MS = 60 * 1000;
let usageCache: { at: number; summary: AmapUsageSummary } | null = null;
let usageInflight: Promise<AmapUsageSummary> | null = null;

/** 实际查库并聚合：本月合计 / 今日合计 / 各服务明细 / 各 Key 明细 */
async function queryUsage(): Promise<AmapUsageSummary> {
  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) return emptySummary();

  const now = new Date();
  const today = localDayString(now);
  const monthStart = monthStartString(now);

  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from('amap_usage')
      .select('day,service,key_slot,calls,failures')
      .gte('day', monthStart);
    if (error) throw error;

    const byService = new Map<string, AmapServiceUsage>();
    const bySlot = new Map<number, number>();
    let monthTotal = 0;
    let todayTotal = 0;
    for (const row of (data ?? []) as UsageRow[]) {
      monthTotal += row.calls;
      if (row.day === today) todayTotal += row.calls;
      const item = byService.get(row.service) ?? { service: row.service, calls: 0, failures: 0 };
      item.calls += row.calls;
      item.failures += row.failures;
      byService.set(row.service, item);
      const slot = Number.isInteger(row.key_slot) ? row.key_slot : 0;
      bySlot.set(slot, (bySlot.get(slot) ?? 0) + row.calls);
    }

    // 槽位数取「已配置 Key 数」与「库里出现过的最大槽位 + 1」的较大者，避免换配置后看板缺行
    const maxObservedSlot = bySlot.size > 0 ? Math.max(...bySlot.keys()) : -1;
    const slotCount = Math.max(ENV.AMAP_WEB_KEYS.length, maxObservedSlot + 1, 1);

    const keys: AmapKeyUsage[] = Array.from({ length: slotCount }, (_, slot) => {
      const calls = bySlot.get(slot) ?? 0;
      const percent = Math.round((calls / BUSINESS.AMAP_MONTHLY_QUOTA) * 100);
      return {
        slot,
        calls,
        percent,
        warn: percent >= BUSINESS.AMAP_QUOTA_WARN_PERCENT,
        critical: percent >= BUSINESS.AMAP_QUOTA_CRITICAL_PERCENT,
      };
    });

    const services = Array.from(byService.values()).sort((a, b) => b.calls - a.calls);
    const quotaTotal = BUSINESS.AMAP_MONTHLY_QUOTA * slotCount;
    const percent = Math.round((monthTotal / quotaTotal) * 100);
    return {
      keyCount: slotCount,
      quotaTotal,
      monthTotal,
      todayTotal,
      services,
      keys,
      percent,
      warn: percent >= BUSINESS.AMAP_QUOTA_WARN_PERCENT || keys.some((k) => k.warn),
      // 所有 Key 都到红色阈值才算整体熔断；只要还有一个 Key 有余量就继续用
      critical: keys.length > 0 && keys.every((k) => k.critical),
    };
  } catch (err) {
    console.warn('[amap-usage] 用量查询失败，按空用量处理：', err);
    return emptySummary();
  }
}

/** 读取本月高德用量（进程内缓存 60 秒，静默降级）；管理端看板与熔断判定共用 */
export async function getAmapUsage(): Promise<AmapUsageSummary> {
  const now = Date.now();
  if (usageCache && now - usageCache.at < USAGE_CACHE_TTL_MS) return usageCache.summary;
  if (usageInflight) return usageInflight;

  usageInflight = queryUsage().then((summary) => {
    usageCache = { at: Date.now(), summary };
    usageInflight = null;
    return summary;
  });
  return usageInflight;
}

/**
 * 已耗尽的 Key 槽位集合（本月用量 ≥ 红色阈值）：供 lib/amap.ts 的 Key 池轮询跳过这些槽位。
 * 复用上面 60 秒缓存的用量，异常时按「没有 Key 耗尽」处理（宁可多试也不误伤）。
 */
export async function getExhaustedWebKeySlots(): Promise<Set<number>> {
  try {
    const summary = await getAmapUsage();
    return new Set(summary.keys.filter((k) => k.critical).map((k) => k.slot));
  } catch {
    return new Set();
  }
}

/**
 * 熔断降级判定：所有 Key 的本月用量都 ≥ 红色阈值（配额 95%）时为 true。
 * 复用上面 60 秒缓存的用量，极轻量，不每个请求查库；异常时按「不降级」处理。
 */
export async function isAmapQuotaCritical(): Promise<boolean> {
  try {
    const summary = await getAmapUsage();
    return summary.critical;
  } catch {
    return false;
  }
}

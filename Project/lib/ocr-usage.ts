import { BUSINESS } from '@/config/business';
import { USAGE_KIND } from '@/config/enums';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * T-048 每人每日图片识别（OCR）计数（仅服务端，持久化到 public.user_daily_usage，kind='ocr'）。
 *
 * 取代 T-044 的进程内内存 Map（known-issues A9：重启清零、多实例不共享）：
 * - 迁移 031 已放宽 kind check 约束允许 'ocr'；读写走 service_role（该表无用户写策略），
 *   复用迁移 020 的原子函数 RPC：bump_user_daily_usage（内部 upsert on conflict
 *   (user_id, day, kind) 累加 count）与 get_user_daily_usage（读某天某桶次数）。
 * - 计数口径与 lib/member-quota.ts 一致：服务器本地日期（YYYY-MM-DD）。
 * - 降级策略：计数失败不阻断识别（宁可少计也不能挡住用户主流程），
 *   读失败按 0 处理、累加失败仅 console.warn。
 */

/** 服务器本地日期（YYYY-MM-DD），与限额「每天」口径一致 */
function localDayString(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 服务器本地月份首日（YYYY-MM-01），作为「本月」求和的 day 下界 */
function localMonthStartString(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-01`;
}

/** 读某人当天已用 OCR 次数（无行 = 0；查询失败降级为 0，即放行） */
export async function getOcrUsage(userId: string): Promise<number> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('get_user_daily_usage', {
      p_user_id: userId,
      p_day: localDayString(),
      p_kind: USAGE_KIND.OCR,
    });
    if (error) throw error;
    return typeof data === 'number' ? data : 0;
  } catch (err) {
    console.warn('[ocr-usage] OCR 用量读取失败，按 0 处理（降级放行）：', err);
    return 0;
  }
}

/**
 * 累加一次并返回累加后的次数（识别成功时才调用；失败不计）。
 * 累加走原子 upsert RPC；失败仅告警不抛出（降级放行），返回 0。
 */
export async function bumpOcrUsage(userId: string): Promise<number> {
  const day = localDayString();
  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc('bump_user_daily_usage', {
      p_user_id: userId,
      p_day: day,
      p_kind: USAGE_KIND.OCR,
      p_count: 1,
    });
    if (error) throw error;
    const { data, error: readErr } = await admin.rpc('get_user_daily_usage', {
      p_user_id: userId,
      p_day: day,
      p_kind: USAGE_KIND.OCR,
    });
    if (readErr) throw readErr;
    return typeof data === 'number' ? data : 0;
  } catch (err) {
    console.warn('[ocr-usage] OCR 用量累加失败，忽略（降级放行）：', err);
    return 0;
  }
}

/**
 * 本月全站 OCR 总用量（后台概览卡片用）：sum(count) where kind='ocr' and day >= 本月 1 日。
 * 行数为「用户×天」量级，直接取行在内存求和即可；失败降级为 0 并告警。
 */
export async function getOcrMonthlyUsage(): Promise<number> {
  try {
    const admin = createAdminClient();
    // 注意：列名就叫 count，裸 select('count') 会被 PostgREST 当成聚合（返回行数）而非逐行列值，
    // 因此这里取整行后在内存求和（行数为「用户×天」量级，很小）。
    const { data, error } = await admin
      .from('user_daily_usage')
      .select('*')
      .eq('kind', USAGE_KIND.OCR)
      .gte('day', localMonthStartString());
    if (error) throw error;
    return (data ?? []).reduce(
      (sum: number, row: { count: number | null }) => sum + (row.count ?? 0),
      0,
    );
  } catch (err) {
    console.warn('[ocr-usage] 本月 OCR 总用量读取失败，按 0 处理：', err);
    return 0;
  }
}

/** 每日上限（取 config/business.ts P09） */
export function ocrDailyLimit(): number {
  return BUSINESS.OCR_DAILY_LIMIT;
}

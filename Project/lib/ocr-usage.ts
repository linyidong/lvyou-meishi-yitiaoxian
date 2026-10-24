import { BUSINESS } from '@/config/business';

/**
 * T-044 每人每日图片识别（OCR）计数（仅服务端，内存 Map）。
 *
 * 为什么不用 user_daily_usage 表：该表 kind 列的 check 约束（迁移 020/025）
 * 只允许 generate_route / generate_route_month / ai_extract，加 'ocr' 取值需要
 * DB 迁移（ALTER 约束），超出本任务未批准的写库范围；任务卡明确允许
 * 「若不便则用内存/DB 简单计数并说明」，故按内存计数实现。
 *
 * 已知限制：dev/服务进程重启后计数清零；仅单实例有效。上线多实例前需改走 DB
 * （届时补一条放宽 kind 约束的迁移即可，接口签名不变）。
 * 计数口径与 lib/member-quota.ts 一致：服务器本地日期（YYYY-MM-DD）。
 */

interface DayRecord {
  day: string;
  count: number;
}

/** key = userId，value 记录当天已用次数 */
const usage = new Map<string, DayRecord>();

/** 触发一次过期清理的阈值：超过后清掉非当天的旧记录，避免长期运行内存膨胀 */
const CLEANUP_THRESHOLD = 2000;

/** 服务器本地日期（YYYY-MM-DD），与限额「每天」口径一致 */
function localDayString(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 读某人当天已用 OCR 次数（跨天自动视为 0） */
export function getOcrUsage(userId: string): number {
  const day = localDayString();
  const rec = usage.get(userId);
  return rec && rec.day === day ? rec.count : 0;
}

/** 累加一次并返回累加后的次数（识别成功时才调用；失败不计） */
export function bumpOcrUsage(userId: string): number {
  const day = localDayString();
  if (usage.size >= CLEANUP_THRESHOLD) {
    for (const [k, r] of usage) {
      if (r.day !== day) usage.delete(k);
    }
  }
  const next = getOcrUsage(userId) + 1;
  usage.set(userId, { day, count: next });
  return next;
}

/** 每日上限（取 config/business.ts P09） */
export function ocrDailyLimit(): number {
  return BUSINESS.OCR_DAILY_LIMIT;
}

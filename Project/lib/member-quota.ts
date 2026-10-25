import { BUSINESS } from '@/config/business';
import { QUOTA_ERROR, USAGE_KIND, USER_ROLE, type UsageKind } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { getAppSettings } from '@/lib/app-settings';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { straightDist2 } from '@/lib/route-order';

/**
 * 阶段 2 会员分层（服务端专用）：角色分档、每日用量计数、免费用户直线排序矩阵。
 *
 * 计数数据源：public.user_daily_usage（迁移 020），由服务端在实际动作里累加，
 * 前端不参与计数；计数走 service_role + 原子累加函数 bump_user_daily_usage。
 * 只允许服务端引用（内部用到 service_role 客户端），不可进入前端组件。
 */

/** 会员分档：管理员 > 会员 > 免费 / 游客 */
export type MemberTier = 'admin' | 'member' | 'free';

/** 「生成路线」限额的周期口径：免费按天（每天 1 条）、会员按月（每月 5 条） */
export type RouteQuotaPeriod = 'day' | 'month';

/** 各档位配额；Infinity = 不限 */
export interface TierLimits {
  /** 「生成路线」次数上限，周期见 routeLimitPeriod */
  routeLimit: number;
  /** 「生成路线」限额的周期口径（免费 day / 会员 month） */
  routeLimitPeriod: RouteQuotaPeriod;
  /** 行程天数上限 */
  maxDays: number;
  /** 单日地点数上限 */
  placesPerDay: number;
  /** 每天 AI 提取地点次数上限 */
  aiExtract: number;
}

/** 免费 / 游客档配额（取 config/business.ts P01/P03/P05/P07） */
const FREE_LIMITS: TierLimits = {
  routeLimit: BUSINESS.FREE_DAILY_ROUTE_LIMIT,
  routeLimitPeriod: 'day',
  maxDays: BUSINESS.FREE_MAX_DAYS,
  placesPerDay: BUSINESS.FREE_MAX_PLACES_PER_DAY,
  aiExtract: BUSINESS.FREE_AI_EXTRACT_DAILY_LIMIT,
};

/** 会员档配额（取 config/business.ts P02/P04/P06/P08） */
const MEMBER_LIMITS: TierLimits = {
  routeLimit: BUSINESS.MEMBER_MONTHLY_ROUTE_LIMIT,
  routeLimitPeriod: 'month',
  maxDays: BUSINESS.MEMBER_MAX_DAYS,
  placesPerDay: BUSINESS.MEMBER_MAX_PLACES_PER_DAY,
  aiExtract: BUSINESS.MEMBER_AI_EXTRACT_DAILY_LIMIT,
};

/** 管理员档配额：全部不限（管理员权益不可取消，任何限额都不拦截管理员） */
const ADMIN_LIMITS: TierLimits = {
  routeLimit: Number.POSITIVE_INFINITY,
  routeLimitPeriod: 'day',
  maxDays: Number.POSITIVE_INFINITY,
  placesPerDay: Number.POSITIVE_INFINITY,
  aiExtract: Number.POSITIVE_INFINITY,
};

/** 由 users.role / member 派生档位（管理员最高，其次会员，其余免费/游客） */
export function tierOf(
  role: string | null | undefined,
  member: boolean | null | undefined,
): MemberTier {
  if (role === USER_ROLE.ADMIN) return 'admin';
  if (member) return 'member';
  return 'free';
}

/**
 * 付费会员到期判断（阶段 3）：member_until 为空 = 永久会员；已过期视为免费用户。
 * 管理员由 role 决定，不受到期时间影响（管理员权益不可取消）。
 * 采用惰性判定而非定时任务：到期后用户再次访问即自动回落为免费档。
 */
export function isMemberActive(
  role: string | null | undefined,
  member: boolean | null | undefined,
  memberUntil: string | null | undefined,
): boolean {
  if (role === USER_ROLE.ADMIN) return true;
  if (!member) return false;
  if (!memberUntil) return true;
  return new Date(memberUntil).getTime() > Date.now();
}

/** 取档位对应配额 */
export function limitsOf(tier: MemberTier): TierLimits {
  if (tier === 'admin') return ADMIN_LIMITS;
  if (tier === 'member') return MEMBER_LIMITS;
  return FREE_LIMITS;
}

export interface QuotaProfile {
  tier: MemberTier;
  /** 免费用户「永久 1 次多日行程」试用额度是否已用（见 users.trial_multi_day_used） */
  trialMultiDayUsed: boolean;
  /** 会员到期时间（ISO）；null = 永久或非会员，见 users.member_until */
  memberUntil: string | null;
}

/**
 * 读取当前登录用户的档位与试用额度。
 * 查询失败（如迁移 020 / 021 未执行、列不存在）时降级：仍按 role / member 判定档位，
 * 试用额度视为未用，避免把已有会员误判为免费用户。
 * 付费会员按 member_until 惰性判到期（见 isMemberActive），到期后自动回落为免费档。
 */
export async function getQuotaProfile(userId: string): Promise<QuotaProfile> {
  const supabase = createClient();
  const full = await supabase
    .from('users')
    .select('role,member,trial_multi_day_used,member_until')
    .eq('id', userId)
    .maybeSingle();
  if (!full.error) {
    return {
      tier: tierOf(
        full.data?.role ?? null,
        isMemberActive(
          full.data?.role ?? null,
          full.data?.member ?? null,
          full.data?.member_until ?? null,
        ),
      ),
      trialMultiDayUsed: Boolean(full.data?.trial_multi_day_used),
      memberUntil: full.data?.member_until ?? null,
    };
  }

  const base = await supabase
    .from('users')
    .select('role,member')
    .eq('id', userId)
    .maybeSingle();
  return {
    tier: tierOf(
      base.data?.role ?? null,
      isMemberActive(base.data?.role ?? null, base.data?.member ?? null, null),
    ),
    trialMultiDayUsed: false,
    memberUntil: null,
  };
}

/** 服务器本地日期（YYYY-MM-DD），与限额「每天」口径一致 */
export function localDayString(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 服务器本地月份首日（YYYY-MM-01），作为「每月」计数的桶键。
 * user_daily_usage.day 是 date 列，按月计数时复用该列存当月 1 号，
 * 与按天桶以 kind 区分（generate_route / generate_route_month），互不干扰。
 */
export function localMonthString(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-01`;
}

/**
 * 读某人某个计数桶的已用次数（periodKey 由调用方按周期给出：按天=当天日期、按月=当月 1 号）。
 * 查询失败时返回 0（fail-open），不因计数异常阻断用户主流程。
 */
async function readUsage(userId: string, kind: UsageKind, periodKey: string): Promise<number> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('get_user_daily_usage', {
      p_user_id: userId,
      p_day: periodKey,
      p_kind: kind,
    });
    if (error) throw error;
    return typeof data === 'number' ? data : 0;
  } catch (err) {
    console.warn('[member-quota] 用量读取失败，按 0 处理：', err);
    return 0;
  }
}

/** 累加某人某个计数桶的次数（原子累加函数，仅 service_role 可执行）；失败静默跳过 */
async function addUsage(
  userId: string,
  kind: UsageKind,
  periodKey: string,
  count: number,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc('bump_user_daily_usage', {
      p_user_id: userId,
      p_day: periodKey,
      p_kind: kind,
      p_count: count,
    });
    if (error) throw error;
  } catch (err) {
    console.warn('[member-quota] 用量累加失败，忽略：', err);
  }
}

/** 读某人当天某类动作的已用次数（按天桶，如 AI 提取） */
export async function getDailyUsage(userId: string, kind: UsageKind): Promise<number> {
  return readUsage(userId, kind, localDayString());
}

/** 累加某人当天某类动作次数（按天桶）；失败静默跳过 */
export async function bumpDailyUsage(userId: string, kind: UsageKind, count = 1): Promise<void> {
  await addUsage(userId, kind, localDayString(), count);
}

/** 「生成路线」的计数桶：免费落在按天桶，会员落在按月桶（T-054：POST /api/routes 需把桶键传给 guarded RPC） */
export function routeBucket(tier: MemberTier): { kind: UsageKind; periodKey: string } {
  return limitsOf(tier).routeLimitPeriod === 'month'
    ? { kind: USAGE_KIND.GENERATE_ROUTE_MONTH, periodKey: localMonthString() }
    : { kind: USAGE_KIND.GENERATE_ROUTE, periodKey: localDayString() };
}

export interface RouteQuota {
  tier: MemberTier;
  /** 本次判定的周期口径 */
  period: RouteQuotaPeriod;
  limit: number;
  used: number;
  remaining: number;
}

/**
 * 读当前档位「生成路线」本周期的剩余额度。
 * 免费按天（每天 1 条）、会员按月（每月 5 条），周期见 TierLimits.routeLimitPeriod；管理员不限。
 */
export async function getRouteQuota(userId: string, tier: MemberTier): Promise<RouteQuota> {
  const limits = limitsOf(tier);
  if (tier === 'admin') {
    return {
      tier,
      period: limits.routeLimitPeriod,
      limit: Number.POSITIVE_INFINITY,
      used: 0,
      remaining: Number.POSITIVE_INFINITY,
    };
  }
  const { kind, periodKey } = routeBucket(tier);
  const used = await readUsage(userId, kind, periodKey);
  // T-049 会员每月路线上限取后台全局设置（免费档仍按 config/business.ts 的按天上限；缺省回退默认值）
  const settings = await getAppSettings();
  const limit = tier === 'member' ? settings.quotas.memberMonthlyRoutes : limits.routeLimit;
  return {
    tier,
    period: limits.routeLimitPeriod,
    limit,
    used,
    remaining: Math.max(0, limit - used),
  };
}

/** 消耗一次「生成路线」额度（建路线成功后调用）；管理员不计数 */
export async function consumeRouteQuota(userId: string, tier: MemberTier): Promise<void> {
  if (tier === 'admin') return;
  const { kind, periodKey } = routeBucket(tier);
  await addUsage(userId, kind, periodKey, 1);
}

/**
 * 「生成路线」额度用完时的统一响应体：按周期给不同错误码与文案，
 * 免费用户提示「今天」、会员提示「本月」，由调用方包成 429 返回。
 */
export function routeQuotaErrorBody(quota: RouteQuota): { code: string; message: string } {
  return quota.period === 'month'
    ? {
        code: QUOTA_ERROR.ROUTE_MONTHLY_LIMIT,
        message: MESSAGES.ROUTE_MONTHLY_LIMIT_REACHED(quota.limit),
      }
    : {
        code: QUOTA_ERROR.ROUTE_DAILY_LIMIT,
        message: MESSAGES.ROUTE_DAILY_LIMIT_REACHED(quota.limit),
      };
}

/** 置位免费用户「永久 1 次多日行程」试用额度（走 service_role，防前端篡改） */
export async function markTrialMultiDayUsed(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('users')
    .update({ trial_multi_day_used: true })
    .eq('id', userId);
  if (error) throw error;
}

/**
 * 免费用户的直线距离矩阵：用 cos 纬度校正后的直线距离当「伪高德矩阵」，
 * 直接喂给 orderByMatrix（最近邻 + 2-opt），复用 lib/route-order.ts 的现成排序能力，
 * 从而不消耗高德距离矩阵配额。坐标缺失的点两两距离记为 0，矩阵不完整时 orderByMatrix 原样返回。
 */
export function buildStraightMatrix(points: string[]): number[][] {
  const coords = points.map((point) => {
    const [lng, lat] = point.split(',').map(Number);
    return { lat, lng };
  });
  const valid = coords.every((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng));
  const n = coords.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 0 : valid ? straightDist2(coords[i], coords[j]) : 0)),
  );
}

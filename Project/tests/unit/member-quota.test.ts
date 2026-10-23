import { describe, expect, it } from 'vitest';
import { BUSINESS } from '@/config/business';
import { USER_ROLE } from '@/config/enums';
import { isMemberActive, limitsOf, tierOf } from '@/lib/member-quota';

/**
 * T-019 单元测试：会员档位与到期判定（lib/member-quota.ts 纯函数部分）。
 * 对应 docs/acceptance-test-plan.md 的会员分层口径：
 * 管理员不受 member/member_until 影响；member_until 为空 = 永久；已过期回落免费档。
 */

/** 相对当前时间偏移的 ISO 串（正数=未来，负数=过去） */
function isoOffset(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

describe('isMemberActive 四态判定', () => {
  it('管理员恒为有效（即使 member=false 且无到期时间）', () => {
    expect(isMemberActive(USER_ROLE.ADMIN, false, null)).toBe(true);
  });

  it('管理员不受到期时间影响（member_until 已过期仍有效）', () => {
    expect(isMemberActive(USER_ROLE.ADMIN, false, isoOffset(-30))).toBe(true);
  });

  it('member=true 且 member_until 为空 = 永久会员', () => {
    expect(isMemberActive(USER_ROLE.USER, true, null)).toBe(true);
  });

  it('member=true 且未到期 = 有效', () => {
    expect(isMemberActive(USER_ROLE.USER, true, isoOffset(7))).toBe(true);
  });

  it('member=true 但已过期 = 无效（惰性判定，回落免费档）', () => {
    expect(isMemberActive(USER_ROLE.USER, true, isoOffset(-1))).toBe(false);
  });

  it('member=false 时无论 member_until 为何都无效', () => {
    expect(isMemberActive(USER_ROLE.USER, false, isoOffset(30))).toBe(false);
  });
});

describe('tierOf 档位派生', () => {
  it('role=admin 优先于 member 标志', () => {
    expect(tierOf(USER_ROLE.ADMIN, false)).toBe('admin');
  });

  it('member=true 为会员档', () => {
    expect(tierOf(USER_ROLE.USER, true)).toBe('member');
  });

  it('其余（含空值）为免费档', () => {
    expect(tierOf(USER_ROLE.USER, false)).toBe('free');
    expect(tierOf(null, null)).toBe('free');
  });
});

describe('limitsOf 各档位配额（与 config/business.ts 常量对齐，防漂移）', () => {
  it('免费档：按天计数，取 FREE_* 常量', () => {
    const l = limitsOf('free');
    expect(l.routeLimit).toBe(BUSINESS.FREE_DAILY_ROUTE_LIMIT);
    expect(l.routeLimitPeriod).toBe('day');
    expect(l.maxDays).toBe(BUSINESS.FREE_MAX_DAYS);
    expect(l.placesPerDay).toBe(BUSINESS.FREE_MAX_PLACES_PER_DAY);
    expect(l.aiExtract).toBe(BUSINESS.FREE_AI_EXTRACT_DAILY_LIMIT);
  });

  it('会员档：按月计数，取 MEMBER_* 常量', () => {
    const l = limitsOf('member');
    expect(l.routeLimit).toBe(BUSINESS.MEMBER_MONTHLY_ROUTE_LIMIT);
    expect(l.routeLimitPeriod).toBe('month');
    expect(l.maxDays).toBe(BUSINESS.MEMBER_MAX_DAYS);
    expect(l.placesPerDay).toBe(BUSINESS.MEMBER_MAX_PLACES_PER_DAY);
    expect(l.aiExtract).toBe(BUSINESS.MEMBER_AI_EXTRACT_DAILY_LIMIT);
  });

  it('管理员档：全部不限', () => {
    const l = limitsOf('admin');
    expect(l.routeLimit).toBe(Number.POSITIVE_INFINITY);
    expect(l.maxDays).toBe(Number.POSITIVE_INFINITY);
    expect(l.placesPerDay).toBe(Number.POSITIVE_INFINITY);
    expect(l.aiExtract).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('T-028 会员价格与配额（config/business.ts 单一事实源）', () => {
  it('月卡价格为 990 分（¥9.9），不得回退到旧价', () => {
    expect(BUSINESS.MEMBER_PLANS[0].priceCents).toBe(990);
  });

  it('会员档每月路线配额为 5 条', () => {
    expect(BUSINESS.MEMBER_MONTHLY_ROUTE_LIMIT).toBe(5);
    expect(limitsOf('member').routeLimit).toBe(5);
  });
});

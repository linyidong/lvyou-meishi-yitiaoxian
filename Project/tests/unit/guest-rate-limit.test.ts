import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUSINESS } from '@/config/business';

/**
 * T-019 单元测试：游客免登录接口限流（lib/guest-rate-limit.ts）。
 * 模块内部是内存 Map 计数，用 vi.resetModules + 动态 import 保证每个用例拿到全新模块。
 * 分桶口径（AGENTS.md 铁律 2）：花钱桶 order/import 3 次/日；只读桶 city-places 100 次/日；重排桶 reorder 60 次/日。
 */

type Module = typeof import('@/lib/guest-rate-limit');

async function freshModule(): Promise<Module> {
  vi.resetModules();
  return import('@/lib/guest-rate-limit');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-15T10:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('checkGuestRateLimit 分桶与上限', () => {
  it('order 桶：同一 key 前 3 次放行且 remaining 递减，第 4 次拒绝', async () => {
    const { checkGuestRateLimit } = await freshModule();
    const key = 'ck:aaa';
    expect(checkGuestRateLimit(key, 'order')).toMatchObject({
      ok: true,
      limit: BUSINESS.GUEST_TRY_RATE_LIMIT_PER_DAY,
      remaining: 2,
    });
    expect(checkGuestRateLimit(key, 'order').remaining).toBe(1);
    expect(checkGuestRateLimit(key, 'order').remaining).toBe(0);
    expect(checkGuestRateLimit(key, 'order')).toEqual({ ok: false, limit: 3, remaining: 0 });
  });

  it('不同桶互不影响：order 用满后 city-places 仍放行', async () => {
    const { checkGuestRateLimit } = await freshModule();
    const key = 'ck:bbb';
    for (let i = 0; i < 3; i += 1) expect(checkGuestRateLimit(key, 'order').ok).toBe(true);
    expect(checkGuestRateLimit(key, 'order').ok).toBe(false);
    const city = checkGuestRateLimit(key, 'city-places');
    expect(city.ok).toBe(true);
    expect(city.limit).toBe(BUSINESS.GUEST_CITY_PLACES_RATE_LIMIT_PER_DAY);
  });

  it('不同 key 互不影响：A 用满 order 后 B 仍可调用', async () => {
    const { checkGuestRateLimit } = await freshModule();
    for (let i = 0; i < 3; i += 1) expect(checkGuestRateLimit('ck:key-a', 'order').ok).toBe(true);
    expect(checkGuestRateLimit('ck:key-a', 'order').ok).toBe(false);
    expect(checkGuestRateLimit('ck:key-b', 'order').ok).toBe(true);
  });

  it('各桶上限与 BUSINESS 常量一致（花钱桶 3 / 只读桶 100 / 重排桶 60）', async () => {
    const { checkGuestRateLimit } = await freshModule();
    expect(checkGuestRateLimit('ck:c1', 'order').limit).toBe(BUSINESS.GUEST_TRY_RATE_LIMIT_PER_DAY);
    expect(checkGuestRateLimit('ck:c2', 'import').limit).toBe(BUSINESS.GUEST_TRY_RATE_LIMIT_PER_DAY);
    expect(checkGuestRateLimit('ck:c3', 'city-places').limit).toBe(
      BUSINESS.GUEST_CITY_PLACES_RATE_LIMIT_PER_DAY,
    );
    expect(checkGuestRateLimit('ck:c4', 'reorder').limit).toBe(
      BUSINESS.GUEST_REORDER_RATE_LIMIT_PER_DAY,
    );
  });

  it('按「服务器本地日期」重置：跨天后同 key 重新放行', async () => {
    const { checkGuestRateLimit } = await freshModule();
    const key = 'ck:ddd';
    for (let i = 0; i < 3; i += 1) expect(checkGuestRateLimit(key, 'order').ok).toBe(true);
    expect(checkGuestRateLimit(key, 'order').ok).toBe(false);
    // 推进到次日（本地口径按 localDayString 的 YYYY-MM-DD）
    vi.setSystemTime(new Date('2026-01-16T00:00:01'));
    expect(checkGuestRateLimit(key, 'order').ok).toBe(true);
  });
});

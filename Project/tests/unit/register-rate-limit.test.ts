import { beforeEach, describe, expect, it } from 'vitest';
import { BUSINESS } from '@/config/business';
import { resetRegisterRateForTest, takeRegisterSlot } from '@/lib/register-rate-limit';

/** T-104 注册限流：单 IP 每小时/每天 + 全站每天 */
describe('T-104 注册限流', () => {
  beforeEach(() => resetRegisterRateForTest());

  const at = (h: number, m = 0) => new Date(2026, 10, 12, h, m, 0);

  it('同一 IP 每小时第 4 次被拦', () => {
    for (let i = 0; i < BUSINESS.REGISTER_IP_PER_HOUR; i += 1) {
      expect(takeRegisterSlot('1.1.1.1', at(10, i)).ok).toBe(true);
    }
    const blocked = takeRegisterSlot('1.1.1.1', at(10, 50));
    expect(blocked).toEqual({ ok: false, reason: 'ip-hour' });
  });

  it('下一小时恢复', () => {
    for (let i = 0; i < BUSINESS.REGISTER_IP_PER_HOUR; i += 1) takeRegisterSlot('1.1.1.1', at(10, i));
    expect(takeRegisterSlot('1.1.1.1', at(11, 1)).ok).toBe(true);
  });

  it('同一 IP 每天累计上限', () => {
    let allowed = 0;
    for (let h = 0; h < 24 && allowed < BUSINESS.REGISTER_IP_PER_DAY; h += 1) {
      for (let k = 0; k < BUSINESS.REGISTER_IP_PER_HOUR; k += 1) {
        if (takeRegisterSlot('2.2.2.2', at(h, k)).ok) allowed += 1;
      }
    }
    expect(allowed).toBe(BUSINESS.REGISTER_IP_PER_DAY);
    expect(takeRegisterSlot('2.2.2.2', at(23, 59))).toEqual({ ok: false, reason: 'ip-day' });
  });

  it('不同 IP 互不影响', () => {
    for (let i = 0; i < BUSINESS.REGISTER_IP_PER_HOUR; i += 1) takeRegisterSlot('3.3.3.3', at(9, i));
    expect(takeRegisterSlot('4.4.4.4', at(9, 59)).ok).toBe(true);
  });

  it('全站每天上限（大量 IP 也拦住）', () => {
    let allowed = 0;
    for (let i = 0; i < BUSINESS.REGISTER_GLOBAL_PER_DAY + 10; i += 1) {
      if (takeRegisterSlot(`10.0.0.${i}`, at(12, 0)).ok) allowed += 1;
    }
    expect(allowed).toBe(BUSINESS.REGISTER_GLOBAL_PER_DAY);
    expect(takeRegisterSlot('10.9.9.9', at(12, 1))).toEqual({ ok: false, reason: 'global-day' });
  });
});

import { describe, expect, it } from 'vitest';
import { BUSINESS, billingOrderBlocked } from '@/config/business';
import { MESSAGES } from '@/config/messages';

/**
 * T-025 单元测试：内测模式付费开关（BILLING_ENABLED）。
 * 合规依据 docs/decisions.md D-14：个人主体备案不得在线收费，
 * 开关关闭时服务端 POST /api/member/orders 必须兜底 403（不能只靠前端隐藏）。
 * 开关判断抽成纯函数 billingOrderBlocked，这里双向断言。
 */
describe('T-025 内测模式付费开关', () => {
  it('兜底判断与开关保持一致：blocked 恒等于 !BILLING_ENABLED', () => {
    // 2026-10-23 D-15 起开关已有意改为 true（小范围验证付费意愿），
    // 这里不再硬编码当前配置值，只断言「拦截判断由开关驱动」这一不变量。
    expect(billingOrderBlocked()).toBe(!BUSINESS.BILLING_ENABLED);
  });

  it('开关打开（企业主体 + 经营性备案就绪）后放行下单', () => {
    expect(billingOrderBlocked(true)).toBe(false);
  });

  it('403 兜底文案已配置（服务端与前端购买区共用）', () => {
    expect(MESSAGES.MEMBER_ORDER.paused).toBe('内测阶段暂未开放购买，感谢关注');
  });
});

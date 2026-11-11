import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { PRODUCT } from '@/config/product';

/**
 * T-092 单元测试：页脚备案号（合规）
 * 规则：配置了备案号 → 渲染指向工信部的链接；未配置 → 不渲染空链接。
 * 注意：测试用号码是假的，真实备案号在 `Project/config/product.ts` 的 P06。
 */
describe('T-092 页脚备案号', () => {
  afterEach(cleanup);

  it('配置备案号后渲染工信部链接（新窗口 + noopener）', () => {
    const { container } = render(<SiteFooter icpNumber="闽ICP备12345678号-1" />);
    const link = within(container).getByRole('link', { name: '闽ICP备12345678号-1' });
    expect(link.getAttribute('href')).toBe('https://beian.miit.gov.cn/');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('未配置备案号（空串/空白）时不渲染链接', () => {
    const { container } = render(<SiteFooter icpNumber="   " />);
    expect(within(container).queryByRole('link')).toBeNull();
  });

  it('版权行使用产品名', () => {
    const { container } = render(<SiteFooter icpNumber="" />);
    expect(container.textContent).toContain(PRODUCT.NAME);
    expect(container.textContent).toContain(String(new Date().getFullYear()));
  });
});

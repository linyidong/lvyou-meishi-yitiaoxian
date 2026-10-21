import { expect, test } from '@playwright/test';

/**
 * T-019 E2E 冒烟：证明「浏览器 → dev server → 页面渲染」链路可用。
 * 只断言真实渲染内容（标题=PRODUCT.NAME、城市页热门城市卡），不写空断言。
 */

test('首页可打开且标题为产品名', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('旅行美食一条线');
});

test('/city 渲染出城市选择内容', async ({ page }) => {
  await page.goto('/city');
  // 热门城市卡第一张为「北京」（HOT_CITIES 顺序），游客态也会渲染城市网格
  await expect(page.getByText('北京').first()).toBeVisible({ timeout: 15_000 });
});

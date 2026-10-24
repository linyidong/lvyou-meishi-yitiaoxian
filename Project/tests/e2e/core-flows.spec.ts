import { expect, test, type Page } from '@playwright/test';

/**
 * T-024 阶段 8 验收：核心链路 E2E（6 条）。
 * 凭据只从 process.env.TEST_EMAIL / TEST_PASSWORD 读取（由 playwright.config.ts
 * 从 .env.test.local 加载）；文件缺失时鉴权类用例 skip，不失败。
 * 禁止在本文件出现任何明文密码。
 */

const hasCreds = Boolean(process.env.TEST_EMAIL && process.env.TEST_PASSWORD);
const NO_CREDS_REASON = '缺少 Project/.env.test.local（TEST_EMAIL/TEST_PASSWORD），跳过鉴权类用例';
// 注意：本机 playwright 1.64.1 实测——`test(title, { skip: bool }, body)` 选项式不生效
// （凭据缺失时用例体仍执行并因 env undefined 失败），`timeout` 也不在 TestDetails 类型中
// （typecheck 报 TS2353）。故 skip 用函数体内 `test.skip(cond, reason)`、超时用
// `test.setTimeout(ms)`，两者均已实测有效。

/** 管理员登录：/admin/login 表单 #email / #pwd，提交后进 /admin */
async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login');
  await page.fill('#email', process.env.TEST_EMAIL as string);
  await page.fill('#pwd', process.env.TEST_PASSWORD as string);
  await page.click('button[type="submit"]');
}

/** 用户登录：/login 表单 #email / #password */
async function loginAsUser(page: Page) {
  await page.goto('/login');
  await page.fill('#email', process.env.TEST_EMAIL as string);
  await page.fill('#password', process.env.TEST_PASSWORD as string);
  await page.click('button[type="submit"]');
}

/**
 * 游客三步链路（真实 UI 操作）：
 * /city 选第一个有数据的城市 → /try/new 选出发城市并下一步 → /try/pick 勾 2 个地点生成路线 → /try/result
 * 结果页首屏会调 /api/try/order（高德距离矩阵/路径规划，可能较慢），断言处给足超时。
 */
async function driveGuestFlow(page: Page) {
  // 第 1 步：/city —— 游客态下无数据城市被 disabled，点第一个可选卡片
  await page.goto('/city');
  const cityCard = page.locator('button.rounded-2xl.border-2:not([disabled])').first();
  await expect(cityCard).toBeVisible({ timeout: 20_000 });
  await cityCard.click();
  await page.getByRole('button', { name: '下一步：设置路线' }).click();

  // 第 2 步：/try/new —— 标题有默认值，只需选出发城市
  await expect(page).toHaveURL(/\/try\/new\?city=/, { timeout: 15_000 });
  const originChip = page.locator('#originGrid button').first();
  await expect(originChip).toBeVisible({ timeout: 15_000 });
  await originChip.click();
  await page.getByRole('button', { name: '下一步：挑选地点' }).click();

  // 第 3 步：/try/pick —— 勾选 2 个地点（GUEST_TRY_MIN_PLACES=2）后生成路线
  await expect(page).toHaveURL(/\/try\/pick/, { timeout: 15_000 });
  const checkboxes = page.locator('input[type="checkbox"]:not([disabled])');
  await expect(checkboxes.first()).toBeVisible({ timeout: 30_000 });
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  await page.getByRole('button', { name: /用 \d+ 个地点生成路线/ }).click();

  await expect(page).toHaveURL(/\/try\/result/, { timeout: 15_000 });
}

test('E2E-01 管理员登录 → /admin 概览渲染无 500', async ({ page }) => {
  test.skip(!hasCreds, NO_CREDS_REASON);
  await loginAsAdmin(page);
  await expect(page).toHaveURL(/\/admin($|\?|#)/, { timeout: 30_000 });
  // 概览页标题渲染（AdminShell navOverview=「概览」）
  await expect(page.getByText('概览').first()).toBeVisible({ timeout: 15_000 });
  // 未落入错误态（AdminErrorState 的「加载失败」类文案不应出现）
  await expect(page.getByText(/加载失败|服务器错误/)).toHaveCount(0);
});

test('E2E-02 后台路线列表：手机视口卡片 / 桌面视口表格', async ({ page }) => {
  test.skip(!hasCreds, NO_CREDS_REASON);
  await loginAsAdmin(page);
  // 必须等登录重定向真正落到 /admin（宽松 /\/admin/ 会匹配 /admin/login 本身，
  // 导致会话 cookie 未就绪就 goto /admin/routes 被中间件踢回登录页）
  await expect(page).toHaveURL(/\/admin($|\?|#)/, { timeout: 30_000 });
  await page.goto('/admin/routes');

  const cards = page.locator('ul.md\\:hidden');
  const table = page.locator('div.hidden.md\\:block table');

  // 手机视口（375px）：卡片可见、表格隐藏
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(cards).toBeVisible({ timeout: 15_000 });
  await expect(table).toBeHidden();

  // 桌面视口（1280px）：表格可见、卡片隐藏（表格未被删除）
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(table).toBeVisible({ timeout: 15_000 });
  await expect(cards).toBeHidden();
});

test('E2E-03 游客三步 → /try/result：地图 + 路线列表 ≥1 项 + 一键复位按钮', async ({ page }) => {
  // 结果页首屏调 /api/try/order（高德矩阵/规划），弱网时较慢，给足超时
  test.setTimeout(180_000);
  await driveGuestFlow(page);

  // 路线列表 ≥1 项（结果页 <ol> 中的 SortablePlaceRow）
  const rows = page.locator('ol li');
  await expect(rows.first()).toBeVisible({ timeout: 90_000 });

  // 一键复位按钮存在（初始未调序时为禁用态，属预期）
  await expect(page.getByRole('button', { name: '一键复位' })).toBeVisible({ timeout: 10_000 });

  // 地图渲染：高德 SDK 在容器内挂载 .amap-container（外网 SDK，给 30s 超时）
  await expect(page.locator('.amap-container').first()).toBeVisible({ timeout: 30_000 });
});

test('E2E-04 游客点「保存路线」→ 跳登录且带 redirect 参数', async ({ page }) => {
  test.setTimeout(180_000);
  await driveGuestFlow(page);
  await expect(page.locator('ol li').first()).toBeVisible({ timeout: 90_000 });

  await page.getByRole('button', { name: '保存路线' }).click();
  // goSave: router.push('/login?redirect=' + encodeURIComponent('/try/result'))
  await expect(page).toHaveURL(/\/login\?redirect=%2Ftry%2Fresult/, { timeout: 15_000 });
  await expect(page.getByText('旅行美食一条线').first()).toBeVisible();
});

test('E2E-05 已登录用户 → /profile 会员卡渲染并显示档位', async ({ page }) => {
  test.skip(!hasCreds, NO_CREDS_REASON);
  await loginAsUser(page);
  await expect(page).toHaveURL(/\/profile/, { timeout: 30_000 });

  // 会员卡三态之一（管理员 / 会员 / 正常版），证明档位已按身份渲染
  await expect(
    page.getByText(/你当前是管理员（最高级会员）|你已成为会员用户|你当前是正常版/).first(),
  ).toBeVisible({ timeout: 15_000 });
});

test('E2E-06 未登录访问 /routes → 重定向到登录页', async ({ page }) => {
  await page.goto('/routes');
  // middleware: redirectTo(LOGIN, { redirect: pathname })
  await expect(page).toHaveURL(/\/login\?redirect=%2Froutes/, { timeout: 15_000 });
});

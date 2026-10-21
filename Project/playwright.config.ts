import { defineConfig, devices } from '@playwright/test';

/**
 * T-019 E2E 配置（playwright）：
 * - 复用已在 127.0.0.1:3000 运行的 dev server（reuseExistingServer），不再起端口、不 pkill 现有服务；
 * - 只有 dev 没在跑时才自动执行 `npm run dev` 兜底；
 * - 仅 chromium（用户批准引入的浏览器）。
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

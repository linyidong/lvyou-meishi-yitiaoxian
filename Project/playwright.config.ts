import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * T-024：若存在 Project/.env.test.local（已被 .gitignore 忽略），把其中的
 * TEST_EMAIL / TEST_PASSWORD 读进 process.env 供鉴权类用例使用；
 * 文件不存在时不报错——用例侧按「凭据缺失」自行 skip。
 * 密码只存在于该本地文件，绝不写进任何仓库文件，也不打印到日志。
 */
function loadTestEnvLocal() {
  const file = resolve(__dirname, '.env.test.local');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    const value = m[2].trim().replace(/^"(.*)"$/, '$1');
    if (value && process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}
loadTestEnvLocal();

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

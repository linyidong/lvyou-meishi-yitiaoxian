import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * T-019 单元测试配置（vitest）：
 * - 别名 @/* 与 tsconfig.json paths 保持一致（指向 Project/ 根）；
 * - environment jsdom：为后续组件测试（@testing-library/react）预留 DOM；
 * - 只收 tests/unit 下的 *.test.ts(x)，E2E 由 playwright 负责，互不干扰。
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
  },
});

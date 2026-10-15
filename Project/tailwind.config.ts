import type { Config } from 'tailwindcss';

// 产品色值统一从 config/product.ts 读取（S01-S04），此处禁止写死产品色。
import { PRODUCT } from './config/product';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './config/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // 中性色（非产品色，仅用于边框/次要文字）
        border: '#E5E7EB',
        input: '#E5E7EB',
        muted: {
          DEFAULT: '#F3F4F6',
          foreground: '#6B7280',
        },
        destructive: {
          DEFAULT: '#EF4444',
          foreground: '#FFFFFF',
        },
        // 产品色（来自 config/product.ts）
        background: PRODUCT.COLOR_BACKGROUND,
        foreground: PRODUCT.COLOR_TEXT,
        ring: PRODUCT.COLOR_PRIMARY,
        primary: {
          DEFAULT: PRODUCT.COLOR_PRIMARY,
          foreground: PRODUCT.COLOR_BACKGROUND,
        },
        // 主色渐变两端（S01a/S01b）：用法 bg-gradient-to-r from-primary-from to-primary-to
        'primary-from': PRODUCT.COLOR_PRIMARY_FROM,
        'primary-to': PRODUCT.COLOR_PRIMARY_TO,
        secondary: {
          DEFAULT: PRODUCT.COLOR_SECONDARY,
          foreground: PRODUCT.COLOR_TEXT,
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;

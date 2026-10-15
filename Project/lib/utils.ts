import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** 合并 tailwind class（shadcn 组件通用） */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 登录后跳转目标校验（U01 / A01）。
 * 只接受站内相对路径，挡住 `//evil.com`、`http://…` 这类开放重定向。
 */
export function sanitizeRedirect(raw: unknown, fallback: string) {
  if (typeof raw !== 'string' || raw.length === 0) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  return raw;
}

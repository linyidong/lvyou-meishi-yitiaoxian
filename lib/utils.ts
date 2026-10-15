import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** 合并 tailwind class（shadcn 组件通用） */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

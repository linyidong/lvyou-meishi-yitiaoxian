'use client';

import { useRouter } from 'next/navigation';
import { RotateCw } from 'lucide-react';
import { MESSAGES } from '@/config/messages';

/**
 * T-017 C9：分享页「加载失败」分支的重试按钮。
 * 客户端 `router.refresh()` 重新触发服务端组件查询（Supabase 恢复后即可正常渲染），
 * 视觉与分享页现有主按钮（返回首页）一致。
 */
export function ShareReloadButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary-from to-primary-to px-5 text-sm font-semibold text-white hover:brightness-110"
    >
      <RotateCw className="h-4 w-4" />
      {MESSAGES.SHARE.reload}
    </button>
  );
}

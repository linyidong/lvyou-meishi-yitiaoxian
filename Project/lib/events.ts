'use client';

import type { EventName } from '@/types';

/**
 * 埋点（技术方案 v1.1 §4.9）：改为同源 API（POST /api/events）由服务端写库。
 *
 * 为什么不用浏览器直连 Supabase：应用可能跑在局域网另一台机器（Windows），
 * 手机访问时 NEXT_PUBLIC_SUPABASE_URL 若是 127.0.0.1 会指向手机自己。
 * 未登录或失败都静默跳过，不影响主流程。
 */
export async function trackEvent(eventName: EventName, metadata?: Record<string, unknown>) {
  try {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName, metadata }),
      keepalive: true,
    });
  } catch {
    // 埋点失败不影响主流程
  }
}

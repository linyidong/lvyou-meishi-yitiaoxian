'use client';

import { BUSINESS } from '@/config/business';

const HEARTBEAT_ENDPOINT = '/api/heartbeat';

async function report(currentPath: string) {
  try {
    await fetch(HEARTBEAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: currentPath }),
      keepalive: true,
    });
  } catch {
    // M12：心跳静默失败，不打扰用户
  }
}

/**
 * 登录后开始上报在线状态（技术方案 v1.1 §4.7）：
 * 每 BUSINESS.HEARTBEAT_INTERVAL_SECONDS 秒一次，页面隐藏时暂停。
 * 返回值用于组件卸载时停止。
 */
export function startHeartbeat(): () => void {
  const tick = () => {
    if (document.visibilityState === 'hidden') return;
    void report(window.location.pathname);
  };

  tick();
  const timer = window.setInterval(tick, BUSINESS.HEARTBEAT_INTERVAL_SECONDS * 1000);

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') tick();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}

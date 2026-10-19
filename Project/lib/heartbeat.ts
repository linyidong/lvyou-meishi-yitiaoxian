'use client';

import { BUSINESS } from '@/config/business';

const HEARTBEAT_ENDPOINT = '/api/heartbeat';
/** 两次上报之间的最小间隔（毫秒）：页面重挂载 / 可见性事件抖动时兜底限流 */
const MIN_REPORT_GAP_MS = 30_000;

/** 同一页面只允许存在一个心跳定时器（模块级单例护栏） */
let stopCurrent: (() => void) | null = null;
/** 上次真正发出上报的时间戳，用于限流 */
let lastReportedAt = 0;

async function report(currentPath: string) {
  const now = Date.now();
  if (now - lastReportedAt < MIN_REPORT_GAP_MS) return;
  lastReportedAt = now;

  try {
    await fetch(HEARTBEAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: currentPath }),
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
  // 已有定时器在跑：先停掉旧的，避免重挂载叠加出多个 interval 造成请求风暴
  stopCurrent?.();

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

  const stop = () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    if (stopCurrent === stop) stopCurrent = null;
  };
  stopCurrent = stop;

  return stop;
}

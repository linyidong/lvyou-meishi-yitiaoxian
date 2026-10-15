'use client';

import { useEffect } from 'react';
import { startHeartbeat } from '@/lib/heartbeat';

/** 挂载后开始上报在线状态，卸载时停止（技术方案 v1.1 §4.7） */
export function HeartbeatProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => startHeartbeat(), []);

  return <>{children}</>;
}

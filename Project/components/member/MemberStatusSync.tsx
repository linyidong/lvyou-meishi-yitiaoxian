'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BUSINESS } from '@/config/business';

/**
 * T-028 会员状态实时同步（无 UI 的隐形组件，仅登录用户挂载，未登录不发请求）。
 * - 每 BUSINESS.MEMBER_STATUS_POLL_SECONDS（20s）轮询 GET /api/member/status；
 * - 页面切回可见（visibilitychange）或窗口重新聚焦（focus）时立即补拉一次，不等下一个周期；
 * - member / memberUntil / role 任一与上次快照不同 → router.refresh()，
 *   让服务端布局与页面按新身份重渲染（顶部徽标、个人中心会员卡、配额判定随之更新）。
 * 不使用 Supabase Realtime（本项目未启用该服务）；单次拉取失败静默，下一轮继续。
 */
export function MemberStatusSync() {
  const router = useRouter();
  /** 最近一次成功读取的状态快照（JSON 串）；null = 尚未建立基线 */
  const baselineRef = useRef<string | null>(null);

  useEffect(() => {
    let stopped = false;

    async function pull() {
      try {
        const res = await fetch('/api/member/status', { cache: 'no-store' });
        if (!res.ok || stopped) return;
        const data = (await res.json()) as {
          ok: boolean;
          member?: boolean;
          memberUntil?: string | null;
          role?: string | null;
        };
        if (!data.ok) return;
        const snapshot = JSON.stringify([
          data.member ?? false,
          data.memberUntil ?? null,
          data.role ?? null,
        ]);
        // 首次拉取只建立基线（SSR 已按当前身份渲染过），不触发 refresh
        if (baselineRef.current === null) {
          baselineRef.current = snapshot;
          return;
        }
        if (snapshot !== baselineRef.current) {
          baselineRef.current = snapshot;
          router.refresh();
        }
      } catch {
        // 静默：网络 / 解析异常等下一轮轮询或聚焦补拉再试
      }
    }

    void pull();
    const timer = window.setInterval(
      () => void pull(),
      BUSINESS.MEMBER_STATUS_POLL_SECONDS * 1000,
    );
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pull();
    };
    const onFocus = () => void pull();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [router]);

  return null;
}

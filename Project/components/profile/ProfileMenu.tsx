'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Heart, LogOut, MapPinPlus, MessageSquare, Route } from 'lucide-react';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';

const M = MESSAGES.PROFILE;

/**
 * U10 个人中心菜单：我的路线 / 我的收藏地点 / 新建路线 / 意见反馈 / 退出登录。
 * 退出登录复用 POST /api/auth/logout，成功后整页跳回首页。
 */
export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      // 会话 cookie 已清除，整页重载确保服务端渲染的状态一起刷新
      window.location.assign(ROUTES.HOME);
    }
  }

  return (
    <>
      <section className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <Link href={ROUTES.MY_ROUTES} className="flex items-center gap-3 px-5 py-4 hover:bg-stone-50">
          <Route className="h-5 w-5 text-stone-500" />
          <span className="flex-1">{M.menuRoutes}</span>
          <ChevronRight className="h-4 w-4 text-stone-400" />
        </Link>
        <Link href={ROUTES.COLLECTED} className="flex items-center gap-3 px-5 py-4 hover:bg-stone-50">
          <Heart className="h-5 w-5 text-stone-500" />
          <span className="flex-1">{M.menuCollected}</span>
          <span className="mr-1 text-xs text-stone-400">{M.collectedNewTag}</span>
          <ChevronRight className="h-4 w-4 text-stone-400" />
        </Link>
        <Link href={ROUTES.ROUTE_NEW} className="flex items-center gap-3 px-5 py-4 hover:bg-stone-50">
          <MapPinPlus className="h-5 w-5 text-stone-500" />
          <span className="flex-1">{M.menuNewRoute}</span>
          <ChevronRight className="h-4 w-4 text-stone-400" />
        </Link>
        <a
          href={`mailto:${M.feedbackEmail}`}
          className="flex items-center gap-3 px-5 py-4 hover:bg-stone-50"
        >
          <MessageSquare className="h-5 w-5 text-stone-500" />
          <span className="flex-1">{M.menuFeedback}</span>
          <span className="text-xs text-stone-400">{M.feedbackEmail}</span>
        </a>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 px-5 py-4 text-left text-red-600 hover:bg-red-50"
        >
          <LogOut className="h-5 w-5" />
          <span className="flex-1">{M.menuLogout}</span>
        </button>
      </section>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6">
            <h3 className="text-lg font-semibold">{M.logoutTitle}</h3>
            <p className="mt-2 text-sm text-stone-600">{M.logoutDesc}</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                className="h-11 rounded-xl border border-stone-300 text-sm disabled:opacity-50"
              >
                {M.cancel}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={logout}
                className="h-11 rounded-xl bg-red-600 text-sm font-semibold text-white disabled:opacity-50"
              >
                {M.logoutConfirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

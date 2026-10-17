'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Heart, LayoutDashboard, LogOut, Route, User } from 'lucide-react';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';

/**
 * 已登录时的右上角用户头像菜单（对齐原型头像样式，保留下拉功能）。
 * isAdmin 由服务端（app/(user)/layout.tsx）按 users.role 判定后传入，
 * 「管理后台」入口只在管理员账号下渲染，普通用户的前端源码里不会出现该链接。
 */
export function UserMenu({ displayName, isAdmin = false }: { displayName: string; isAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function logout() {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      // 会话 cookie 已清除，整页重载确保服务端渲染的状态一起刷新
      window.location.assign(ROUTES.HOME);
    }
  }

  const items = [
    // 「管理后台」仅管理员可见，置于最前，视觉上与其他项区分（主色文字）
    ...(isAdmin
      ? [{ href: ROUTES.ADMIN_HOME, label: MESSAGES.ADMIN_ENTRY_TITLE, icon: LayoutDashboard, accent: true }]
      : []),
    { href: ROUTES.PROFILE, label: MESSAGES.NAV_PROFILE, icon: User, accent: false },
    { href: ROUTES.COLLECTED, label: MESSAGES.NAV_COLLECTED, icon: Heart, accent: false },
    { href: ROUTES.MY_ROUTES, label: MESSAGES.NAV_MY_ROUTES, icon: Route, accent: false },
  ];

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm text-stone-700 hover:text-primary"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 font-semibold text-primary">
          {displayName.slice(0, 1)}
        </span>
        <span className="hidden max-w-28 truncate sm:inline">{displayName}</span>
        <ChevronDown className="hidden h-3.5 w-3.5 sm:block" />
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-stone-50 ${
                item.accent ? 'font-semibold text-primary' : 'text-stone-700'
              }`}
            >
              <item.icon
                className={`h-4 w-4 ${item.accent ? 'text-primary' : 'text-stone-400'}`}
              />
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={logout}
            className="flex w-full items-center gap-2 border-t border-stone-200 px-3 py-2 text-sm text-stone-500 hover:bg-stone-50 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            {busy ? MESSAGES.MENU_LOGGING_OUT : MESSAGES.MENU_LOGOUT}
          </button>
        </div>
      ) : null}
    </div>
  );
}

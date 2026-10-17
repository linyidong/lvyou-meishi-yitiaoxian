'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Heart, LayoutDashboard, LogOut, Route, User } from 'lucide-react';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';

/**
 * 已登录时的右上角用户菜单：个人中心 / 我的收藏 / 我的路线 / 退出登录。
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
    { href: ROUTES.PROFILE, label: '个人中心', icon: User, accent: false },
    { href: ROUTES.COLLECTED, label: '我的收藏', icon: Heart, accent: false },
    { href: ROUTES.MY_ROUTES, label: '我的路线', icon: Route, accent: false },
  ];

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-border py-1.5 pl-1.5 pr-2.5 hover:bg-muted"
      >
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-primary text-[11px] font-bold text-primary-foreground">
          {displayName.slice(0, 1)}
        </span>
        <span className="hidden max-w-24 truncate text-xs font-medium sm:inline">{displayName}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded-xl border border-border bg-background py-1 shadow-lg">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted ${
                item.accent ? 'font-medium text-primary' : ''
              }`}
            >
              <item.icon
                className={`h-4 w-4 ${item.accent ? 'text-primary' : 'text-muted-foreground'}`}
              />
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={logout}
            className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            {busy ? '退出中…' : '退出登录'}
          </button>
        </div>
      ) : null}

      {/* 供读屏与提示使用，不占视觉空间 */}
      <span className="sr-only">{MESSAGES.AUTH_LOGOUT_OK}</span>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, LayoutDashboard, LogOut } from 'lucide-react';
import { VipBadge } from '@/components/layout/VipBadge';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';

/**
 * 已登录时的右上角用户区：头像 + 身份徽章 + 用户名。
 * 顶部导航已包含「个人中心 / 收藏夹 / 我的路线」，为避免功能重复：
 * - 普通用户（含会员）：头像不再下拉，点击直接进个人中心，退出登录在个人中心里做；
 * - 管理员：保留下拉，但只留「管理后台」与「退出登录」。
 * isAdmin / isMember 由服务端（app/(user)/layout.tsx）按 users.role、users.member 判定后传入，
 * 普通用户的前端源码与 DOM 里都不会出现管理后台入口，也不会出现任何身份徽章。
 */
export function UserMenu({
  displayName,
  isAdmin = false,
  isMember = false,
}: {
  displayName: string;
  isAdmin?: boolean;
  isMember?: boolean;
}) {
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
      // 会话 cookie 已清除，整页重载确保服务端渲染的状态一起刷新；退出后回登录页
      window.location.assign(ROUTES.LOGIN);
    }
  }

  // 管理员默认最高级会员，标识取更醒目的「超级 VIP」；会员取金色「VIP」；普通用户不显示
  const badge = isAdmin ? 'admin' : isMember ? 'vip' : null;

  /** 头像 + 账号名（可点击的那一组），标识单独放在这组之外 */
  const triggerInner = (
    <>
      <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 font-semibold text-primary">
        {displayName.slice(0, 1)}
      </span>
      <span className="hidden max-w-28 truncate sm:inline">{displayName}</span>
    </>
  );

  return (
    <div ref={boxRef} className="relative flex items-center gap-2.5">
      {/* 身份标识：独立的左侧标识，与头像组之间留一段间距，只做展示，不代表任何功能 */}
      {badge ? <VipBadge kind={badge} /> : null}

      {isAdmin ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-sm text-stone-700 hover:text-primary"
        >
          {triggerInner}
          <ChevronDown className="hidden h-3.5 w-3.5 sm:block" />
        </button>
      ) : (
        // 普通用户 / 会员：头像即个人中心入口，不再重复下拉菜单（退出登录在个人中心内）
        <Link href={ROUTES.PROFILE} className="flex items-center gap-2 text-sm text-stone-700 hover:text-primary">
          {triggerInner}
        </Link>
      )}

      {isAdmin && open ? (
        <div className="absolute right-0 top-full z-20 mt-2 w-40 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
          <Link
            href={ROUTES.ADMIN_HOME}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-primary hover:bg-stone-50"
          >
            <LayoutDashboard className="h-4 w-4 text-primary" />
            {MESSAGES.ADMIN_ENTRY_TITLE}
          </Link>
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

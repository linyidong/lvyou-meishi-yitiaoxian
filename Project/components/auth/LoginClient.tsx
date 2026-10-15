'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Mail, Lock, LogIn, UserPlus } from 'lucide-react';
import { BUSINESS } from '@/config/business';
import { MESSAGES } from '@/config/messages';
import { PRODUCT } from '@/config/product';
import { ROUTES } from '@/config/routes';

type Tab = 'login' | 'register';

const inputCls =
  'h-11 w-full rounded-xl border border-border pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';
const tabCls = (on: boolean) =>
  `flex-1 rounded-lg py-2 text-sm font-medium ${on ? 'bg-background shadow-sm' : 'text-muted-foreground'}`;

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/**
 * U01 登录 / 注册 与 A01 管理员登录共用表单。
 * mode=admin 时只有登录、登录后额外校验 role=admin，成功后进管理后台。
 */
export function LoginClient({
  mode,
  initialRedirect,
  initialError,
}: {
  mode: 'user' | 'admin';
  initialRedirect?: string;
  initialError?: string;
}) {
  const router = useRouter();
  const isAdmin = mode === 'admin';
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError ?? '');
  const [notice, setNotice] = useState('');

  function validate(): string {
    if (!email.trim()) return MESSAGES.AUTH_EMAIL_REQUIRED;
    if (!EMAIL_RE.test(email.trim())) return MESSAGES.AUTH_EMAIL_INVALID;
    if (!password) return MESSAGES.AUTH_PASSWORD_REQUIRED;
    if (tab === 'register' && password.length < BUSINESS.MIN_PASSWORD_LENGTH) {
      return MESSAGES.AUTH_PASSWORD_TOO_SHORT;
    }
    return '';
  }

  async function submit() {
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      setNotice('');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/auth/${tab === 'register' ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, admin: isAdmin, redirect: initialRedirect }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        message?: string;
        redirect?: string;
        needConfirm?: boolean;
      };

      if (!data.ok) {
        setError(data.message ?? MESSAGES.AUTH_LOGIN_FAILED);
        return;
      }

      if (data.needConfirm) {
        setNotice(data.message ?? MESSAGES.AUTH_REGISTER_NEED_CONFIRM);
        setTab('login');
        return;
      }

      router.replace(data.redirect ?? (isAdmin ? ROUTES.ADMIN_HOME : ROUTES.PROFILE));
      router.refresh();
    } catch {
      setError(MESSAGES.NETWORK_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      {/* 品牌区 */}
      <div className="mb-6 text-center">
        <Link href={ROUTES.HOME} className="inline-flex items-center gap-2">
          <Image src={PRODUCT.LOGO_PATH} alt={PRODUCT.NAME} width={32} height={32} />
          <span className="text-base font-semibold">{PRODUCT.NAME}</span>
        </Link>
        <p className="mt-2 text-xs text-muted-foreground">{PRODUCT.SLOGAN}</p>
      </div>

      <div className="rounded-2xl border border-border bg-background p-6">
        <h1 className="text-lg font-bold">{isAdmin ? 'A01 管理员登录' : 'U01 登录 / 注册'}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {isAdmin
            ? '仅 role=admin 的账号可进入管理后台；普通账号登录后会被拦下。'
            : '用邮箱 + 密码登录，或用邮箱注册一个新账号。'}
        </p>

        {!isAdmin ? (
          <div className="mt-4 flex rounded-xl bg-muted p-1">
            <button type="button" onClick={() => { setTab('login'); setError(''); }} className={tabCls(tab === 'login')}>
              登录
            </button>
            <button type="button" onClick={() => { setTab('register'); setError(''); }} className={tabCls(tab === 'register')}>
              注册
            </button>
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">邮箱</span>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                value={email}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputCls}
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">密码</span>
            <div className="relative mt-1.5">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                value={password}
                autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submit();
                }}
                placeholder={tab === 'register' ? `至少 ${BUSINESS.MIN_PASSWORD_LENGTH} 位` : '请输入密码'}
                className={inputCls}
              />
            </div>
          </label>
        </div>

        {error ? (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
            {notice}
          </p>
        ) : null}

        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-from to-primary-to font-semibold text-white hover:brightness-110 disabled:opacity-50"
        >
          {tab === 'register' ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
          {busy ? '处理中…' : tab === 'register' ? '注册并登录' : isAdmin ? '进入管理后台' : '登录'}
        </button>

        {initialRedirect ? (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            登录后将回到 {initialRedirect}
          </p>
        ) : null}
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        <Link href={ROUTES.HOME} className="underline">
          返回首页
        </Link>
        {!isAdmin ? (
          <>
            <span className="mx-2">·</span>
            <Link href={ROUTES.ADMIN_LOGIN} className="underline">
              管理员登录
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}

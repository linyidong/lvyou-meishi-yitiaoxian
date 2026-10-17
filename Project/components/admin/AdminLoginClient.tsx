'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, LoaderCircle, ShieldOff } from 'lucide-react';
import { MESSAGES } from '@/config/messages';
import { PRODUCT } from '@/config/product';
import { ROUTES } from '@/config/routes';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/** A01 管理员登录：展示层（登录逻辑复用 POST /api/auth/login，admin:true 校验 role=admin） */
export function AdminLoginClient({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError ?? '');
  const [emailErr, setEmailErr] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [state, setState] = useState<'normal' | 'loading' | 'success' | 'denied'>('normal');
  /** 非管理员账号（denied 状态展示用） */
  const [deniedEmail, setDeniedEmail] = useState('');

  async function submit() {
    setError('');
    setEmailErr('');
    setPwdErr('');

    if (!email.trim()) {
      setEmailErr(MESSAGES.ADMIN_LOGIN_PAGE.emailRequired);
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setEmailErr(MESSAGES.ADMIN_LOGIN_PAGE.emailInvalid);
      return;
    }
    if (!password) {
      setPwdErr(MESSAGES.ADMIN_LOGIN_PAGE.passwordRequired);
      return;
    }

    setState('loading');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, admin: true }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string; redirect?: string };
      if (!data.ok) {
        // 403 + AUTH_ADMIN_ONLY：账号不是管理员（接口已即时登出），走原型「无权限」状态块
        if (res.status === 403 && data.message === MESSAGES.AUTH_ADMIN_ONLY) {
          setDeniedEmail(email.trim());
          setState('denied');
          return;
        }
        setError(data.message ?? MESSAGES.AUTH_LOGIN_FAILED);
        setState('normal');
        return;
      }
      setState('success');
      router.replace(data.redirect ?? ROUTES.ADMIN_HOME);
      router.refresh();
    } catch {
      setError(MESSAGES.NETWORK_ERROR);
      setState('normal');
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex items-center justify-center gap-2">
        <Image src={PRODUCT.LOGO_PATH} alt={PRODUCT.NAME} width={36} height={36} className="h-10 w-10" />
        <div>
          <p className="leading-tight font-bold text-slate-900">{PRODUCT.NAME}</p>
          <p className="text-xs text-slate-500">{MESSAGES.ADMIN_LOGIN_PAGE.siteSub}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        {state === 'loading' ? (
          <div className="py-10 text-center">
            <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-slate-700" />
            <p className="mt-3 text-sm text-slate-500">{MESSAGES.ADMIN_LOGIN_PAGE.verifying}</p>
          </div>
        ) : state === 'denied' ? (
          <div className="py-8 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-50 text-amber-600">
              <ShieldOff className="h-[34px] w-[34px]" />
            </span>
            <p className="mt-4 font-semibold text-slate-900">{MESSAGES.ADMIN_LOGIN_PAGE.deniedTitle}</p>
            <p className="mt-1 text-sm text-slate-500">
              {MESSAGES.ADMIN_LOGIN_PAGE.deniedLead}
              <span className="font-medium text-slate-700">{deniedEmail}</span>
              {MESSAGES.ADMIN_LOGIN_PAGE.deniedTail}
            </p>
            <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setPassword('');
                  setState('normal');
                }}
                className="h-10 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white"
              >
                {MESSAGES.ADMIN_LOGIN_PAGE.deniedSwitch}
              </button>
              <Link
                href={ROUTES.HOME}
                className="flex h-10 items-center justify-center rounded-lg border border-slate-300 px-5 text-sm"
              >
                {MESSAGES.ADMIN_BACK_TO_SITE}
              </Link>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-slate-900">{MESSAGES.ADMIN_LOGIN_PAGE.title}</h1>
            <p className="mt-1 text-sm text-slate-500">{MESSAGES.ADMIN_LOGIN_PAGE.desc}</p>

            {error ? (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            {state === 'success' ? (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                {MESSAGES.ADMIN_LOGIN_PAGE.success}
              </div>
            ) : null}

            <form
              className="mt-6 space-y-4"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="email">
                  {MESSAGES.ADMIN_LOGIN_PAGE.emailLabel}
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={MESSAGES.ADMIN_LOGIN_PAGE.emailPlaceholder}
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                />
                {emailErr ? <p className="mt-1 text-xs text-red-600">{emailErr}</p> : null}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="pwd">
                  {MESSAGES.ADMIN_LOGIN_PAGE.passwordLabel}
                </label>
                <input
                  id="pwd"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={MESSAGES.ADMIN_LOGIN_PAGE.passwordPlaceholder}
                  className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                />
                {pwdErr ? <p className="mt-1 text-xs text-red-600">{pwdErr}</p> : null}
              </div>
              <button
                type="submit"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {MESSAGES.ADMIN_LOGIN_PAGE.submit}
              </button>
            </form>
          </>
        )}
      </section>

      <p className="mt-6 text-center text-xs text-slate-400">{MESSAGES.ADMIN_LOGIN_PAGE.footerNote}</p>
    </div>
  );
}

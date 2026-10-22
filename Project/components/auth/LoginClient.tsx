'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Eye, EyeOff, Footprints, Info, LoaderCircle, Lock, Mail, Rocket, Save, User } from 'lucide-react';
import { BUSINESS } from '@/config/business';
import { MESSAGES } from '@/config/messages';
import { PRODUCT } from '@/config/product';
import { ROUTES } from '@/config/routes';

type Tab = 'login' | 'register';

const inputCls =
  'h-11 w-full rounded-xl border border-stone-300 pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';
const tabCls = (on: boolean) =>
  `flex-1 rounded-lg py-2.5 text-sm font-semibold ${on ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`;

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
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError ?? '');
  const [notice, setNotice] = useState('');

  /** 是否处于「忘记密码 · 自助重置」视图：复用同一张卡片，不额外开页面 */
  const [resetMode, setResetMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const isLogin = tab === 'login';

  function validate(): string {
    if (!email.trim()) return MESSAGES.AUTH_EMAIL_REQUIRED;
    if (!EMAIL_RE.test(email.trim())) return MESSAGES.AUTH_EMAIL_INVALID;
    if (!password) return MESSAGES.AUTH_PASSWORD_REQUIRED;
    if (tab === 'register' && password.length < BUSINESS.MIN_PASSWORD_LENGTH) {
      return MESSAGES.AUTH_PASSWORD_TOO_SHORT;
    }
    return '';
  }

  function switchTab(next: Tab) {
    setTab(next);
    setError('');
    setNotice('');
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

  /** 进入「忘记密码」视图：清空上一步的提示与新密码输入 */
  function openReset() {
    setResetMode(true);
    setError('');
    setNotice('');
    setNewPassword('');
    setConfirmPassword('');
  }

  /** 回到登录 / 注册视图 */
  function closeReset() {
    setResetMode(false);
    setError('');
    setNotice('');
    setNewPassword('');
    setConfirmPassword('');
  }

  /**
   * 提交自助重置：凭注册邮箱直接设新密码（自建库没有 SMTP）。
   * 成功后回到登录视图并回填邮箱，让用户直接用新密码登录。
   */
  async function submitReset() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError(MESSAGES.AUTH_EMAIL_REQUIRED);
      setNotice('');
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError(MESSAGES.AUTH_EMAIL_INVALID);
      setNotice('');
      return;
    }
    if (!newPassword) {
      setError(MESSAGES.AUTH_PASSWORD_REQUIRED);
      setNotice('');
      return;
    }
    if (newPassword.length < BUSINESS.MIN_PASSWORD_LENGTH) {
      setError(MESSAGES.AUTH_PASSWORD_TOO_SHORT);
      setNotice('');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(MESSAGES.RESET_PASSWORD.errMismatch);
      setNotice('');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password: newPassword }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!data.ok) {
        setError(data.message ?? MESSAGES.RESET_PASSWORD.errFailed);
        return;
      }
      setResetMode(false);
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNotice(data.message ?? MESSAGES.RESET_PASSWORD.okNotice);
    } catch {
      setError(MESSAGES.NETWORK_ERROR);
    } finally {
      setBusy(false);
    }
  }

  const submitText = busy
    ? isLogin
      ? MESSAGES.LOGIN_FORM.submitBusyLogin
      : MESSAGES.LOGIN_FORM.submitBusyRegister
    : isLogin
      ? MESSAGES.LOGIN_FORM.submitLogin
      : MESSAGES.LOGIN_FORM.submitRegister;

  const title = isAdmin
    ? MESSAGES.ADMIN_LOGIN.title
    : resetMode
      ? MESSAGES.RESET_PASSWORD.title
      : isLogin
        ? MESSAGES.LOGIN_FORM.titleLogin
        : MESSAGES.LOGIN_FORM.titleRegister;

  return (
    <div className={isAdmin ? 'w-full' : 'grid items-stretch gap-6 md:grid-cols-2 md:gap-10'}>
      {/* 左：渐变面板（仅用户端登录，md 以下隐藏） */}
      {!isAdmin ? (
        <section className="relative min-w-0 hidden flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br from-primary-from to-primary-to p-10 text-white md:flex">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
          <div className="absolute bottom-32 right-10 h-40 w-40 rounded-full bg-amber-400/30" />

          <Link href={ROUTES.HOME} className="relative flex items-center gap-3">
            <Image src={PRODUCT.LOGO_PATH} alt={PRODUCT.NAME} width={36} height={36} className="h-9 w-9" />
            <span className="text-xl font-bold">{PRODUCT.NAME}</span>
          </Link>

          <div className="relative">
            <h1 className="text-3xl font-bold leading-snug">
              {MESSAGES.LOGIN_HERO.titleLines[0]}
              <br />
              {MESSAGES.LOGIN_HERO.titleLines[1]}
            </h1>
            <p className="mt-4 leading-relaxed text-white/80">{MESSAGES.LOGIN_HERO.desc}</p>

            <div className="mt-8 rounded-2xl bg-white/10 p-5">
              <div className="flex items-center justify-between text-sm">
                {MESSAGES.SAMPLE_ROUTE.stations.slice(0, 4).map((name, i) => (
                  <Fragment key={name}>
                    {i > 0 ? (
                      <div className="mx-2 h-0.5 flex-1 border-t-2 border-dashed border-white/50" />
                    ) : null}
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className={`grid h-8 w-8 place-items-center rounded-full font-bold ${
                          i % 2 === 0 ? 'bg-teal-500' : 'bg-amber-500'
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="text-xs text-white/80">{name}</span>
                    </div>
                  </Fragment>
                ))}
              </div>
              <p className="mt-4 flex items-center gap-1 text-xs text-white/80">
                <Footprints className="h-4 w-4" />
                {MESSAGES.SAMPLE_ROUTE.footNote}
              </p>
            </div>
          </div>

          <p className="relative text-xs text-white/70">{MESSAGES.LOGIN_HERO.tagline}</p>
        </section>
      ) : null}

      {/* 右：登录 / 注册白卡 */}
      <section
        className={
          isAdmin
            ? 'rounded-2xl border border-border bg-background p-6'
            : 'min-w-0 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:p-10'
        }
      >
        {!isAdmin ? (
          <Link href={ROUTES.HOME} className="mb-6 flex min-h-10 items-center gap-2 md:hidden">
            <Image src={PRODUCT.LOGO_PATH} alt={PRODUCT.NAME} width={36} height={36} className="h-9 w-9" />
            <span className="font-bold text-stone-900">{PRODUCT.NAME}</span>
          </Link>
        ) : null}

        {!isAdmin && !resetMode ? (
          <div className="mb-6 flex rounded-xl bg-stone-100 p-1">
            <button type="button" onClick={() => switchTab('login')} className={tabCls(isLogin)}>
              {MESSAGES.LOGIN_FORM.tabLogin}
            </button>
            <button type="button" onClick={() => switchTab('register')} className={tabCls(!isLogin)}>
              {MESSAGES.LOGIN_FORM.tabRegister}
            </button>
          </div>
        ) : null}

        <h2 className="text-2xl font-bold text-stone-900">{title}</h2>
        {resetMode ? (
          <p className="mt-2 text-sm text-stone-500">{MESSAGES.RESET_PASSWORD.desc}</p>
        ) : isAdmin ? (
          <p className="mt-2 text-sm text-stone-500">{MESSAGES.ADMIN_LOGIN.desc}</p>
        ) : (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-stone-500">
            <Info className="h-4 w-4 text-primary" />
            {MESSAGES.GUEST_TRY_HINT}
          </p>
        )}

        {!isAdmin && !resetMode && initialRedirect ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <Save className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{MESSAGES.LOGIN_FORM.fromDraftTip}</span>
          </div>
        ) : null}

        {notice ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {resetMode ? null : (
        <form
          className="mt-6 space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700" htmlFor="email">
              {MESSAGES.LOGIN_FORM.emailLabel}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={MESSAGES.LOGIN_FORM.emailPlaceholder}
                className={inputCls}
              />
            </div>
          </div>

          {tab === 'register' ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700" htmlFor="username">
                {MESSAGES.LOGIN_FORM.usernameLabel}
                <span className="font-normal text-stone-400">{MESSAGES.LOGIN_FORM.usernameOptional}</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  id="username"
                  type="text"
                  maxLength={20}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={MESSAGES.LOGIN_FORM.usernamePlaceholder}
                  className={inputCls}
                />
              </div>
            </div>
          ) : null}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700" htmlFor="password">
              {MESSAGES.LOGIN_FORM.passwordLabel}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={MESSAGES.LOGIN_FORM.passwordPlaceholder}
                className={`${inputCls} pr-10`}
              />
              <button
                type="button"
                aria-label="显示或隐藏密码"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-stone-400 hover:text-stone-600 md:right-3 md:h-4 md:w-4"
              >
                {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {isLogin ? (
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-stone-600">
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-primary" />
                {MESSAGES.LOGIN_FORM.remember}
              </label>
              {isAdmin ? null : (
                <button
                  type="button"
                  onClick={openReset}
                  className="inline-flex items-center py-2.5 text-primary hover:underline md:py-0"
                >
                  {MESSAGES.LOGIN_FORM.forgot}
                </button>
              )}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-from to-primary-to font-semibold text-white hover:brightness-110 disabled:opacity-60"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            <span>{submitText}</span>
          </button>
        </form>
        )}

        {resetMode ? (
          <form
            className="mt-6 space-y-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submitReset();
            }}
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700" htmlFor="reset-email">
                {MESSAGES.LOGIN_FORM.emailLabel}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={MESSAGES.LOGIN_FORM.emailPlaceholder}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700" htmlFor="reset-password">
                {MESSAGES.RESET_PASSWORD.newPasswordLabel}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  id="reset-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={MESSAGES.LOGIN_FORM.passwordPlaceholder}
                  className={`${inputCls} pr-10`}
                />
                <button
                  type="button"
                  aria-label="显示或隐藏密码"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-stone-400 hover:text-stone-600 md:right-3 md:h-4 md:w-4"
                >
                  {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700" htmlFor="reset-confirm">
                {MESSAGES.RESET_PASSWORD.confirmLabel}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  id="reset-confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={MESSAGES.RESET_PASSWORD.confirmPlaceholder}
                  className={inputCls}
                />
              </div>
            </div>

            <p className="flex items-start gap-1.5 rounded-xl bg-stone-50 px-3 py-2.5 text-xs text-stone-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              {MESSAGES.RESET_PASSWORD.hint}
            </p>

            <button
              type="submit"
              disabled={busy}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-from to-primary-to font-semibold text-white hover:brightness-110 disabled:opacity-60"
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              <span>{busy ? MESSAGES.RESET_PASSWORD.submitBusy : MESSAGES.RESET_PASSWORD.submit}</span>
            </button>

            <button
              type="button"
              onClick={closeReset}
              className="h-11 w-full rounded-xl border border-stone-300 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              {MESSAGES.RESET_PASSWORD.backToLogin}
            </button>
          </form>
        ) : null}

        {!isAdmin && !resetMode ? (
          <Link
            href={ROUTES.CITY}
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-stone-300 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            <Rocket className="h-4 w-4" />
            {MESSAGES.LOGIN_FORM.tryGuest}
          </Link>
        ) : null}
      </section>
    </div>
  );
}

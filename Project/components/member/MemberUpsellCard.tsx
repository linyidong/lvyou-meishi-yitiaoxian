'use client';

import Link from 'next/link';
import { Check, Crown } from 'lucide-react';
import { BUSINESS } from '@/config/business';
import { MESSAGES } from '@/config/messages';
import { PRODUCT } from '@/config/product';
import { ROUTES } from '@/config/routes';

/**
 * T-008 转化链路：结果页「升级会员」权益卡（轻量引导，不含收银台，与 MemberCard 区分）。
 * 3 条要点直接取 PRODUCT.MEMBER_BENEFITS 前 3 条（数字源自 BUSINESS 配额常量，不另编文案）。
 * 按钮去向：未登录 → /login?redirect=/profile；已登录 → /profile。
 */
export function MemberUpsellCard({ loggedIn }: { loggedIn: boolean }) {
  // T-025 内测模式（BILLING_ENABLED=false）：关闭升级引导，不渲染任何付费转化入口
  if (!BUSINESS.BILLING_ENABLED) return null;
  const M = MESSAGES.TRY.RESULT;
  const href = loggedIn
    ? ROUTES.PROFILE
    : `${ROUTES.LOGIN}?redirect=${encodeURIComponent(ROUTES.PROFILE)}`;
  return (
    <section className="mt-4 rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 shrink-0 text-amber-500" />
        <h3 className="text-sm font-semibold text-stone-900">{M.upsellTitle}</h3>
      </div>
      <ul className="mt-3 space-y-1.5">
        {PRODUCT.MEMBER_BENEFITS.slice(0, 3).map((benefit) => (
          <li key={benefit} className="flex items-start gap-2 text-xs text-stone-600">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className="mt-4 flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-5 text-sm font-semibold text-white hover:brightness-110"
      >
        {M.upsellBtn}
      </Link>
    </section>
  );
}

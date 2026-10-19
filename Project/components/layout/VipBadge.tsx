'use client';

import { MESSAGES } from '@/config/messages';
import { cn } from '@/lib/utils';

/**
 * 头像右侧的身份标识（只是一个标识，不承担任何点击功能）。
 * 视觉目标：3D 质感皇冠 + 金属渐变文字，无背景色块，独立于头像与账号名之外。
 * - 管理员：玫红玻璃质感皇冠 + 「超级 VIP」
 * - 会员：金色玻璃质感皇冠 + 「VIP」
 * 皇冠用内联 SVG 手工绘制（带高光、渐变、星芒），不从截图里抠像素。
 */
function CrownIcon({ tone, className }: { tone: 'gold' | 'rose'; className?: string }) {
  const id = `vip-crown-${tone}`;
  const [light, mid, dark, edge] =
    tone === 'gold'
      ? ['#fff7d6', '#f2c14e', '#b45309', '#7c2d12']
      : ['#ffe9ec', '#fb7185', '#be123c', '#7f1d1d'];

  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="0.42" stopColor={mid} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <linearGradient id={`${id}-band`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="0.55" stopColor={mid} />
          <stop offset="1" stopColor={edge} />
        </linearGradient>
      </defs>
      {/* 冠体（五峰） */}
      <path
        d="M9.5 32 5 12.5 15.6 21 24 7.5 32.4 21 43 12.5 38.5 32Z"
        fill={`url(#${id}-body)`}
        stroke={edge}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      {/* 顶部高光面，制造玻璃反光 */}
      <path
        d="M10.8 30.5 7.6 15.6 16.4 22.6 24 10.8 31.6 22.6 40.4 15.6 37.2 30.5Z"
        fill="#fff"
        opacity="0.38"
      />
      {/* 底座 */}
      <rect
        x="8"
        y="32"
        width="32"
        height="6.8"
        rx="2.8"
        fill={`url(#${id}-band)`}
        stroke={edge}
        strokeWidth="1.3"
      />
      <rect x="11" y="33.3" width="26" height="1.7" rx="0.85" fill="#fff" opacity="0.55" />
      {/* 星芒点缀 */}
      <g fill="#fff" opacity="0.85">
        <path d="M12.5 24.6 14 21.4 15.5 24.6 18.7 26.1 15.5 27.6 14 30.8 12.5 27.6 9.3 26.1Z" />
        <path d="M34.4 20.4 35.6 17.8 36.8 20.4 39.4 21.6 36.8 22.8 35.6 25.4 34.4 22.8 31.8 21.6Z" />
      </g>
    </svg>
  );
}

export function VipBadge({ kind }: { kind: 'admin' | 'vip' }) {
  const isAdmin = kind === 'admin';
  const label = isAdmin ? MESSAGES.MENU_BADGE_ADMIN : MESSAGES.MENU_BADGE_VIP;

  return (
    <span
      // 纯标识：不可点击、不可选中，不参与头像/账号的点击区域
      className="pointer-events-none inline-flex shrink-0 select-none items-center gap-1"
      role="img"
      aria-label={label}
    >
      <CrownIcon
        tone={isAdmin ? 'rose' : 'gold'}
        className={cn(
          'drop-shadow-[0_1px_1px_rgba(15,23,42,0.28)]',
          isAdmin ? 'h-5 w-5' : 'h-4 w-4',
        )}
      />
      <span
        className={cn(
          'bg-clip-text font-black tracking-tight text-transparent',
          isAdmin
            ? 'bg-gradient-to-b from-[#ffe4e6] via-[#fb7185] to-[#9f1239] text-[13px] drop-shadow-[0_1px_1px_rgba(159,18,57,0.55)]'
            : 'bg-gradient-to-b from-[#fff7d6] via-[#f2c14e] to-[#b45309] text-[11px] drop-shadow-[0_1px_1px_rgba(180,83,9,0.5)]',
        )}
      >
        {label}
      </span>
    </span>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  Check,
  ChevronRight,
  CircleCheckBig,
  ClipboardPaste,
  FilePen,
  Lock,
  LogIn,
  Map,
  MapPinPlus,
  Route,
  Share2,
  Sparkles,
} from 'lucide-react';
import { MESSAGES } from '@/config/messages';
import { PLACE_TYPE, PLACE_TYPE_LABEL } from '@/config/enums';
import { ROUTES } from '@/config/routes';
import { readDraft } from '@/lib/draft';
import { PlaceGlyph } from '@/components/icons/PlaceGlyph';
import { ImportCollectClient } from '@/components/home/ImportCollectClient';
import { ShareImportDialog } from '@/components/share/ShareImportDialog';

export interface HomeRouteItem {
  id: string;
  title: string;
  cityName: string | null;
  days: number;
  transportLabel: string;
  placeCount: number;
}

export interface HomeDraft {
  city: string | null;
  href: string;
}

export interface HomeClientProps {
  isLoggedIn: boolean;
  recentRoutes: HomeRouteItem[];
  draft: HomeDraft | null;
  collectedCount: number;
  /** T-041 是否会员（member 或 role=admin）：决定「导入分享路线」按钮可否点击 */
  isMember: boolean;
  /** T-051 业务开关：导入地点 / 图片识别（关闭时导入面板提示并禁用入口） */
  importEnabled: boolean;
  ocrEnabled: boolean;
}

const STEP_STYLES = [
  { icon: Building2, box: 'bg-primary/5 text-primary' },
  { icon: ClipboardPaste, box: 'bg-amber-50 text-amber-600' },
  { icon: CircleCheckBig, box: 'bg-teal-50 text-teal-600' },
  { icon: Route, box: 'bg-sky-50 text-sky-600' },
] as const;

const SAMPLE_POINTS = [
  { x: 40, y: 120, n: 1, fill: '#14b8a6' },
  { x: 90, y: 70, n: 2, fill: '#f59e0b' },
  { x: 150, y: 95, n: 3, fill: '#14b8a6' },
  { x: 210, y: 50, n: 4, fill: '#f59e0b' },
  { x: 260, y: 110, n: 5, fill: '#14b8a6' },
] as const;

/**
 * T-047：地名标签位置（cx=标签中心 x，by=文字基线 y）。
 * 按点位与虚线走向错开上/下，保证标签不与虚线、序号徽标、相邻标签重叠：
 * 1 左上（1→2 虚线从其右下经过）、2/4 上方偏高、3 下方（虚线与徽标都在上方）、5 右上（4→5 虚线从其左下经过）。
 */
const LABEL_POS = [
  { cx: 34, by: 92 },
  { cx: 90, by: 44 },
  { cx: 150, by: 127 },
  { cx: 210, by: 26 },
  { cx: 272, by: 82 },
] as const;

/** T-068/T-069：首页右侧示意轮播（屏数 / 每屏停留毫秒） */
const SLIDE_COUNT = 6;
const CAROUSEL_INTERVAL_MS = 5000;
const CAROUSEL = MESSAGES.SAMPLE_ROUTE.carousel;

/** U02 首页（Slogan 首屏 + 草稿提示 + 导入收藏 + 四步说明 + 最近路线 + 差异说明） */
export function HomeClient({
  isLoggedIn,
  recentRoutes,
  draft,
  collectedCount,
  isMember,
  importEnabled,
  ocrEnabled,
}: HomeClientProps) {
  const [localDraft, setLocalDraft] = useState<{ city: string; count: number } | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (isLoggedIn) return;
    const d = readDraft();
    if (d) setLocalDraft({ city: d.city, count: d.places.length });
  }, [isLoggedIn]);

  // T-068：右侧示意 3 屏轮播状态（当前屏 / 悬停与聚焦分开跟踪 / 系统减弱动效）
  const [slide, setSlide] = useState(0);
  const [carouselHovered, setCarouselHovered] = useState(false);
  const [carouselFocused, setCarouselFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  // 悬停或键盘聚焦任一存在即暂停（避免「聚焦时鼠标移出」误恢复播放）
  const carouselPaused = carouselHovered || carouselFocused;

  useEffect(() => {
    // prefers-reduced-motion: reduce 时不自动轮播（圆点仍可点击）
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (carouselPaused || reducedMotion) return;
    const timer = window.setTimeout(
      () => setSlide((s) => (s + 1) % SLIDE_COUNT),
      CAROUSEL_INTERVAL_MS
    );
    return () => window.clearTimeout(timer);
  }, [slide, carouselPaused, reducedMotion]);

  /** 轮播屏淡入淡出类名（300ms ≤400ms；非当前屏只淡出不移除，保证卡片高度不跳动） */
  const slideClass = (i: number) =>
    `transition-opacity duration-300 motion-reduce:transition-none ${
      slide === i ? 'opacity-100' : 'pointer-events-none opacity-0'
    }`;

  const draftBar = draft
    ? { info: MESSAGES.HOME_DRAFT.infoUnfinished(draft.city ?? MESSAGES.UNSPECIFIED_CITY), href: draft.href }
    : localDraft
      ? { info: MESSAGES.HOME_DRAFT.infoImported(localDraft.city, localDraft.count), href: ROUTES.CITY }
      : null;

  return (
    <>
      {/* 首屏：左白卡 + 右示意路线卡 */}
      <section className="grid items-stretch gap-6 lg:grid-cols-5">
        <div className="flex min-w-0 flex-col justify-center rounded-3xl border border-stone-200 bg-white p-6 md:p-10 lg:col-span-3">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-4 w-4" />
            {MESSAGES.HOME_HERO.badge}
          </span>
          <h1 className="mt-4 text-3xl font-bold leading-tight text-stone-900 md:text-5xl">
            {MESSAGES.HOME_HERO.titleLines[0]}
            <br />
            <span className="text-primary">{MESSAGES.HOME_HERO.titleLines[1]}</span>
          </h1>
          <p className="mt-4 max-w-[42rem] text-stone-600 md:text-lg">
            {MESSAGES.HOME_HERO.descLines.map((line) => (
              <span key={line} className="block leading-relaxed">
                {line}
              </span>
            ))}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={ROUTES.CITY}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-6 font-semibold text-white hover:brightness-110"
            >
              <MapPinPlus className="h-5 w-5" />
              {MESSAGES.HOME_HERO.ctaPrimary}
            </Link>
            {isLoggedIn ? (
              <Link
                href={ROUTES.MY_ROUTES}
                className="flex h-12 items-center justify-center gap-2 rounded-xl border border-stone-300 px-6 font-medium text-stone-700 hover:bg-stone-50"
              >
                <Route className="h-4 w-4" />
                {MESSAGES.NAV_MY_ROUTES}
              </Link>
            ) : (
              <Link
                href={ROUTES.LOGIN}
                className="flex h-12 items-center justify-center gap-2 rounded-xl border border-stone-300 px-6 font-medium text-stone-700 hover:bg-stone-50"
              >
                <LogIn className="h-4 w-4" />
                {MESSAGES.NAV_LOGIN_REGISTER}
              </Link>
            )}
            {/* T-041 导入分享路线：会员可点；非会员禁用，提示常驻在按钮下方（不再用 title 悬浮提示） */}
            <div className="flex flex-col items-start gap-1">
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                disabled={!isMember}
                className={
                  isMember
                    ? 'flex h-12 items-center justify-center gap-2 rounded-xl border border-stone-300 px-6 font-medium text-stone-700 hover:bg-stone-50'
                    : 'flex h-12 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-100 px-6 font-medium text-stone-400'
                }
              >
                <Share2 className="h-4 w-4" />
                {MESSAGES.SHARE.importHomeBtn}
              </button>
              {!isMember ? (
                <span className="text-xs text-stone-400">{MESSAGES.SHARE.importMemberOnly}</span>
              ) : null}
            </div>
          </div>
        </div>

        {/* T-068/T-069：6 屏自动轮播（路线示意 / 路线地图 / 收藏夹 / 景点 / 美食 / 旅行长图）。
            第 1 屏原样保留且在文档流中决定卡片高度；其余屏为绝对定位覆盖层，切换时卡片 offsetHeight 不变（无布局跳动）。 */}
        <div
          className="relative min-w-0 min-h-[320px] overflow-hidden rounded-3xl bg-teal-900 p-6 text-white lg:col-span-2"
          role="group"
          aria-roledescription="carousel"
          aria-label={CAROUSEL.ariaLabel}
          onMouseEnter={() => setCarouselHovered(true)}
          onMouseLeave={() => setCarouselHovered(false)}
          onFocus={() => setCarouselFocused(true)}
          onBlur={(e) => {
            // 焦点移出整张卡才解除聚焦暂停（圆点之间移动不解除）
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setCarouselFocused(false);
          }}
        >
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />
          {/* 第 1 屏：现有路线示意（DOM/视觉原样迁移，仅包进轮播淡入淡出结构；透明背景透出卡片 teal-900） */}
          <div className={slideClass(0)} data-slide="0" aria-hidden={slide !== 0}>
            <div className="relative flex items-center justify-between">
              <span className="text-sm font-semibold">{MESSAGES.SAMPLE_ROUTE.cityLine}</span>
              <span className="rounded-lg bg-white/15 px-2 py-1 text-xs">{MESSAGES.SAMPLE_ROUTE.tag}</span>
            </div>
            <svg className="relative mt-4 w-full" viewBox="0 0 300 180">
              <polyline
                fill="none"
                points="40,120 90,70 150,95 210,50 260,110"
                stroke="#fda4af"
                strokeDasharray="8 6"
                strokeLinecap="round"
                strokeWidth="4"
              />
              <g fontWeight="700" textAnchor="middle">
                {SAMPLE_POINTS.map((p, i) => {
                  // T-047：地名直接标在点位旁（原底部清单删除），半透明深色底衬避免与虚线/网格重叠
                  const name = MESSAGES.SAMPLE_ROUTE.stations[i];
                  const label = LABEL_POS[i];
                  const labelW = name.length * 11.5 + 8;
                  return (
                    <g key={p.n}>
                      {/* T-037：圆 r 13→15、图标 18px；T-038：改为显式 size/x/y 渲染（去掉嵌套 viewport，
                          lucide 与自绘分支统一 18×18，实测宽度不再受图标自身宽高比影响） */}
                      <circle cx={p.x} cy={p.y} r={15} fill={p.fill} />
                      <PlaceGlyph
                        iconKey={MESSAGES.SAMPLE_ROUTE.homeStationIconKeys[i]}
                        size={18}
                        x={p.x - 9}
                        y={p.y - 9}
                        style={{ color: '#fff' }}
                      />
                      <circle cx={p.x + 11} cy={p.y + 11} r={6.5} fill="#fff" />
                      <text fontSize="8.5" fill={p.fill} x={p.x + 11} y={p.y + 14}>
                        {p.n}
                      </text>
                      <rect
                        x={label.cx - labelW / 2}
                        y={label.by - 14}
                        width={labelW}
                        height={18}
                        rx={4}
                        fill="rgba(13,60,55,0.6)"
                      />
                      <text fontSize="11.5" fontWeight="600" fill="#fff" x={label.cx} y={label.by}>
                        {name}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
            <div className="relative mt-4 flex flex-wrap items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-teal-400" />
                {MESSAGES.SAMPLE_ROUTE.legendAttraction}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                {MESSAGES.SAMPLE_ROUTE.legendFood}
              </span>
              <span className="ml-auto">{MESSAGES.SAMPLE_ROUTE.distance}</span>
            </div>
          </div>
          {/* 第 2 屏：真实地图截图铺满（object-cover）+ 深色文字浮层；浅色底 #eef2f7（图片未覆盖区域兜底） */}
          <div
            className={`absolute inset-0 ${slideClass(1)}`}
            data-slide="1"
            style={{ backgroundColor: CAROUSEL.slides[1].bg }}
            aria-hidden={slide !== 1}
          >
            <Image
              src={CAROUSEL.mapSlide.img.src}
              alt={CAROUSEL.mapSlide.img.alt}
              fill
              sizes="(max-width:1023px) 100vw, 40vw"
              className="object-cover"
            />
            <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-4 md:p-6">
              <span className="min-w-0 truncate rounded-full bg-white/85 px-3 py-1 text-sm font-semibold text-stone-800">
                {CAROUSEL.mapSlide.title}
              </span>
              <span className="shrink-0 rounded-full bg-white/85 px-2.5 py-1 text-xs text-stone-700">
                {CAROUSEL.mapSlide.tag}
              </span>
            </div>
            <span className="absolute bottom-2 right-3 rounded bg-white/75 px-1.5 py-0.5 text-[10px] text-stone-600">
              {CAROUSEL.mapSlide.copyright}
            </span>
          </div>
          {/* 第 3 屏：收藏夹示意（6 个地点卡 + 脚注；stone-900 深色背景，白字） */}
          <div
            className={`absolute inset-0 flex flex-col p-6 ${slideClass(2)}`}
            data-slide="2"
            style={{ backgroundColor: CAROUSEL.slides[2].bg }}
            aria-hidden={slide !== 2}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{CAROUSEL.collectSlide.title}</span>
              <span className="rounded-lg bg-white/15 px-2 py-1 text-xs">{CAROUSEL.collectSlide.tag}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {CAROUSEL.collectSlide.places.map((pl) => {
                const isFood = pl.type === PLACE_TYPE.FOOD;
                return (
                  <div
                    key={pl.name}
                    className="flex min-w-0 items-center gap-2 rounded-xl bg-white/10 p-2 sm:p-3"
                  >
                    <span
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg sm:h-8 sm:w-8 ${
                        isFood ? 'bg-amber-400/20 text-amber-300' : 'bg-teal-400/20 text-teal-300'
                      }`}
                    >
                      <PlaceGlyph iconKey={pl.iconKey} size={18} />
                    </span>
                    {/* 390 宽度下卡片内宽约 107px：名称按 12px 显示可完整放下，不再 truncate；类型文字在手机上隐藏（读屏仍可读） */}
                    <span className="min-w-0 flex-1 text-xs font-medium leading-tight sm:truncate sm:text-sm">
                      {pl.name}
                    </span>
                    <span
                      className={`sr-only shrink-0 rounded-md px-1.5 py-0.5 text-[10px] sm:not-sr-only sm:ml-auto ${
                        isFood ? 'bg-amber-400/20 text-amber-200' : 'bg-teal-400/20 text-teal-200'
                      }`}
                    >
                      {PLACE_TYPE_LABEL[pl.type]}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-white/70">{CAROUSEL.collectSlide.footnote}</p>
          </div>
          {/* 第 4/5 屏：景点 / 美食照片卡（本地照片，无外链；浅色背景屏用深色字） */}
          {[CAROUSEL.attractionSlide, CAROUSEL.foodSlide].map((cfg, k) => {
            const i = 3 + k;
            const dark = CAROUSEL.slides[i].dotDark; // dotDark=true 即浅色背景屏（第 4 屏）→ 深色文字
            return (
              <div
                key={cfg.tag}
                className={`absolute inset-0 flex flex-col p-6 ${slideClass(i)}`}
                data-slide={String(i)}
                style={{ backgroundColor: CAROUSEL.slides[i].bg }}
                aria-hidden={slide !== i}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`min-w-0 truncate text-sm font-semibold ${dark ? 'text-stone-800' : 'text-white'}`}>
                    {cfg.title}
                  </span>
                  <span
                    className={`shrink-0 rounded-lg px-2 py-1 text-xs ${dark ? 'bg-stone-900/10 text-stone-700' : 'bg-white/15 text-white'}`}
                  >
                    {cfg.tag}
                  </span>
                </div>
                <div className="mt-4 grid min-h-0 flex-1 grid-cols-2 gap-3">
                  {cfg.photos.map((ph) => (
                    <div
                      key={ph.name}
                      className={`flex min-w-0 flex-col overflow-hidden rounded-xl ${dark ? 'bg-white/80' : 'bg-white/10'}`}
                    >
                      <div className="relative min-h-0 flex-1">
                        <Image
                          src={ph.src}
                          alt={ph.alt}
                          fill
                          sizes="(max-width:1023px) 40vw, 22vw"
                          className="object-cover"
                        />
                      </div>
                      <div className="flex items-center gap-2 px-2 py-1.5 sm:px-3 sm:py-2">
                        <span
                          className={`min-w-0 flex-1 truncate text-xs font-semibold leading-tight sm:text-sm ${
                            dark ? 'text-stone-800' : 'text-white'
                          }`}
                        >
                          {ph.name}
                        </span>
                        <span
                          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] ${
                            dark ? 'bg-teal-100 text-teal-700' : 'bg-amber-400/20 text-amber-200'
                          }`}
                        >
                          {cfg.tag}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className={`pt-3 text-right text-[10px] ${dark ? 'text-stone-500' : 'text-white/60'}`}>
                  {cfg.credit}
                </p>
              </div>
            );
          })}
          {/* 第 6 屏：自定义「旅行长图」示意——纯 CSS 迷你登机牌（白卡微旋转、渐变条、虚线、条形码、QR 示意） */}
          <div
            className={`absolute inset-0 flex flex-col p-6 ${slideClass(5)}`}
            data-slide="5"
            style={{ backgroundColor: CAROUSEL.slides[5].bg }}
            aria-hidden={slide !== 5}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-semibold">{CAROUSEL.exportSlide.title}</span>
              <span className="shrink-0 rounded-lg bg-white/15 px-2 py-1 text-xs">{CAROUSEL.exportSlide.tag}</span>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <div className="w-[210px] -rotate-3 rounded-xl bg-white p-3 shadow-2xl sm:w-[280px] sm:p-4">
                <div className="h-1.5 rounded-full bg-gradient-to-r from-teal-500 via-amber-400 to-rose-400" />
                <p className="mt-2 truncate text-sm font-bold text-stone-900">{CAROUSEL.exportSlide.ticketTitle}</p>
                <p className="mt-0.5 text-xs text-stone-500">{CAROUSEL.exportSlide.ticketMeta}</p>
                <div className="my-2.5 border-t border-dashed border-stone-300" />
                <div className="flex items-end justify-between gap-3">
                  {/* 条形码竖线组 */}
                  <div className="flex h-6 items-end gap-[2px]">
                    {[3, 1, 2, 1, 3, 2, 1, 2, 3, 1, 2, 1, 3, 1, 2, 2, 1, 3].map((w, bi) => (
                      <span key={bi} className="h-6 bg-stone-800" style={{ width: w }} />
                    ))}
                  </div>
                  {/* QR 示意方块（棋盘格模拟） */}
                  <span
                    className="block h-9 w-9 shrink-0 rounded-sm border-2 border-stone-800"
                    style={{
                      backgroundImage: 'repeating-conic-gradient(#1c1917 0 25%, #fff 0 50%)',
                      backgroundSize: '6px 6px',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          {/* 底部圆点：button 可点击切换；当前屏 aria-current="true"；浅色背景屏（第 2/4 屏）用深色圆点 */}
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-2">
            {Array.from({ length: SLIDE_COUNT }, (_, i) => (
              <button
                key={i}
                type="button"
                aria-label={CAROUSEL.dotLabel(i + 1)}
                aria-current={slide === i ? true : undefined}
                onClick={() => setSlide(i)}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  CAROUSEL.slides[slide].dotDark
                    ? slide === i
                      ? 'bg-stone-900'
                      : 'bg-stone-800/45 hover:bg-stone-800/70'
                    : slide === i
                      ? 'bg-white'
                      : 'bg-white/40 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 未保存草稿提示条 */}
      {draftBar ? (
        <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
            <FilePen className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-stone-900">{MESSAGES.HOME_DRAFT.title}</p>
            <p className="mt-0.5 text-sm text-stone-600">{draftBar.info}</p>
          </div>
          <Link
            href={draftBar.href}
            className="flex h-10 shrink-0 items-center justify-center gap-1 rounded-xl bg-amber-500 px-5 text-sm font-semibold text-white hover:bg-amber-600"
          >
            {MESSAGES.HOME_DRAFT.continue}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      ) : null}

      {/* 导入地点美食先收藏（本期新增） */}
      <ImportCollectClient
        isLoggedIn={isLoggedIn}
        collectedCount={collectedCount}
        importEnabled={importEnabled}
        ocrEnabled={ocrEnabled}
      />

      {/* 四步排好一条线 */}
      <section className="mt-10">
        <h2 className="text-xl font-bold text-stone-900 md:text-2xl">{MESSAGES.HOME_STEPS.title}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MESSAGES.HOME_STEPS.steps.map((step, i) => {
            const style = STEP_STYLES[i];
            const Icon = style.icon;
            return (
              <div key={step.no} className="min-w-0 rounded-2xl border border-stone-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl ${style.box}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-3xl font-bold text-stone-200">{step.no}</span>
                </div>
                <h3 className="mt-4 font-semibold text-stone-900">{step.title}</h3>
                <p className="mt-1 text-sm text-stone-500">{step.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 我的最近路线 + 和照搬路线不一样 */}
      <section className="mt-10 grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-5 md:p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-900">{MESSAGES.HOME_RECENT.title}</h2>
            <Link href={ROUTES.MY_ROUTES} className="inline-flex h-10 items-center px-1 text-sm text-primary hover:underline md:h-auto md:px-0">
              {MESSAGES.HOME_RECENT.viewAll}
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {!isLoggedIn ? (
              <div className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
                <Lock className="mx-auto h-7 w-7 text-stone-400" />
                <p className="mt-2">{MESSAGES.HOME_RECENT.guestEmpty}</p>
                <Link
                  href={ROUTES.LOGIN}
                  className="mt-3 inline-flex h-10 items-center rounded-lg bg-stone-900 px-4 text-white hover:bg-stone-800 md:h-9"
                >
                  {MESSAGES.HOME_RECENT.guestLogin}
                </Link>
              </div>
            ) : recentRoutes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
                <Map className="mx-auto h-7 w-7 text-stone-400" />
                <p className="mt-2">{MESSAGES.HOME_RECENT.noneEmpty}</p>
                <Link
                  href={ROUTES.CITY}
                  className="mt-3 inline-flex h-10 items-center gap-1 rounded-lg bg-gradient-to-r from-primary-from to-primary-to px-4 font-semibold text-white hover:brightness-110 md:h-9"
                >
                  <MapPinPlus className="h-4 w-4" />
                  {MESSAGES.HOME_RECENT.noneCreate}
                </Link>
              </div>
            ) : (
              recentRoutes.map((r) => (
                <Link
                  key={r.id}
                  href={ROUTES.ROUTE_DETAIL(r.id)}
                  className="flex items-center gap-4 rounded-xl border border-stone-100 p-3 hover:bg-stone-50"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-600">
                    <Route className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-stone-900">{r.title}</span>
                    <span className="mt-0.5 block text-xs text-stone-500">
                      {MESSAGES.HOME_RECENT.meta(
                        r.cityName ?? MESSAGES.UNSPECIFIED_CITY,
                        r.days,
                        r.placeCount,
                        r.transportLabel,
                      )}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-primary/20 bg-primary/5 p-5 md:p-6">
          <h2 className="text-lg font-bold text-stone-900">{MESSAGES.HOME_DIFF.title}</h2>
          <ul className="mt-4 space-y-3 text-sm text-stone-700">
            {MESSAGES.HOME_DIFF.items.map((item) => (
              <li key={item} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* T-041 导入分享路线弹层 */}
      <ShareImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  );
}

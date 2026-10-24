'use client';

import { useEffect, useState } from 'react';
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

        <div className="relative min-w-0 min-h-[320px] overflow-hidden rounded-3xl bg-teal-900 p-6 text-white lg:col-span-2">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />
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

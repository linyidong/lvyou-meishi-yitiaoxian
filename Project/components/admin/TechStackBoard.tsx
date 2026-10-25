'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BrainCircuit,
  ChevronRight,
  Database,
  Layers,
  Map as MapIcon,
  Monitor,
  Server,
  ShieldCheck,
  Terminal,
  FolderTree,
  Route as RouteIcon,
  type LucideIcon,
} from 'lucide-react';
import { MESSAGES } from '@/config/messages';

/**
 * T-050 技术栈动态看板 → T-055 加厚：
 * - 四个 tab：分层架构 / 请求链路 / 关键目录 / 自检命令，全部可点击展开；
 * - 分层 tab：左侧分层节点 → 右侧明细（用途 + 关键位置 + 为什么选它），SVG 贝塞尔连线流动动画；
 * - 链路 tab：主链路节点点击展开职责，外部服务网格点击展开；
 * - 目录 / 命令 tab：条目点击展开说明；
 * - 顶部统计数字进入视口时递增（仓库实测）；hover 发光高亮；
 * - prefers-reduced-motion 时关闭动画；不引任何图表/动画库。
 * 配色与首页/登录页同色系：主色渐变 primary-from→primary-to + 深石板底 stone-900/950 + teal 点缀。
 * 内容全部来自 MESSAGES.ADMIN_TECH_STACK（本项目真实技术栈，禁止在组件写死文案）。
 */

const M = MESSAGES.ADMIN_TECH_STACK;

const LAYER_ICONS: LucideIcon[] = [Monitor, Server, Database, MapIcon, BrainCircuit, ShieldCheck];

type TabKey = 'layers' | 'chain' | 'dirs' | 'cmds';

/** 元素进入视口一次即置真（用于触发数字递增） */
function useInView<T extends HTMLElement>(ref: React.RefObject<T>): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, seen]);
  return seen;
}

/** 数字递增（easeOut 1.2s；reduced-motion 直接显示终值） */
function useCountUp(target: number, active: boolean): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setN(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const dur = 1200;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active]);
  return n;
}

function StatNumber({ value, label, active }: { value: number; label: string; active: boolean }) {
  const n = useCountUp(value, active);
  return (
    <div className="min-w-0 rounded-xl border border-stone-800 bg-stone-900/70 px-3 py-3 transition-all duration-200 hover:border-teal-400/50 hover:shadow-[0_0_20px_rgba(45,212,191,0.15)]">
      <p className="text-2xl font-bold tabular-nums text-white">
        {n}
        <span className="ml-1 text-xs font-normal text-teal-300">+</span>
      </p>
      <p className="mt-0.5 truncate text-xs text-stone-400">{label}</p>
    </div>
  );
}

/** 展开明细里的「关键位置 / 为什么」两行（分层条目共用） */
function WhereWhy({ where, why }: { where: string; why: string }) {
  return (
    <span className="mt-1.5 block space-y-1 text-xs leading-relaxed">
      <span className="block text-teal-200/80">
        <span className="text-stone-500">位置：</span>
        {where}
      </span>
      <span className="block text-purple-300">
        <span className="text-stone-500">为什么：</span>
        {why}
      </span>
    </span>
  );
}

export function TechStackBoard() {
  const [tab, setTab] = useState<TabKey>('layers');
  const [selected, setSelected] = useState(0);
  const [openItem, setOpenItem] = useState<string | null>(null);
  // 请求链路：选中主链路节点 + 展开的外部服务
  const [chainNode, setChainNode] = useState(0);
  const [openExternal, setOpenExternal] = useState<string | null>(null);
  // 目录 / 命令：展开项
  const [openDir, setOpenDir] = useState<string | null>(null);
  const [openCmd, setOpenCmd] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const statsSeen = useInView(statsRef);

  // 连线端点：选中节点右侧中点 → 明细面板左侧（头部附近）
  const [link, setLink] = useState<{ w: number; h: number; x1: number; y1: number; x2: number; y2: number } | null>(null);

  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    const node = nodeRefs.current[selected];
    const panel = panelRef.current;
    if (!wrap || !node || !panel) {
      setLink(null);
      return;
    }
    const wr = wrap.getBoundingClientRect();
    const nr = node.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    setLink({
      w: wr.width,
      h: wr.height,
      x1: nr.right - wr.left,
      y1: nr.top - wr.top + nr.height / 2,
      x2: pr.left - wr.left,
      y2: pr.top - wr.top + 28,
    });
  }, [selected]);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure, tab]);

  function pickLayer(i: number) {
    setSelected(i);
    setOpenItem(null);
  }

  const layer = M.layers[selected];
  const dx = link ? Math.max(28, (link.x2 - link.x1) / 2) : 0;

  const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
    { key: 'layers', label: M.tabs.layers, icon: Layers },
    { key: 'chain', label: M.tabs.chain, icon: RouteIcon },
    { key: 'dirs', label: M.tabs.dirs, icon: FolderTree },
    { key: 'cmds', label: M.tabs.cmds, icon: Terminal },
  ];

  return (
    <div className="overflow-hidden rounded-3xl border border-stone-800 bg-stone-950 text-stone-200 shadow-[0_20px_60px_-24px_rgba(12,10,9,0.8)]">
      {/* 顶部渐变条：项目主色 primary-from→primary-to + teal 点缀 */}
      <div className="h-1 bg-gradient-to-r from-primary-from via-primary-to to-teal-400" />

      <div className="p-4 sm:p-7">
        <p className="text-xs text-stone-400">{M.notice}</p>

        {/* 统计数字：进入视口递增 */}
        <div ref={statsRef} className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
          {M.stats.map((s) => (
            <StatNumber key={s.label} value={s.value} label={s.label} active={statsSeen} />
          ))}
        </div>

        {/* tab 切换 */}
        <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="技术栈视图切换">
          {TABS.map((t) => {
            const active = tab === t.key;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
                  active
                    ? 'border-transparent bg-gradient-to-r from-primary-from to-primary-to text-white shadow-[0_0_18px_rgba(225,29,72,0.35)]'
                    : 'border-stone-700 bg-stone-900/60 text-stone-300 hover:border-teal-400/40 hover:text-teal-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ===== tab①：分层架构（原有交互保留） ===== */}
        {tab === 'layers' ? (
          <div ref={wrapRef} className="relative mt-5 grid gap-6 lg:grid-cols-[232px_1fr]">
            {/* SVG 流动连线（仅桌面，节点→面板） */}
            {link ? (
              <svg
                className="pointer-events-none absolute inset-0 hidden lg:block"
                width={link.w}
                height={link.h}
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="t055-link-grad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#2DD4BF" />
                    <stop offset="100%" stopColor="#7C3AED" />
                  </linearGradient>
                </defs>
                <path
                  className="tech-flow-line"
                  d={`M ${link.x1} ${link.y1} C ${link.x1 + dx} ${link.y1}, ${link.x2 - dx} ${link.y2}, ${link.x2} ${link.y2}`}
                  fill="none"
                  stroke="url(#t055-link-grad)"
                  strokeWidth={2}
                  strokeDasharray="6 10"
                  strokeLinecap="round"
                  opacity={0.85}
                />
                <circle cx={link.x1} cy={link.y1} r={3} fill="#2DD4BF" />
                <circle cx={link.x2} cy={link.y2} r={3} fill="#7C3AED" />
              </svg>
            ) : null}

            {/* 左侧分层节点 */}
            <div className="flex flex-col gap-2">
              {M.layers.map((l, i) => {
                const Icon = LAYER_ICONS[i] ?? Monitor;
                const active = i === selected;
                return (
                  <button
                    key={l.name}
                    type="button"
                    ref={(el) => {
                      nodeRefs.current[i] = el;
                    }}
                    aria-pressed={active}
                    onClick={() => pickLayer(i)}
                    className={`group flex h-12 items-center gap-3 rounded-xl border px-3 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
                      active
                        ? 'border-teal-400/60 bg-gradient-to-r from-primary-from/25 to-primary-to/25 shadow-[0_0_24px_rgba(45,212,191,0.25)]'
                        : 'border-stone-800 bg-stone-900/60 hover:border-teal-400/40 hover:shadow-[0_0_16px_rgba(45,212,191,0.15)]'
                    }`}
                  >
                    <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-teal-300' : 'text-stone-400 group-hover:text-teal-300'}`} />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-medium ${active ? 'text-white' : 'text-stone-300'}`}>{l.name}</span>
                    </span>
                    <span className="hidden text-[10px] tracking-wider text-stone-500 xl:block">{l.en}</span>
                    <ChevronRight className={`h-4 w-4 shrink-0 transition-transform duration-200 ${active ? 'rotate-90 text-teal-300' : 'text-stone-600'}`} />
                  </button>
                );
              })}
            </div>

            {/* 右侧明细面板（key 变化触发淡入动画） */}
            <div
              key={selected}
              ref={panelRef}
              className="tech-panel-in min-w-0 rounded-2xl border border-stone-800 bg-stone-900/70 p-5"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-base font-semibold text-white">{layer.name}</h3>
                <span className="rounded bg-teal-400/10 px-1.5 py-0.5 text-[10px] tracking-wider text-teal-300">{layer.en}</span>
              </div>
              <p className="mt-1 text-xs text-stone-400">{layer.summary}</p>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {layer.items.map((item) => {
                  const open = openItem === item.name;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenItem(open ? null : item.name)}
                      className={`rounded-xl border px-3 py-2.5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-to ${
                        open
                          ? 'border-primary-to/60 bg-primary-to/10 shadow-[0_0_18px_rgba(124,58,237,0.25)]'
                          : 'border-stone-800 bg-stone-950/50 hover:border-teal-400/40 hover:shadow-[0_0_14px_rgba(45,212,191,0.15)]'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-stone-100">{item.name}</span>
                        <span className="shrink-0 rounded-full border border-stone-700 px-2 py-0.5 text-[10px] text-stone-300">
                          {item.badge}
                        </span>
                      </span>
                      {open ? (
                        <>
                          <span className="mt-1.5 block text-xs leading-relaxed text-stone-300">{item.desc}</span>
                          <WhereWhy where={item.where} why={item.why} />
                        </>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {/* ===== tab②：请求链路 ===== */}
        {tab === 'chain' ? (
          <div key="chain" className="tech-panel-in mt-5 min-w-0 rounded-2xl border border-stone-800 bg-stone-900/70 p-5">
            <h3 className="text-base font-semibold text-white">{M.chain.title}</h3>
            <p className="mt-1 text-xs text-stone-400">{M.chain.summary}</p>

            {/* 主链路：移动端纵向、桌面横向；节点可点选 */}
            <div className="mt-4 flex flex-col gap-1.5 sm:flex-row sm:items-stretch">
              {M.chain.nodes.map((n, i) => {
                const active = chainNode === i;
                return (
                  <div key={n.name} className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setChainNode(i)}
                      className={`min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
                        active
                          ? 'border-teal-400/60 bg-gradient-to-r from-primary-from/25 to-primary-to/25 shadow-[0_0_20px_rgba(45,212,191,0.25)]'
                          : 'border-stone-800 bg-stone-950/50 hover:border-teal-400/40 hover:shadow-[0_0_14px_rgba(45,212,191,0.15)]'
                      }`}
                    >
                      <span className={`block truncate text-sm font-medium ${active ? 'text-white' : 'text-stone-200'}`}>{n.name}</span>
                      <span className="mt-0.5 block truncate text-[10px] text-stone-500">{n.sub}</span>
                    </button>
                    {i < M.chain.nodes.length - 1 ? (
                      <ArrowRight className="h-4 w-4 shrink-0 rotate-90 self-center text-teal-400/70 sm:rotate-0" aria-hidden="true" />
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* 选中节点详情 */}
            <div key={chainNode} className="tech-panel-in mt-3 rounded-xl border border-stone-800 bg-stone-950/60 px-4 py-3">
              <p className="text-xs leading-relaxed text-stone-300">{M.chain.nodes[chainNode].desc}</p>
              <p className="mt-1 text-xs text-teal-200/80">
                <span className="text-stone-500">位置：</span>
                {M.chain.nodes[chainNode].where}
              </p>
            </div>

            {/* 外部服务 */}
            <h4 className="mt-5 text-xs font-medium tracking-wide text-stone-400">{M.chain.externalsTitle}</h4>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {M.chain.externals.map((x) => {
                const open = openExternal === x.name;
                return (
                  <button
                    key={x.name}
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenExternal(open ? null : x.name)}
                    className={`rounded-xl border px-3 py-2.5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-to ${
                      open
                        ? 'border-primary-to/60 bg-primary-to/10 shadow-[0_0_18px_rgba(124,58,237,0.25)]'
                        : 'border-stone-800 bg-stone-950/50 hover:border-teal-400/40 hover:shadow-[0_0_14px_rgba(45,212,191,0.15)]'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-stone-100">{x.name}</span>
                      <ChevronRight className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-90 text-teal-300' : 'text-stone-600'}`} />
                    </span>
                    {open ? (
                      <>
                        <span className="mt-1.5 block text-xs leading-relaxed text-stone-300">{x.desc}</span>
                        <span className="mt-1 block text-xs text-teal-200/80">
                          <span className="text-stone-500">位置：</span>
                          {x.where}
                        </span>
                      </>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* ===== tab③：关键目录 ===== */}
        {tab === 'dirs' ? (
          <div key="dirs" className="tech-panel-in mt-5 min-w-0 rounded-2xl border border-stone-800 bg-stone-900/70 p-5">
            <h3 className="text-base font-semibold text-white">{M.dirs.title}</h3>
            <p className="mt-1 text-xs text-stone-400">{M.dirs.summary}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {M.dirs.items.map((d) => {
                const open = openDir === d.path;
                return (
                  <button
                    key={d.path}
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenDir(open ? null : d.path)}
                    className={`rounded-xl border px-3 py-2.5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-to ${
                      open
                        ? 'border-primary-to/60 bg-primary-to/10 shadow-[0_0_18px_rgba(124,58,237,0.25)]'
                        : 'border-stone-800 bg-stone-950/50 hover:border-teal-400/40 hover:shadow-[0_0_14px_rgba(45,212,191,0.15)]'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-sm text-teal-200">{d.path}</span>
                      <span className="shrink-0 rounded-full border border-stone-700 px-2 py-0.5 text-[10px] text-stone-300">{d.count}</span>
                    </span>
                    {open ? (
                      <>
                        <span className="mt-1.5 block text-xs leading-relaxed text-stone-300">{d.desc}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-purple-300">
                          <span className="text-stone-500">为什么：</span>
                          {d.why}
                        </span>
                      </>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* ===== tab④：自检命令 ===== */}
        {tab === 'cmds' ? (
          <div key="cmds" className="tech-panel-in mt-5 min-w-0 rounded-2xl border border-stone-800 bg-stone-900/70 p-5">
            <h3 className="text-base font-semibold text-white">{M.cmds.title}</h3>
            <p className="mt-1 text-xs text-stone-400">{M.cmds.summary}</p>
            <div className="mt-4 space-y-2">
              {M.cmds.items.map((c) => {
                const open = openCmd === c.cmd;
                return (
                  <button
                    key={c.cmd}
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenCmd(open ? null : c.cmd)}
                    className={`block w-full rounded-xl border px-3 py-2.5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-to ${
                      open
                        ? 'border-primary-to/60 bg-primary-to/10 shadow-[0_0_18px_rgba(124,58,237,0.25)]'
                        : 'border-stone-800 bg-stone-950/50 hover:border-teal-400/40 hover:shadow-[0_0_14px_rgba(45,212,191,0.15)]'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-sm text-teal-200">{c.cmd}</span>
                      <ChevronRight className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-90 text-teal-300' : 'text-stone-600'}`} />
                    </span>
                    {open ? (
                      <>
                        <span className="mt-1.5 block text-xs leading-relaxed text-stone-300">{c.desc}</span>
                        <span className="mt-1 block text-xs text-stone-400">
                          <span className="text-stone-500">何时跑：</span>
                          {c.when}
                        </span>
                      </>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

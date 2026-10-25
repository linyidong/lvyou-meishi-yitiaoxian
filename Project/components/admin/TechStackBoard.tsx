'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BrainCircuit,
  ChevronRight,
  Database,
  FolderTree,
  Layers,
  Map as MapIcon,
  Monitor,
  Server,
  ShieldCheck,
  Terminal,
  type LucideIcon,
} from 'lucide-react';
import { MESSAGES } from '@/config/messages';

/**
 * T-050 动态看板 → T-055 四 tab 加厚 → T-056 一页铺开（取消 tab）：
 * - 单页五块自上而下：统计条（6 卡）→ 架构链路（横向流程 + 外部服务虚线旁支）
 *   → 技术栈六层（3 列 × 2 行，全部可见）→ 底部双栏（关键目录 | 自检命令）；
 * - 保留动效：统计数字进入视口递增、SVG 连线流动（stroke-dashoffset）、hover 发光；
 * - 条目默认单行（名称+徽章），点击展开「用途 / 位置 / 为什么」补充说明；
 * - prefers-reduced-motion 关闭动画；不引任何图表/动画库；
 * - 配色与首页/登录页同色系：深石板底 stone-900/950 + 主色渐变 primary-from→primary-to + teal 点缀。
 * 内容全部来自 MESSAGES.ADMIN_TECH_STACK（本项目真实技术栈，禁止在组件写死文案）。
 */

const M = MESSAGES.ADMIN_TECH_STACK;

const LAYER_ICONS: LucideIcon[] = [Monitor, Server, Database, MapIcon, BrainCircuit, ShieldCheck];

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
    <div className="min-w-0 rounded-xl border border-stone-800 bg-stone-900/70 px-3 py-2 transition-all duration-200 hover:border-teal-400/50 hover:shadow-[0_0_20px_rgba(45,212,191,0.15)]">
      <p className="text-xl font-bold tabular-nums text-white">
        {n}
        <span className="ml-0.5 text-[10px] font-normal text-teal-300">+</span>
      </p>
      <p className="mt-0.5 truncate text-[11px] text-stone-400">{label}</p>
    </div>
  );
}

/** 分区标题行（图标 + 标题 + 一句话说明） */
function SectionHead({ icon: Icon, title, summary }: { icon: LucideIcon; title: string; summary: string }) {
  return (
    <div className="mb-2 mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
        <Icon className="h-4 w-4 text-teal-300" />
        {title}
      </span>
      <span className="text-[11px] text-stone-500">{summary}</span>
    </div>
  );
}

/** 展开态补充说明（用途 + 位置/时机 + 为什么），各块共用 */
function Detail({ desc, where, why, whereLabel = '位置：' }: { desc: string; where?: string; why?: string; whereLabel?: string }) {
  return (
    <span className="mt-1 block space-y-0.5 text-[11px] leading-snug">
      <span className="block text-stone-300">{desc}</span>
      {where ? (
        <span className="block text-teal-200/80">
          <span className="text-stone-500">{whereLabel}</span>
          {where}
        </span>
      ) : null}
      {why ? (
        <span className="block text-purple-300">
          <span className="text-stone-500">为什么：</span>
          {why}
        </span>
      ) : null}
    </span>
  );
}

/** 折叠/展开通用行样式 */
const rowBase =
  'block w-full rounded-lg border px-2.5 py-1.5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400';
const rowClosed = 'border-transparent hover:border-teal-400/30 hover:bg-stone-900 hover:shadow-[0_0_12px_rgba(45,212,191,0.12)]';
const rowOpen = 'border-primary-to/50 bg-primary-to/10 shadow-[0_0_16px_rgba(124,58,237,0.2)]';

export function TechStackBoard() {
  // 各块展开态（key 全局唯一，互不干扰）
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [chainNode, setChainNode] = useState<number | null>(null);
  const [openExternal, setOpenExternal] = useState<string | null>(null);
  const [openDir, setOpenDir] = useState<string | null>(null);
  const [openCmd, setOpenCmd] = useState<string | null>(null);

  const statsRef = useRef<HTMLDivElement>(null);
  const statsSeen = useInView(statsRef);

  // 链路连线：主链节点间流动线 + Route Handler→外部服务 虚线旁支（仅桌面）
  const flowRef = useRef<HTMLDivElement>(null);
  const chainNodeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const extRef = useRef<HTMLDivElement>(null);
  const [geom, setGeom] = useState<{
    w: number;
    h: number;
    segs: { x1: number; y1: number; x2: number; y2: number }[];
    branch: { x1: number; y1: number; x2: number; y2: number } | null;
  } | null>(null);

  const measure = useCallback(() => {
    const wrap = flowRef.current;
    if (!wrap) {
      setGeom(null);
      return;
    }
    const wr = wrap.getBoundingClientRect();
    const rects = chainNodeRefs.current.slice(0, M.chain.nodes.length).map((el) => el?.getBoundingClientRect());
    if (rects.some((r) => !r)) {
      setGeom(null);
      return;
    }
    const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i < rects.length - 1; i++) {
      const a = rects[i] as DOMRect;
      const b = rects[i + 1] as DOMRect;
      segs.push({ x1: a.right - wr.left, y1: a.top - wr.top + a.height / 2, x2: b.left - wr.left, y2: b.top - wr.top + b.height / 2 });
    }
    let branch: { x1: number; y1: number; x2: number; y2: number } | null = null;
    const ext = extRef.current;
    const handler = rects[1] as DOMRect;
    if (ext && handler) {
      const er = ext.getBoundingClientRect();
      branch = { x1: handler.left - wr.left + 28, y1: handler.bottom - wr.top, x2: er.left - wr.left + 28, y2: er.top - wr.top };
    }
    setGeom({ w: wr.width, h: wr.height, segs, branch });
  }, [chainNode]);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  return (
    <div className="overflow-hidden rounded-3xl border border-stone-800 bg-stone-950 text-stone-200 shadow-[0_20px_60px_-24px_rgba(12,10,9,0.8)]">
      {/* 顶部渐变条：项目主色 primary-from→primary-to + teal 点缀 */}
      <div className="h-1 bg-gradient-to-r from-primary-from via-primary-to to-teal-400" />

      <div className="p-4 sm:p-6">
        <p className="text-xs text-stone-400">{M.notice}</p>

        {/* ===== 块①：统计条（6 卡，进入视口递增） ===== */}
        <div ref={statsRef} className="mt-3 grid grid-cols-3 gap-2 lg:grid-cols-6">
          {M.stats.map((s) => (
            <StatNumber key={s.label} value={s.value} label={s.label} active={statsSeen} />
          ))}
        </div>

        {/* ===== 块②：架构链路 ===== */}
        <SectionHead icon={ArrowRight} title={M.sections.chain} summary={M.chain.summary} />
        <div ref={flowRef} className="relative">
          {/* SVG 流动连线（仅桌面）：主链节点间 + 外部服务虚线旁支 */}
          {geom ? (
            <svg className="pointer-events-none absolute inset-0 hidden lg:block" width={geom.w} height={geom.h} aria-hidden="true">
              <defs>
                <linearGradient id="t056-link-grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#2DD4BF" />
                  <stop offset="100%" stopColor="#7C3AED" />
                </linearGradient>
              </defs>
              {geom.segs.map((s, i) => (
                <g key={i}>
                  <path
                    className="tech-flow-line"
                    d={`M ${s.x1} ${s.y1} L ${s.x2} ${s.y2}`}
                    fill="none"
                    stroke="url(#t056-link-grad)"
                    strokeWidth={2}
                    strokeDasharray="6 10"
                    strokeLinecap="round"
                    opacity={0.85}
                  />
                  <circle cx={s.x1} cy={s.y1} r={2.5} fill="#2DD4BF" />
                  <path d={`M ${s.x2 - 6} ${s.y2 - 4} L ${s.x2} ${s.y2} L ${s.x2 - 6} ${s.y2 + 4}`} fill="none" stroke="#7C3AED" strokeWidth={2} strokeLinecap="round" />
                </g>
              ))}
              {geom.branch ? (
                <path
                  d={`M ${geom.branch.x1} ${geom.branch.y1} C ${geom.branch.x1} ${geom.branch.y1 + 24}, ${geom.branch.x2} ${geom.branch.y2 - 24}, ${geom.branch.x2} ${geom.branch.y2}`}
                  fill="none"
                  stroke="#2DD4BF"
                  strokeWidth={1.5}
                  strokeDasharray="3 5"
                  strokeLinecap="round"
                  opacity={0.55}
                />
              ) : null}
            </svg>
          ) : null}

          {/* 主链节点：移动端纵向（带箭头），桌面横向（SVG 连线） */}
          <div className="flex flex-col gap-1 lg:flex-row lg:items-stretch lg:gap-10">
            {M.chain.nodes.map((n, i) => {
              const active = chainNode === i;
              return (
                <div key={n.name} className="flex min-w-0 flex-1 flex-row items-center gap-1 lg:block">
                  <button
                    type="button"
                    ref={(el) => {
                      chainNodeRefs.current[i] = el;
                    }}
                    aria-pressed={active}
                    onClick={() => setChainNode(active ? null : i)}
                    className={`min-w-0 flex-1 rounded-xl border px-3 py-2 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
                      active
                        ? 'border-teal-400/60 bg-gradient-to-r from-primary-from/25 to-primary-to/25 shadow-[0_0_20px_rgba(45,212,191,0.25)]'
                        : 'border-stone-800 bg-stone-900/70 hover:border-teal-400/40 hover:shadow-[0_0_14px_rgba(45,212,191,0.15)]'
                    }`}
                  >
                    <span className={`block truncate text-xs font-semibold ${active ? 'text-white' : 'text-stone-100'}`}>{n.name}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-stone-500">{n.sub}</span>
                  </button>
                  {i < M.chain.nodes.length - 1 ? (
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-teal-400/70 lg:hidden" aria-hidden="true" />
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* 选中节点详情（点击展开补充说明） */}
          {chainNode !== null ? (
            <div key={chainNode} className="tech-panel-in mt-2 rounded-xl border border-stone-800 bg-stone-900/60 px-3 py-2">
              <Detail desc={M.chain.nodes[chainNode].desc} where={M.chain.nodes[chainNode].where} />
            </div>
          ) : null}

          {/* 外部服务（虚线旁支） */}
          <div ref={extRef} className="mt-2">
            <p className="mb-1.5 text-[10px] tracking-wide text-stone-500">{M.chain.externalsTitle}</p>
            <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
              {M.chain.externals.map((x) => {
                const open = openExternal === x.name;
                return (
                  <button
                    key={x.name}
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenExternal(open ? null : x.name)}
                    className={`${rowBase} border-dashed ${open ? rowOpen : 'border-stone-700/80 bg-stone-900/40 ' + rowClosed}`}
                  >
                    <span className="flex items-center justify-between gap-1.5">
                      <span className="truncate text-xs font-medium text-stone-200">{x.name}</span>
                      <ChevronRight className={`h-3 w-3 shrink-0 transition-transform duration-200 ${open ? 'rotate-90 text-teal-300' : 'text-stone-600'}`} />
                    </span>
                    {open ? <Detail desc={x.desc} where={x.where} /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ===== 块③：技术栈六层（3 列 × 2 行，全部可见） ===== */}
        <SectionHead icon={Layers} title={M.sections.layers} summary="每卡条目点击展开用途 / 位置 / 为什么" />
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {M.layers.map((l, li) => {
            const Icon = LAYER_ICONS[li] ?? Monitor;
            return (
              <div key={l.name} className="min-w-0 rounded-2xl border border-stone-800 bg-stone-900/70 p-3 transition-all duration-200 hover:border-teal-400/30">
                <div className="flex items-baseline gap-1.5">
                  <Icon className="h-3.5 w-3.5 shrink-0 self-center text-teal-300" />
                  <h3 className="truncate text-[13px] font-semibold text-white">{l.name}</h3>
                  <span className="ml-auto hidden truncate text-[9px] tracking-wider text-stone-500 xl:block">{l.en}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-stone-500">{l.summary}</p>
                <div className="mt-1.5 space-y-0.5">
                  {l.items.map((item) => {
                    const key = `${li}:${item.name}`;
                    const open = openItem === key;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        aria-expanded={open}
                        onClick={() => setOpenItem(open ? null : key)}
                        className={`${rowBase} ${open ? rowOpen : rowClosed}`}
                      >
                        <span className="flex items-center justify-between gap-1.5">
                          <span className="truncate text-xs text-stone-100">{item.name}</span>
                          <span className="shrink-0 rounded-full border border-stone-700 px-1.5 py-px text-[9px] text-stone-400">{item.badge}</span>
                        </span>
                        {open ? <Detail desc={item.desc} where={item.where} why={item.why} /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ===== 块④⑤：底部双栏（关键目录 | 自检命令） ===== */}
        <div className="mt-5 grid gap-2.5 lg:grid-cols-2">
          <div className="min-w-0 rounded-2xl border border-stone-800 bg-stone-900/70 p-3">
            <div className="mb-1.5 flex items-baseline gap-1.5">
              <FolderTree className="h-3.5 w-3.5 shrink-0 self-center text-teal-300" />
              <h3 className="text-[13px] font-semibold text-white">{M.sections.dirs}</h3>
              <span className="truncate text-[10px] text-stone-500">{M.dirs.summary}</span>
            </div>
            <div className="space-y-0.5">
              {M.dirs.items.map((d) => {
                const open = openDir === d.path;
                return (
                  <button
                    key={d.path}
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenDir(open ? null : d.path)}
                    className={`${rowBase} ${open ? rowOpen : rowClosed}`}
                  >
                    <span className="flex items-center justify-between gap-1.5">
                      <span className="truncate font-mono text-xs text-teal-200">{d.path}</span>
                      <span className="shrink-0 rounded-full border border-stone-700 px-1.5 py-px text-[9px] text-stone-400">{d.count}</span>
                    </span>
                    {open ? <Detail desc={d.desc} why={d.why} /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-stone-800 bg-stone-900/70 p-3">
            <div className="mb-1.5 flex items-baseline gap-1.5">
              <Terminal className="h-3.5 w-3.5 shrink-0 self-center text-teal-300" />
              <h3 className="text-[13px] font-semibold text-white">{M.sections.cmds}</h3>
              <span className="truncate text-[10px] text-stone-500">{M.cmds.summary}</span>
            </div>
            <div className="space-y-0.5">
              {M.cmds.items.map((c) => {
                const open = openCmd === c.cmd;
                return (
                  <button
                    key={c.cmd}
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenCmd(open ? null : c.cmd)}
                    className={`${rowBase} ${open ? rowOpen : rowClosed}`}
                  >
                    <span className="flex items-center justify-between gap-1.5">
                      <span className="truncate font-mono text-xs text-teal-200">{c.cmd}</span>
                      <ChevronRight className={`h-3 w-3 shrink-0 transition-transform duration-200 ${open ? 'rotate-90 text-teal-300' : 'text-stone-600'}`} />
                    </span>
                    {open ? <Detail desc={c.desc} where={c.when} whereLabel="何时跑：" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

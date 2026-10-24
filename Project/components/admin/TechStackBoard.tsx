'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BrainCircuit,
  ChevronRight,
  Database,
  Map as MapIcon,
  Monitor,
  Server,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { MESSAGES } from '@/config/messages';

/**
 * T-050 技术栈动态看板（客户端）：
 * - 左侧分层节点，点击 → 右侧展开该层明细（版本徽章 + 条目点击展开一行说明）；
 * - 节点与明细面板之间有 SVG 连线流动动画（stroke-dashoffset，纯 CSS keyframes）；
 * - 顶部统计数字进入视口时递增（80 单测 / 8 E2E / 14 张表）；hover 发光高亮；
 * - prefers-reduced-motion 时关闭动画；不引任何图表/动画库。
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
    <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 transition-all duration-200 hover:border-teal-400/50 hover:shadow-[0_0_20px_rgba(45,212,191,0.15)]">
      <p className="text-2xl font-bold tabular-nums text-white">
        {n}
        <span className="ml-1 text-xs font-normal text-teal-300">+</span>
      </p>
      <p className="mt-0.5 truncate text-xs text-slate-400">{label}</p>
    </div>
  );
}

export function TechStackBoard() {
  const [selected, setSelected] = useState(0);
  const [openItem, setOpenItem] = useState<string | null>(null);

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
    if (!wrap || !node || !panel) return;
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
  }, [measure]);

  function pickLayer(i: number) {
    setSelected(i);
    setOpenItem(null);
  }

  const layer = M.layers[selected];
  const dx = link ? Math.max(28, (link.x2 - link.x1) / 2) : 0;

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 text-slate-200 shadow-[0_20px_60px_-24px_rgba(2,6,23,0.7)]">
      {/* 顶部渐变条：项目主色 primary-from→primary-to + teal 点缀 */}
      <div className="h-1 bg-gradient-to-r from-primary-from via-primary-to to-teal-400" />

      <div className="p-5 sm:p-7">
        <p className="text-xs text-slate-400">{M.notice}</p>

        {/* 统计数字：进入视口递增 */}
        <div ref={statsRef} className="mt-4 grid grid-cols-3 gap-3">
          {M.stats.map((s) => (
            <StatNumber key={s.label} value={s.value} label={s.label} active={statsSeen} />
          ))}
        </div>

        <div ref={wrapRef} className="relative mt-6 grid gap-6 lg:grid-cols-[232px_1fr]">
          {/* SVG 流动连线（仅桌面，节点→面板） */}
          {link ? (
            <svg
              className="pointer-events-none absolute inset-0 hidden lg:block"
              width={link.w}
              height={link.h}
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="t050-link-grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#2DD4BF" />
                  <stop offset="100%" stopColor="#7C3AED" />
                </linearGradient>
              </defs>
              <path
                className="tech-flow-line"
                d={`M ${link.x1} ${link.y1} C ${link.x1 + dx} ${link.y1}, ${link.x2 - dx} ${link.y2}, ${link.x2} ${link.y2}`}
                fill="none"
                stroke="url(#t050-link-grad)"
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
                      : 'border-slate-800 bg-slate-900/60 hover:border-teal-400/40 hover:shadow-[0_0_16px_rgba(45,212,191,0.15)]'
                  }`}
                >
                  <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-teal-300' : 'text-slate-400 group-hover:text-teal-300'}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-medium ${active ? 'text-white' : 'text-slate-300'}`}>{l.name}</span>
                  </span>
                  <span className="hidden text-[10px] tracking-wider text-slate-500 xl:block">{l.en}</span>
                  <ChevronRight className={`h-4 w-4 shrink-0 transition-transform duration-200 ${active ? 'rotate-90 text-teal-300' : 'text-slate-600'}`} />
                </button>
              );
            })}
          </div>

          {/* 右侧明细面板（key 变化触发淡入动画） */}
          <div
            key={selected}
            ref={panelRef}
            className="tech-panel-in min-w-0 rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-base font-semibold text-white">{layer.name}</h3>
              <span className="rounded bg-teal-400/10 px-1.5 py-0.5 text-[10px] tracking-wider text-teal-300">{layer.en}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">{layer.summary}</p>

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
                        : 'border-slate-800 bg-slate-950/50 hover:border-teal-400/40 hover:shadow-[0_0_14px_rgba(45,212,191,0.15)]'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-slate-100">{item.name}</span>
                      <span className="shrink-0 rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                        {item.badge}
                      </span>
                    </span>
                    {open ? <span className="mt-1.5 block text-xs leading-relaxed text-teal-200/80">{item.desc}</span> : null}
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

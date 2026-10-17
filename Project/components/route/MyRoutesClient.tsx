'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BUSINESS } from '@/config/business';
import { ROUTES } from '@/config/routes';

/** U03 路线卡片（服务端查好后传入） */
export interface MyRouteItem {
  id: string;
  title: string;
  cityName: string | null;
  days: number;
  transportLabel: string;
  placeCount: number;
  createdAt: string;
  /** 出行设置摘要，未填写任何一项时为 null */
  tripSummary: string | null;
}

/** YYYY-MM-DD HH:mm */
function fmtTime(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const chipCls = (on: boolean) =>
  `rounded-full border px-3.5 py-1.5 text-sm ${
    on ? 'border-primary bg-primary/5 font-medium text-primary' : 'border-border text-muted-foreground hover:bg-muted'
  }`;

/** U03 我的路线：只读列表 + 城市筛选 + 分页，路线仅自己可见 */
export function MyRoutesClient({ routes }: { routes: MyRouteItem[] }) {
  const [city, setCity] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const cityNames = useMemo(() => {
    const set = new Set<string>();
    for (const r of routes) {
      if (r.cityName) set.add(r.cityName);
    }
    return Array.from(set);
  }, [routes]);

  const filtered = useMemo(
    () => routes.filter((r) => (city ? r.cityName === city : true)),
    [routes, city],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / BUSINESS.USER_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice(
    (currentPage - 1) * BUSINESS.USER_PAGE_SIZE,
    currentPage * BUSINESS.USER_PAGE_SIZE,
  );

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">我的路线</h1>
          <p className="mt-1 text-sm text-muted-foreground">已保存的路线都在这里，可随时打开查看或继续调整。</p>
        </div>
        <Link
          href={ROUTES.CITY}
          className="flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-5 text-sm font-semibold text-white hover:brightness-110"
        >
          新建路线
        </Link>
      </div>

      {routes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background p-10 text-center">
          <p className="font-semibold">还没有保存的路线</p>
          <p className="mt-1 text-sm text-muted-foreground">生成路线后点击「保存路线」，就会出现在这里。</p>
          <Link
            href={ROUTES.CITY}
            className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-6 font-semibold text-white hover:brightness-110"
          >
            创建第一条路线
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => { setCity(null); setPage(1); }} className={chipCls(city === null)}>
              全部
            </button>
            {cityNames.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => { setCity(name); setPage(1); }}
                className={chipCls(city === name)}
              >
                {name}
              </button>
            ))}
          </div>

          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-background p-8 text-center">
              <p className="font-semibold">没有符合条件的路线</p>
              <button
                type="button"
                onClick={() => { setCity(null); setPage(1); }}
                className="mt-4 h-10 rounded-xl border border-border px-5 text-sm font-medium hover:bg-muted"
              >
                重置筛选
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((r) => (
                <div key={r.id} className="flex flex-col rounded-2xl border border-border bg-background p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {r.cityName ?? '未指定城市'}
                    </span>
                    <span className="text-xs text-muted-foreground">{r.days} 天</span>
                  </div>
                  <h2 className="mt-2 min-w-0 truncate text-base font-semibold">{r.title}</h2>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {r.placeCount} 个地点 · 市内交通{r.transportLabel}
                  </p>
                  {r.tripSummary ? (
                    <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{r.tripSummary}</p>
                  ) : null}
                  <p className="mt-1.5 text-xs text-muted-foreground/80">保存于 {fmtTime(r.createdAt)}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={ROUTES.ROUTE_DETAIL(r.id)}
                      className="flex h-9 flex-1 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:brightness-110"
                    >
                      查看路线
                    </Link>
                    <Link
                      href={ROUTES.ROUTE_EDIT(r.id)}
                      className="flex h-9 flex-1 items-center justify-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
                    >
                      继续调整
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              共 {filtered.length} 条 · 第 {currentPage} / {totalPages} 页
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
                className="rounded-lg border border-border px-3 py-1 disabled:opacity-40"
              >
                上一页
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
                className="rounded-lg border border-border px-3 py-1 disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          </div>
        </>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        第一版不提供公开路线浏览，路线仅自己可见。
      </p>
    </>
  );
}

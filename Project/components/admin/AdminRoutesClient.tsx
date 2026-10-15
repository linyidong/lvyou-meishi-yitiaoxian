'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { BUSINESS } from '@/config/business';

export interface AdminRoutePlace {
  name: string;
  typeLabel: string;
  dayIndex: number | null;
}

export interface AdminRouteItem {
  id: string;
  userEmail: string;
  cityName: string;
  title: string;
  days: number;
  transportLabel: string;
  originCity: string | null;
  intercityLabel: string;
  lodgingLabel: string;
  placeCount: number;
  createdAt: string;
  places: AdminRoutePlace[];
}

type DaysFilter = 'all' | 'single' | 'multi';

/** YYYY-MM-DD HH:mm */
function fmt(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const tabCls = (on: boolean) =>
  `rounded-lg px-3 py-1 text-sm font-medium ${on ? 'bg-foreground text-background' : 'text-muted-foreground'}`;

/** A06 路线列表：全站只读，抽屉展示路线详情与出行设置（含本期新增字段） */
export function AdminRoutesClient({ routes }: { routes: AdminRouteItem[] }) {
  const [keyword, setKeyword] = useState('');
  const [daysFilter, setDaysFilter] = useState<DaysFilter>('all');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return routes.filter((r) => {
      if (daysFilter === 'single' && r.days !== 1) return false;
      if (daysFilter === 'multi' && r.days <= 1) return false;
      if (!kw) return true;
      return [r.userEmail, r.cityName, r.title].some((v) =>
        String(v ?? '')
          .toLowerCase()
          .includes(kw),
      );
    });
  }, [routes, keyword, daysFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / BUSINESS.ADMIN_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice(
    (currentPage - 1) * BUSINESS.ADMIN_PAGE_SIZE,
    currentPage * BUSINESS.ADMIN_PAGE_SIZE,
  );

  const detail = routes.find((r) => r.id === detailId) ?? null;
  const dayCounts = new Map<number, number>();
  if (detail) {
    for (const p of detail.places) {
      if (p.dayIndex !== null) dayCounts.set(p.dayIndex, (dayCounts.get(p.dayIndex) ?? 0) + 1);
    }
  }

  return (
    <>
      {/* 筛选 */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value);
            setPage(1);
          }}
          placeholder="搜索用户邮箱 / 城市 / 路线标题"
          className="h-10 w-full max-w-xs rounded-lg border border-border px-3 text-sm outline-none focus:border-primary md:w-72"
        />
        <div className="flex rounded-lg border border-border bg-background p-1">
          {(
            [
              ['all', '全部'],
              ['single', '单日'],
              ['multi', '多日'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setDaysFilter(value);
                setPage(1);
              }}
              className={tabCls(daysFilter === value)}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground md:ml-auto">共 {routes.length} 条路线</span>
      </div>

      {/* 列表 */}
      <section className="overflow-hidden rounded-2xl border border-border bg-background">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">用户邮箱</th>
                <th className="px-4 py-3 text-left font-medium">城市</th>
                <th className="px-4 py-3 text-left font-medium">路线标题</th>
                <th className="px-4 py-3 text-left font-medium">天数</th>
                <th className="px-4 py-3 text-left font-medium">地点数</th>
                <th className="px-4 py-3 text-left font-medium">出行设置</th>
                <th className="px-4 py-3 text-left font-medium">创建时间</th>
                <th className="px-4 py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">{r.userEmail}</td>
                  <td className="px-4 py-3">{r.cityName}</td>
                  <td className="px-4 py-3">{r.title}</td>
                  <td className="px-4 py-3">{r.days} 天</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        r.placeCount > BUSINESS.MAX_PLACES_PER_ROUTE
                          ? 'bg-red-50 text-red-700'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {r.placeCount} / {BUSINESS.MAX_PLACES_PER_ROUTE}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {r.originCity ?? '出发城市未填'} · {r.intercityLabel} · {r.lodgingLabel}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fmt(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setDetailId(r.id)}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-muted"
                    >
                      查看详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-sm text-muted-foreground">
              {routes.length === 0 ? '暂无路线数据' : '没有符合条件的路线'}
            </p>
            {routes.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setKeyword('');
                  setDaysFilter('all');
                }}
                className="mt-3 text-sm underline"
              >
                清空筛选
              </button>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
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
        )}
      </section>

      <p className="mt-4 text-xs text-muted-foreground">
        管理端只读：不能编辑或删除用户的路线，也不能替用户调整顺序、重新生成路线；如需处理请线下联系用户。
        单条路线地点数不得超过 {BUSINESS.MAX_PLACES_PER_ROUTE} 个，超出会标红。
      </p>

      {/* 详情抽屉 */}
      {detail ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setDetailId(null)}>
          <div
            className="h-full w-full max-w-md overflow-y-auto bg-background p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">{detail.title}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{detail.userEmail}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailId(null)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <dl className="mt-4 space-y-2 rounded-2xl border border-border p-4 text-sm">
              <Row label="城市" value={detail.cityName} />
              <Row label="天数" value={`${detail.days} 天`} />
              <Row label="市内交通" value={detail.transportLabel} />
              <Row
                label="地点数"
                value={`${detail.placeCount} / ${BUSINESS.MAX_PLACES_PER_ROUTE}`}
              />
              <Row label="创建时间" value={fmt(detail.createdAt)} />
            </dl>

            <h3 className="mt-5 text-sm font-semibold">出行设置（本期新增）</h3>
            <dl className="mt-2 space-y-2 rounded-2xl border border-border p-4 text-sm">
              <Row label="出发城市" value={detail.originCity ?? '未填写'} />
              <Row label="城际交通·去程" value={detail.intercityLabel} />
              <Row label="终点住宿" value={detail.lodgingLabel} />
            </dl>

            <h3 className="mt-5 text-sm font-semibold">勾选地点明细（只读）</h3>
            {detail.places.length === 0 ? (
              <p className="mt-2 rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground">
                该路线还没有勾选地点
              </p>
            ) : (
              <ol className="mt-2 space-y-2">
                {detail.places.map((p, i) => (
                  <li
                    key={`${p.name}-${i}`}
                    className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm"
                  >
                    <span className="w-6 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="shrink-0 rounded bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                      {p.typeLabel}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {p.dayIndex === null ? '未分配' : `第 ${p.dayIndex} 天`}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {dayCounts.size > 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {Array.from(dayCounts.entries())
                  .sort((a, b) => a[0] - b[0])
                  .map(([day, count]) => `第 ${day} 天 ${count} 个`)
                  .join(' · ')}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => setDetailId(null)}
              className="mt-6 h-11 w-full rounded-xl border border-border text-sm"
            >
              关闭
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

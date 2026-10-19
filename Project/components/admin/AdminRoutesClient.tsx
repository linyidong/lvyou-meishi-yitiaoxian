'use client';

import { useMemo, useState } from 'react';
import { Route, Search, X } from 'lucide-react';
import { BUSINESS } from '@/config/business';
import { TRANSPORT, TRANSPORT_LABEL } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import type { Transport } from '@/types';

const M = MESSAGES.ADMIN_ROUTES;

/** A06 路线行 */
export interface AdminRouteItem {
  id: string;
  userEmail: string;
  cityName: string;
  title: string;
  days: number;
  transport: Transport;
  transportLabel: string;
  originCity: string | null;
  intercityLabel: string;
  lodgingLabel: string;
  placeCount: number;
  createdAt: string;
  places: AdminRoutePlace[];
}

export interface AdminRoutePlace {
  name: string;
  typeLabel: string;
  dayIndex: number;
}

type TransportFilter = 'all' | Transport;
type DaysFilter = 'all' | 'single' | 'multi';

/** YYYY-MM-DD HH:mm */
function fmtTime(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const selectCls = 'h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm';

/** A06 路线列表：只读 + 详情抽屉（含城际 / 住宿 / 手动调整列） */
export function AdminRoutesClient({ routes }: { routes: AdminRouteItem[] }) {
  const [keyword, setKeyword] = useState('');
  const [transport, setTransport] = useState<TransportFilter>('all');
  const [days, setDays] = useState<DaysFilter>('all');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<AdminRouteItem | null>(null);

  const kw = keyword.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      routes.filter((r) => {
        if (transport !== 'all' && r.transport !== transport) return false;
        if (days === 'single' && r.days !== 1) return false;
        if (days === 'multi' && r.days < 2) return false;
        if (kw) {
          const hay = `${r.title} ${r.userEmail} ${r.cityName}`.toLowerCase();
          if (!hay.includes(kw)) return false;
        }
        return true;
      }),
    [routes, transport, days, kw],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / BUSINESS.ADMIN_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * BUSINESS.ADMIN_PAGE_SIZE,
    currentPage * BUSINESS.ADMIN_PAGE_SIZE,
  );

  const reset = () => {
    setKeyword('');
    setTransport('all');
    setDays('all');
    setPage(1);
  };

  if (routes.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
        <Route className="mx-auto h-12 w-12 text-slate-300" />
        <p className="mt-3 font-semibold">{M.emptyTitle}</p>
        <p className="mt-1 text-sm text-slate-500">{M.emptyDesc}</p>
      </section>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
            placeholder={M.searchPlaceholder}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-9 text-sm outline-none focus:border-slate-900"
          />
        </div>
        <select
          value={transport}
          onChange={(e) => {
            setTransport(e.target.value as TransportFilter);
            setPage(1);
          }}
          className={selectCls}
        >
          <option value="all">{M.transportAll}</option>
          {Object.values(TRANSPORT).map((m) => (
            <option key={m} value={m}>
              {TRANSPORT_LABEL[m]}
            </option>
          ))}
        </select>
        <select
          value={days}
          onChange={(e) => {
            setDays(e.target.value as DaysFilter);
            setPage(1);
          }}
          className={selectCls}
        >
          <option value="all">{M.daysAll}</option>
          <option value="single">{M.daysSingle}</option>
          <option value="multi">{M.daysMulti}</option>
        </select>
        <span className="text-sm text-slate-500 md:ml-auto">共 {filtered.length} 条</span>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{M.thTitle}</th>
                <th className="px-4 py-3 text-left font-medium">{M.thCity}</th>
                <th className="px-4 py-3 text-left font-medium">{M.thOrigin}</th>
                <th className="px-4 py-3 text-left font-medium">{M.thDays}</th>
                <th className="px-4 py-3 text-left font-medium">{M.thPlaces}</th>
                <th className="px-4 py-3 text-left font-medium">{M.thIntercity}</th>
                <th className="px-4 py-3 text-left font-medium">{M.thCityTransport}</th>
                <th className="px-4 py-3 text-left font-medium">{M.thLodging}</th>
                <th className="px-4 py-3 text-left font-medium">{M.thManual}</th>
                <th className="px-4 py-3 text-left font-medium">{M.thOwner}</th>
                <th className="px-4 py-3 text-left font-medium">{M.thUpdatedAt}</th>
                <th className="px-4 py-3 text-left font-medium">{M.thDetail}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.map((r) => {
                const over = r.placeCount > BUSINESS.MAX_PLACES_PER_ROUTE;
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium">{r.title}</td>
                    <td className="px-4 py-3">{r.cityName}</td>
                    <td className="px-4 py-3">{r.originCity ?? '—'}</td>
                    <td className="px-4 py-3">{r.days} 天</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          over ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {r.placeCount} / {BUSINESS.MAX_PLACES_PER_ROUTE}
                      </span>
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-slate-500">
                      {r.intercityLabel}
                    </td>
                    <td className="px-4 py-3">{r.transportLabel}</td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-slate-500">
                      {r.lodgingLabel}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{M.manualNone}</td>
                    <td className="px-4 py-3 text-slate-500">{r.userEmail}</td>
                    <td className="px-4 py-3 text-slate-500">{fmtTime(r.createdAt)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setDetail(r)}
                        className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-50"
                      >
                        {M.detailView}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {paged.length === 0 ? (
          <div className="py-14 text-center">
            <Route className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-2 text-sm text-slate-500">{M.noMatch}</p>
            <button type="button" onClick={reset} className="mt-3 text-sm underline">
              {M.resetFilter}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
            <span className="text-slate-500">
              {M.pagination(filtered.length, currentPage, totalPages)}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
                className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40"
              >
                {M.prev}
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(currentPage + 1)}
                className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40"
              >
                {M.next}
              </button>
            </div>
          </div>
        )}
      </section>

      <p className="mt-4 text-xs text-slate-400">{M.footNote}</p>

      {/* 路线详情抽屉（只读） */}
      {detail ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetail(null);
          }}
        >
          <div className="h-full w-full max-w-md overflow-y-auto bg-white">
            <div className="sticky top-0 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5">
              <h3 className="font-semibold">
                {M.drawerTitle}
                <span className="ml-2 text-xs font-normal text-slate-400">{M.drawerReadonly}</span>
              </h3>
              <button
                type="button"
                aria-label={M.closeAria}
                onClick={() => setDetail(null)}
                className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-5 text-sm">
              <div>
                <p className="text-xs text-slate-500">路线名称</p>
                <p className="font-medium">{detail.title}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-slate-500">创建者</p>
                  <p className="mt-0.5">{detail.userEmail}</p>
                </div>
                <div>
                  <p className="text-slate-500">城市</p>
                  <p className="mt-0.5">{detail.cityName}</p>
                </div>
                <div>
                  <p className="text-slate-500">出发城市</p>
                  <p className="mt-0.5">{detail.originCity ?? '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500">天数</p>
                  <p className="mt-0.5">{detail.days} 天</p>
                </div>
                <div>
                  <p className="text-slate-500">城际交通</p>
                  <p className="mt-0.5">{detail.intercityLabel}</p>
                </div>
                <div>
                  <p className="text-slate-500">市内交通</p>
                  <p className="mt-0.5">{detail.transportLabel}</p>
                </div>
                <div>
                  <p className="text-slate-500">住宿</p>
                  <p className="mt-0.5">{detail.lodgingLabel}</p>
                </div>
                <div>
                  <p className="text-slate-500">更新时间</p>
                  <p className="mt-0.5">{fmtTime(detail.createdAt)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500">
                  地点（{detail.placeCount} / {BUSINESS.MAX_PLACES_PER_ROUTE}）
                </p>
                {detail.places.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-400">该路线暂无地点</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {detail.places.map((p, i) => (
                      <li
                        key={`${p.name}-${i}`}
                        className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"
                      >
                        <span className="w-10 shrink-0 text-slate-500">D{p.dayIndex + 1}</span>
                        <span className="flex-1 truncate">{p.name}</span>
                        <span className="shrink-0 rounded bg-white px-2 py-0.5 text-slate-500">
                          {p.typeLabel}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

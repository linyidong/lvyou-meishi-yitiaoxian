'use client';

import { useMemo, useState } from 'react';
import { MapPinOff, Search } from 'lucide-react';
import { BUSINESS } from '@/config/business';
import {
  GEO_STATUS,
  GEO_STATUS_LABEL,
  IMPORT_SOURCE_LABEL,
  PLACE_TYPE,
  PLACE_TYPE_LABEL,
} from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import type { GeoStatus, ImportSource, PlaceType } from '@/types';

const M = MESSAGES.ADMIN_PLACES;

/** A05 地点行（服务端查好后传入） */
export interface AdminPlaceRow {
  id: string;
  name: string;
  type: PlaceType;
  cityName: string | null;
  source: ImportSource | null;
  geoStatus: GeoStatus;
  ownerEmail: string | null;
  createdAt: string;
}

type TypeFilter = 'all' | PlaceType;

/** YYYY-MM-DD HH:mm */
function fmtTime(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const selectCls = 'h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm';

/** 坐标匹配配色：已匹配绿 / 待确认琥珀 / 未匹配红 */
const geoCls: Record<GeoStatus, string> = {
  [GEO_STATUS.MATCHED]: 'bg-emerald-50 text-emerald-700',
  [GEO_STATUS.PENDING]: 'bg-amber-50 text-amber-700',
  [GEO_STATUS.UNMATCHED]: 'bg-red-50 text-red-700',
};

/** 地点类型配色：景点蓝 / 美食琥珀 */
const typeCls: Record<PlaceType, string> = {
  [PLACE_TYPE.ATTRACTION]: 'bg-sky-50 text-sky-700',
  [PLACE_TYPE.FOOD]: 'bg-amber-50 text-amber-700',
};

/** A05 地点列表：只读，支持搜索 / 城市 / 类型筛选与分页 */
export function AdminPlacesClient({ rows }: { rows: AdminPlaceRow[] }) {
  const [keyword, setKeyword] = useState('');
  const [city, setCity] = useState('all');
  const [type, setType] = useState<TypeFilter>('all');
  const [page, setPage] = useState(1);

  const kw = keyword.trim().toLowerCase();

  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.cityName) set.add(r.cityName);
    }
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (city !== 'all' && r.cityName !== city) return false;
        if (type !== 'all' && r.type !== type) return false;
        if (kw) {
          const hay = `${r.name} ${r.ownerEmail ?? ''}`.toLowerCase();
          if (!hay.includes(kw)) return false;
        }
        return true;
      }),
    [rows, city, type, kw],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / BUSINESS.ADMIN_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * BUSINESS.ADMIN_PAGE_SIZE,
    currentPage * BUSINESS.ADMIN_PAGE_SIZE,
  );

  const reset = () => {
    setKeyword('');
    setCity('all');
    setType('all');
    setPage(1);
  };

  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
        <MapPinOff className="mx-auto h-12 w-12 text-slate-300" />
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
          value={city}
          onChange={(e) => {
            setCity(e.target.value);
            setPage(1);
          }}
          className={selectCls}
        >
          <option value="all">{M.cityAll}</option>
          {cityOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value as TypeFilter);
            setPage(1);
          }}
          className={selectCls}
        >
          <option value="all">{M.typeAll}</option>
          <option value={PLACE_TYPE.ATTRACTION}>{PLACE_TYPE_LABEL[PLACE_TYPE.ATTRACTION]}</option>
          <option value={PLACE_TYPE.FOOD}>{PLACE_TYPE_LABEL[PLACE_TYPE.FOOD]}</option>
        </select>
        <span className="text-sm text-slate-500 md:ml-auto">共 {filtered.length} 条</span>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{M.thName}</th>
                <th className="px-4 py-3 text-left font-medium">{M.thType}</th>
                <th className="px-4 py-3 text-left font-medium">{M.thCity}</th>
                <th className="px-4 py-3 text-left font-medium">{M.thSource}</th>
                <th className="px-4 py-3 text-left font-medium">{M.thGeo}</th>
                <th className="px-4 py-3 text-left font-medium">{M.thOwner}</th>
                <th className="px-4 py-3 text-left font-medium">{M.thCreatedAt}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs ${typeCls[r.type]}`}>
                      {PLACE_TYPE_LABEL[r.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3">{r.cityName ?? '—'}</td>
                  <td className="px-4 py-3">{r.source ? IMPORT_SOURCE_LABEL[r.source] : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs ${geoCls[r.geoStatus]}`}>
                      {GEO_STATUS_LABEL[r.geoStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{r.ownerEmail ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtTime(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {paged.length === 0 ? (
          <div className="py-14 text-center">
            <Search className="mx-auto h-10 w-10 text-slate-300" />
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
    </>
  );
}

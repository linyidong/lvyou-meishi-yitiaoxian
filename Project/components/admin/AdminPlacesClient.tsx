'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { BUSINESS } from '@/config/business';
import {
  GEO_STATUS,
  GEO_STATUS_LABEL,
  IMPORT_SOURCE_LABEL,
  PLACE_TYPE,
  PLACE_TYPE_LABEL,
} from '@/config/enums';
import type { GeoStatus, ImportSource, PlaceType } from '@/types';

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

const selectCls =
  'h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary';

/** 坐标匹配配色：已匹配绿 / 待确认琥珀 / 未匹配红 */
const geoCls: Record<GeoStatus, string> = {
  [GEO_STATUS.MATCHED]: 'bg-emerald-50 text-emerald-700',
  [GEO_STATUS.PENDING]: 'bg-amber-50 text-amber-700',
  [GEO_STATUS.UNMATCHED]: 'bg-red-50 text-red-700',
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

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
            placeholder="搜索地点名称或创建者邮箱"
            className="h-10 w-full rounded-xl border border-border pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <select
          value={city}
          onChange={(e) => { setCity(e.target.value); setPage(1); }}
          className={selectCls}
        >
          <option value="all">全部城市</option>
          {cityOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => { setType(e.target.value as TypeFilter); setPage(1); }}
          className={selectCls}
        >
          <option value="all">全部类型</option>
          <option value={PLACE_TYPE.ATTRACTION}>{PLACE_TYPE_LABEL[PLACE_TYPE.ATTRACTION]}</option>
          <option value={PLACE_TYPE.FOOD}>{PLACE_TYPE_LABEL[PLACE_TYPE.FOOD]}</option>
        </select>
      </div>

      <section className="mt-4 overflow-hidden rounded-2xl border border-border bg-background">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">地点名称</th>
                <th className="px-4 py-3 text-left font-medium">类型</th>
                <th className="px-4 py-3 text-left font-medium">城市</th>
                <th className="px-4 py-3 text-left font-medium">来源</th>
                <th className="px-4 py-3 text-left font-medium">坐标匹配</th>
                <th className="px-4 py-3 text-left font-medium">创建者</th>
                <th className="px-4 py-3 text-left font-medium">创建时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paged.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3">{PLACE_TYPE_LABEL[r.type]}</td>
                  <td className="px-4 py-3">{r.cityName ?? '—'}</td>
                  <td className="px-4 py-3">{r.source ? IMPORT_SOURCE_LABEL[r.source] : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${geoCls[r.geoStatus]}`}>
                      {GEO_STATUS_LABEL[r.geoStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.ownerEmail ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtTime(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {paged.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-sm text-muted-foreground">没有符合条件的地点</p>
            <button
              type="button"
              onClick={reset}
              className="mt-4 h-10 rounded-xl border border-border px-5 text-sm font-medium hover:bg-muted"
            >
              重置筛选
            </button>
          </div>
        ) : null}
      </section>

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
  );
}

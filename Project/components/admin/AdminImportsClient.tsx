'use client';

import { useMemo, useState } from 'react';
import { FileSearch, Search, Upload } from 'lucide-react';
import { BUSINESS } from '@/config/business';
import { IMPORT_SOURCE_LABEL, IMPORT_STATUS, IMPORT_STATUS_LABEL } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import type { ImportSource, ImportStatus } from '@/types';

const M = MESSAGES.ADMIN_IMPORTS;

/** A07 导入行 */
export interface AdminImportRow {
  id: string;
  userEmail: string | null;
  rawText: string;
  source: ImportSource;
  status: ImportStatus;
  createdAt: string;
}

type StatusFilter = 'all' | ImportStatus;

/** YYYY-MM-DD HH:mm */
function fmtTime(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 状态徽章配色（与 U06 导入反馈一致） */
const statusCls: Record<ImportStatus, string> = {
  [IMPORT_STATUS.SUCCESS]: 'bg-emerald-50 text-emerald-700',
  [IMPORT_STATUS.NEED_TEXT]: 'bg-amber-50 text-amber-700',
  [IMPORT_STATUS.UNRECOGNIZED]: 'bg-sky-50 text-sky-700',
  [IMPORT_STATUS.FAILED]: 'bg-red-50 text-red-700',
};

const tabCls = (on: boolean) =>
  `shrink-0 rounded-md px-3 py-1 ${on ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'}`;

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: M.statusAll },
  { value: IMPORT_STATUS.SUCCESS, label: IMPORT_STATUS_LABEL[IMPORT_STATUS.SUCCESS] },
  { value: IMPORT_STATUS.NEED_TEXT, label: IMPORT_STATUS_LABEL[IMPORT_STATUS.NEED_TEXT] },
  { value: IMPORT_STATUS.UNRECOGNIZED, label: IMPORT_STATUS_LABEL[IMPORT_STATUS.UNRECOGNIZED] },
  { value: IMPORT_STATUS.FAILED, label: IMPORT_STATUS_LABEL[IMPORT_STATUS.FAILED] },
];

/** A07 导入记录：只读，支持关键词 / 状态筛选与分页 */
export function AdminImportsClient({ rows }: { rows: AdminImportRow[] }) {
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);

  const kw = keyword.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (status !== 'all' && r.status !== status) return false;
        if (kw) {
          const hay = `${r.userEmail ?? ''} ${r.rawText}`.toLowerCase();
          if (!hay.includes(kw)) return false;
        }
        return true;
      }),
    [rows, status, kw],
  );

  const successCount = rows.filter((r) => r.status === IMPORT_STATUS.SUCCESS).length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / BUSINESS.ADMIN_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * BUSINESS.ADMIN_PAGE_SIZE,
    currentPage * BUSINESS.ADMIN_PAGE_SIZE,
  );

  const reset = () => {
    setKeyword('');
    setStatus('all');
    setPage(1);
  };

  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
        <Upload className="mx-auto h-12 w-12 text-slate-300" />
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
        <div className="flex overflow-x-auto rounded-lg border border-slate-200 bg-white p-1 text-sm">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setStatus(t.value);
                setPage(1);
              }}
              className={tabCls(status === t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="text-sm text-slate-500 md:ml-auto">
          共 {filtered.length} 条 · 提取成功 {successCount} 条
        </span>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{M.thTime}</th>
                <th className="px-4 py-3 text-left font-medium">{M.thUser}</th>
                <th className="px-4 py-3 text-left font-medium">{M.thCity}</th>
                <th className="px-4 py-3 text-left font-medium">{M.thSource}</th>
                <th className="px-4 py-3 text-left font-medium">{M.thInput}</th>
                <th className="px-4 py-3 text-left font-medium">{M.thSummary}</th>
                <th className="px-4 py-3 text-left font-medium">{M.thExtract}</th>
                <th className="px-4 py-3 text-left font-medium">{M.thStatus}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">{fmtTime(r.createdAt)}</td>
                  <td className="px-4 py-3">{r.userEmail ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">—</td>
                  <td className="px-4 py-3">{IMPORT_SOURCE_LABEL[r.source]}</td>
                  <td className="px-4 py-3 text-slate-500">—</td>
                  <td className="max-w-[320px] px-4 py-3">
                    <span className="line-clamp-2 text-slate-600">{r.rawText}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">—</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs ${statusCls[r.status]}`}>
                      {IMPORT_STATUS_LABEL[r.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {paged.length === 0 ? (
          <div className="py-14 text-center">
            <FileSearch className="mx-auto h-10 w-10 text-slate-300" />
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

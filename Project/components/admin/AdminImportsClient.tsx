'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { BUSINESS } from '@/config/business';
import { IMPORT_SOURCE_LABEL, IMPORT_STATUS, IMPORT_STATUS_LABEL } from '@/config/enums';
import type { ImportSource, ImportStatus } from '@/types';

/** A07 导入行（服务端查好后传入） */
export interface AdminImportRow {
  id: string;
  createdAt: string;
  userEmail: string | null;
  source: ImportSource;
  /** raw_text 截断后的摘要 */
  summary: string;
  status: ImportStatus;
}

type StatusTab = 'all' | ImportStatus;

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: 'all', label: '全部' },
  ...Object.entries(IMPORT_STATUS_LABEL).map(([value, label]) => ({
    value: value as ImportStatus,
    label,
  })),
];

/** YYYY-MM-DD HH:mm */
function fmtTime(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 状态配色：成功绿 / 需补文案琥珀 / 未识别灰 / 失败红 */
const statusCls: Record<ImportStatus, string> = {
  [IMPORT_STATUS.SUCCESS]: 'bg-emerald-50 text-emerald-700',
  [IMPORT_STATUS.NEED_TEXT]: 'bg-amber-50 text-amber-700',
  [IMPORT_STATUS.UNRECOGNIZED]: 'bg-muted text-muted-foreground',
  [IMPORT_STATUS.FAILED]: 'bg-red-50 text-red-700',
};

/** A07 导入记录：只读，状态 Tab + 搜索 + 分页 */
export function AdminImportsClient({ rows }: { rows: AdminImportRow[] }) {
  const [keyword, setKeyword] = useState('');
  const [tab, setTab] = useState<StatusTab>('all');
  const [page, setPage] = useState(1);

  const kw = keyword.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (tab !== 'all' && r.status !== tab) return false;
        if (kw) {
          const hay = `${r.userEmail ?? ''} ${r.summary}`.toLowerCase();
          if (!hay.includes(kw)) return false;
        }
        return true;
      }),
    [rows, tab, kw],
  );

  const successCount = rows.filter((r) => r.status === IMPORT_STATUS.SUCCESS).length;
  const successRate = rows.length > 0 ? Math.round((successCount / rows.length) * 100) : 0;

  const totalPages = Math.max(1, Math.ceil(filtered.length / BUSINESS.ADMIN_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice(
    (currentPage - 1) * BUSINESS.ADMIN_PAGE_SIZE,
    currentPage * BUSINESS.ADMIN_PAGE_SIZE,
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          共 {rows.length} 条导入 · 提取成功 {successCount} 条 · 成功率 {successRate}%
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
            placeholder="搜索用户邮箱或内容摘要"
            className="h-10 w-full rounded-xl border border-border pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => { setTab(t.value); setPage(1); }}
            className={`rounded-full border px-3.5 py-1.5 text-sm ${
              tab === t.value
                ? 'border-primary bg-primary/5 font-medium text-primary'
                : 'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className="mt-4 overflow-hidden rounded-2xl border border-border bg-background">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">导入时间</th>
                <th className="px-4 py-3 text-left font-medium">用户</th>
                <th className="px-4 py-3 text-left font-medium">来源</th>
                <th className="px-4 py-3 text-left font-medium">内容摘要</th>
                <th className="px-4 py-3 text-left font-medium">状态</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paged.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {fmtTime(r.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.userEmail ?? '—'}</td>
                  <td className="px-4 py-3">{IMPORT_SOURCE_LABEL[r.source]}</td>
                  <td className="max-w-[320px] truncate px-4 py-3">{r.summary}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${statusCls[r.status]}`}>
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
            <p className="text-sm text-muted-foreground">没有符合条件的导入记录</p>
            <button
              type="button"
              onClick={() => { setKeyword(''); setTab('all'); setPage(1); }}
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

      <p className="mt-4 text-xs text-muted-foreground">
        导入内容只保存用户主动粘贴的文本，不爬取平台内容。
      </p>
    </>
  );
}

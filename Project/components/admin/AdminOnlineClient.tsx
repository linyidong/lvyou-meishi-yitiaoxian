'use client';

import { useRouter } from 'next/navigation';
import { Info, Moon, Wifi, RefreshCw } from 'lucide-react';
import { MESSAGES } from '@/config/messages';

const M = MESSAGES.ADMIN_ONLINE;

export interface AdminOnlineRow {
  id: string;
  email: string | null;
  username: string | null;
  /** 服务端算好的「刚刚 / N 分钟前 / —」 */
  lastSeenText: string;
  currentPath: string | null;
  /** 距离最后一次心跳的时长文案，无法计算时为 — */
  onlineDuration: string;
}

/** A04 在线用户：深色统计卡 + 只读表格，仅提供手动刷新 */
export function AdminOnlineClient({
  rows,
  onlineCount,
  thresholdMinutes,
  refreshedAt,
}: {
  rows: AdminOnlineRow[];
  onlineCount: number;
  thresholdMinutes: number;
  /** 最后刷新时刻 HH:mm:ss */
  refreshedAt: string;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <>
      {/* 深色统计卡 */}
      <section className="flex flex-col gap-4 rounded-2xl bg-slate-900 p-6 text-white sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-400">
            <Wifi className="h-[30px] w-[30px]" />
          </span>
          <div>
            <p className="text-sm text-slate-400">{M.cardLabel}</p>
            <p className="text-4xl font-bold md:text-5xl">
              {onlineCount}
              <span className="ml-1 text-lg font-medium text-slate-400">{M.peopleSuffix}</span>
            </p>
          </div>
        </div>
        <div className="space-y-1 text-sm text-slate-400 sm:ml-auto">
          <p className="flex items-center gap-1.5">
            <Info className="h-4 w-4" />
            {M.info(thresholdMinutes)}
          </p>
          <p>
            {M.refreshedAt}
            <span className="text-slate-200">{refreshedAt}</span>
          </p>
        </div>
      </section>

      {rows.length === 0 ? (
        <section className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <Moon className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 font-semibold">{M.emptyTitle}</p>
          <p className="mt-1 text-sm text-slate-500">{M.emptyDesc(thresholdMinutes)}</p>
          <button
            type="button"
            onClick={refresh}
            className="mt-4 h-10 rounded-lg border border-slate-300 px-5 text-sm"
          >
            {M.refresh}
          </button>
        </section>
      ) : (
        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{M.thEmail}</th>
                  <th className="px-4 py-3 text-left font-medium">{M.thUsername}</th>
                  <th className="px-4 py-3 text-left font-medium">{M.thLastSeen}</th>
                  <th className="px-4 py-3 text-left font-medium">{M.thCurrentPage}</th>
                  <th className="px-4 py-3 text-left font-medium">{M.thSource}</th>
                  <th className="px-4 py-3 text-left font-medium">{M.thDuration}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3">{u.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      {u.username ?? (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                          {M.guest}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{u.lastSeenText}</td>
                    <td className="px-4 py-3 text-slate-500">{u.currentPath ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">—</td>
                    <td className="px-4 py-3 text-slate-500">{u.onlineDuration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-0.5 border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
            <p>{M.noteUsername}</p>
            <p>{M.noteSource}</p>
          </div>
        </section>
      )}

      <p className="mt-4 text-xs text-slate-400">{M.footNote}</p>
    </>
  );
}

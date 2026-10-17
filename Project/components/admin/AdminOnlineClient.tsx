'use client';

import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

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

  return (
    <>
      {/* 深色统计卡 */}
      <section className="flex flex-wrap items-center gap-4 rounded-2xl bg-foreground p-6 text-background">
        <div>
          <p className="text-xs text-background/70">当前在线</p>
          <p className="mt-1 text-4xl font-bold">
            {onlineCount}
            <span className="ml-1 text-base font-medium">人</span>
          </p>
        </div>
        <div className="text-xs text-background/70">
          <p>在线定义：最近 {thresholdMinutes} 分钟有心跳</p>
          <p className="mt-0.5">最后刷新时刻 {refreshedAt}</p>
        </div>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="ml-auto flex h-10 items-center gap-1.5 rounded-xl bg-background px-4 text-sm font-medium text-foreground hover:brightness-95"
        >
          <RefreshCw className="h-4 w-4" />
          刷新
        </button>
      </section>

      {/* 表格 */}
      <section className="mt-5 overflow-hidden rounded-2xl border border-border bg-background">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">邮箱</th>
                <th className="px-4 py-3 text-left font-medium">用户名</th>
                <th className="px-4 py-3 text-left font-medium">最后活跃</th>
                <th className="px-4 py-3 text-left font-medium">当前页面</th>
                <th className="px-4 py-3 text-left font-medium">在线时长</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">{u.email ?? '—'}</td>
                  <td className="px-4 py-3">{u.username ?? '—'}</td>
                  <td className="px-4 py-3">{u.lastSeenText}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.currentPath ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.onlineDuration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-sm text-muted-foreground">当前无人在线</p>
            <p className="mt-1 text-xs text-muted-foreground">
              最近 {thresholdMinutes} 分钟内没有用户心跳，稍后可点击刷新。
            </p>
          </div>
        ) : null}
      </section>

      <p className="mt-4 text-xs text-muted-foreground">
        只读页面：不提供踢出、封禁或发送消息操作。
      </p>
    </>
  );
}

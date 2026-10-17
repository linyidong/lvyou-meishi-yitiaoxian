import { BUSINESS } from '@/config/business';
import { ROUTES } from '@/config/routes';
import { AdminOnlineClient, type AdminOnlineRow } from '@/components/admin/AdminOnlineClient';
import { PageHeader } from '@/components/common/PageHeader';
import { AdminShell } from '@/components/layout/AdminShell';
import { createClient } from '@/lib/supabase/server';

/** HH:mm:ss */
function fmtClock(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 「刚刚 / N 分钟前」，无心跳记录时为 — */
function formatLastSeen(iso: string | null): string {
  if (!iso) return '—';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return minutes <= 0 ? '刚刚' : `${minutes} 分钟前`;
}

/** 距离最后一次心跳的时长（天 / 小时 / 分钟） */
function formatElapsed(iso: string | null): string {
  if (!iso) return '—';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时 ${minutes % 60} 分`;
  const dayCount = Math.floor(hours / 24);
  return `${dayCount} 天 ${hours % 24} 小时`;
}

/** A04 在线用户：只读，按最后活跃倒序，仅手动刷新 */
export default async function AdminOnlinePage() {
  const supabase = createClient();
  const now = new Date();
  const onlineSince = new Date(
    now.getTime() - BUSINESS.ONLINE_THRESHOLD_MINUTES * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from('users')
    .select('id,email,username,last_seen_at,current_path')
    .gte('last_seen_at', onlineSince)
    .order('last_seen_at', { ascending: false })
    .limit(BUSINESS.ADMIN_LIST_LIMIT);

  const rows: AdminOnlineRow[] = (data ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    username: u.username,
    lastSeenText: formatLastSeen(u.last_seen_at),
    currentPath: u.current_path,
    onlineDuration: formatElapsed(u.last_seen_at),
  }));

  return (
    <AdminShell currentPath={ROUTES.ADMIN_ONLINE}>
      <PageHeader
        title="A04 在线用户"
        description={`在线判定按最后活跃时间 ≤ ${BUSINESS.ONLINE_THRESHOLD_MINUTES} 分钟计算 · 单次最多读取 ${BUSINESS.ADMIN_LIST_LIMIT} 条 · 仅手动刷新。`}
      />
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="font-semibold text-red-800">在线用户加载失败</p>
          <p className="mt-1 text-sm text-red-700">{error.message}</p>
        </div>
      ) : (
        <AdminOnlineClient
          rows={rows}
          onlineCount={rows.length}
          thresholdMinutes={BUSINESS.ONLINE_THRESHOLD_MINUTES}
          refreshedAt={fmtClock(now)}
        />
      )}
    </AdminShell>
  );
}

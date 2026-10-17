import { BUSINESS } from '@/config/business';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { AdminOnlineClient, type AdminOnlineRow } from '@/components/admin/AdminOnlineClient';
import { AdminErrorState } from '@/components/admin/AdminState';
import { AdminShell } from '@/components/layout/AdminShell';
import { createClient } from '@/lib/supabase/server';
import { Unplug } from 'lucide-react';

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
    <AdminShell
      currentPath={ROUTES.ADMIN_ONLINE}
      title={MESSAGES.ADMIN_SHELL.navOnline}
      badge={MESSAGES.ADMIN_SHELL.badgeReadonly}
      refresh
      refreshBanner={MESSAGES.ADMIN_ONLINE.refreshedBanner}
    >
      {error ? (
        <AdminErrorState icon={Unplug} title={MESSAGES.ADMIN_ONLINE.errorTitle} />
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

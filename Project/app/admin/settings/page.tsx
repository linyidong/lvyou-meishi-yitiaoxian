import { AlertTriangle, Info } from 'lucide-react';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { AdminShell } from '@/components/layout/AdminShell';
import { SettingsForm } from '@/components/admin/SettingsForm';
import { getAppSettings, toPublicSettings } from '@/lib/app-settings';

/**
 * T-049 管理端「设置」页：三组表单（AI 模型 / 业务开关 / 配额数字），
 * 初始值从 app_settings（key='global'）读出，保存后 DB 持久化、刷新保留。
 * 访问保护：middleware.ts 的 ADMIN_ROUTES 已要求 role=admin。
 */

const M = MESSAGES.ADMIN_SETTINGS;

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  // T-057：页面初值走掩码形态，明文 API Key 绝不进入客户端 RSC payload
  const settings = toPublicSettings(await getAppSettings());

  return (
    <AdminShell currentPath={ROUTES.ADMIN_SETTINGS} title={M.title} badge={M.badge}>
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs text-sky-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{M.notice}</span>
      </div>
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{M.riskNotice}</span>
      </div>
      <SettingsForm initial={settings} />
    </AdminShell>
  );
}

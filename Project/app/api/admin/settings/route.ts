import { NextResponse, type NextRequest } from 'next/server';
import { USER_ROLE } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { getAppSettings, saveAppSettings, validateSettingsPatch } from '@/lib/app-settings';
import { createClient } from '@/lib/supabase/server';

/**
 * T-049 管理端全局设置读写
 * GET   /api/admin/settings → 当前生效设置（DB 值与默认值合并后）
 * PATCH /api/admin/settings → 校验后合并保存，返回保存后的完整设置
 * 仅 role=admin 可访问；app_settings 表 RLS 无策略，读写全部走 service_role（lib/app-settings.ts）。
 */

/** 管理员身份校验（与 A08 订单核销接口同一口径） */
async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: MESSAGES.LOGIN_FIRST }, { status: 401 });
  }
  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== USER_ROLE.ADMIN) {
    return NextResponse.json({ ok: false, message: MESSAGES.FORBIDDEN }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const settings = await getAppSettings();
    return NextResponse.json({ ok: true, settings });
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.ADMIN_SETTINGS.errLoad }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  const checked = validateSettingsPatch(raw);
  if (!checked.ok) {
    return NextResponse.json({ ok: false, message: checked.error }, { status: 400 });
  }

  try {
    const settings = await saveAppSettings(checked.patch);
    return NextResponse.json({ ok: true, settings });
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.ADMIN_SETTINGS.errSave }, { status: 500 });
  }
}

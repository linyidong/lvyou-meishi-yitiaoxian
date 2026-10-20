import { NextResponse, type NextRequest } from 'next/server';
import { BUSINESS } from '@/config/business';
import { MESSAGES } from '@/config/messages';
import { USER_ROLE } from '@/config/enums';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyPasswordReset } from '@/lib/order-notify';

/**
 * U01 忘记密码 · 自助重置（无邮件通道版）
 * POST /api/auth/reset-password
 * body: { email, password }
 *
 * 本项目的自建 Supabase 没有 SMTP，标准的「邮件重置链接」发不出去，
 * 因此这里采用「本人凭注册邮箱直接设新密码」的方式：
 *   1) 按邮箱找到账号；
 *   2) 用 Secret Key 直接改写 auth 密码（只动登录凭证）。
 * ⚠️ 只改 auth.users 的密码，**不触碰 public.users**，所以 member / member_until /
 *    role 等全部原样保留 —— 会员权益与账号绑定关系不受影响。
 * ⚠️ 没有邮件或短信做「本人验证」，因此任何知道该邮箱的人都能改密码。为降低风险：
 *    - 管理员账号（role=admin）禁止走此通道，避免管理后台被接管；
 *    - 按 IP 限流，避免批量枚举邮箱刷接口；
 *    - 每次重置成功后外发提醒给管理员，便于发现异常并人工纠正。
 * 上线接入 SMTP 后，应改为「发重置邮件 + 点链接设置新密码」的标准流程。
 */

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/** 进程内 IP 限流记录：key = IP，value = 窗口起点与窗口内次数 */
const hits = new Map<string, { windowStart: number; count: number }>();

/** 取客户端 IP；无代理头时（本地直连）统一记 'local'，避免降级成不限流 */
function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'local'
  );
}

/** 滑动窗口限流：窗口内超过上限即拒绝 */
function allowRequest(ip: string): boolean {
  const now = Date.now();
  const windowMs = BUSINESS.PASSWORD_RESET_RATE_WINDOW_MINUTES * 60 * 1000;
  const record = hits.get(ip);
  if (!record || now - record.windowStart > windowMs) {
    hits.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  if (record.count >= BUSINESS.PASSWORD_RESET_RATE_LIMIT_PER_WINDOW) return false;
  record.count += 1;
  return true;
}

/** 服务端本地时间 YYYY-MM-DD HH:mm（用于外发提醒里的「重置时间」） */
function fmtLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.INVALID_PARAMS }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email) {
    return NextResponse.json({ ok: false, message: MESSAGES.AUTH_EMAIL_REQUIRED }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, message: MESSAGES.AUTH_EMAIL_INVALID }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ ok: false, message: MESSAGES.AUTH_PASSWORD_REQUIRED }, { status: 400 });
  }
  if (password.length < BUSINESS.MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ ok: false, message: MESSAGES.AUTH_PASSWORD_TOO_SHORT }, { status: 400 });
  }

  if (!allowRequest(clientIp(request))) {
    return NextResponse.json({ ok: false, message: MESSAGES.RESET_PASSWORD.errTooMany }, { status: 429 });
  }

  const admin = createAdminClient();

  // 邮箱大小写不敏感匹配（前端可能输入大写），邮箱列在库中是唯一约束
  const { data: profile, error: findError } = await admin
    .from('users')
    .select('id, role')
    .ilike('email', email)
    .maybeSingle();

  if (findError) {
    return NextResponse.json({ ok: false, message: MESSAGES.RESET_PASSWORD.errFailed }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ ok: false, message: MESSAGES.RESET_PASSWORD.errNotRegistered }, { status: 404 });
  }
  if (profile.role === USER_ROLE.ADMIN) {
    // 管理员账号不开放自助重置：否则任何知道管理员邮箱的人都能接管后台
    return NextResponse.json({ ok: false, message: MESSAGES.RESET_PASSWORD.errAdminBlocked }, { status: 403 });
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(profile.id, { password });
  if (updateError) {
    console.warn('[reset-password] updateUserById failed', {
      code: updateError.code ?? null,
      message: updateError.message ?? null,
    });
    return NextResponse.json({ ok: false, message: MESSAGES.RESET_PASSWORD.errFailed }, { status: 500 });
  }

  // 外发提醒（企业微信群机器人 / 企业微信应用），失败只记日志，不影响重置结果
  await notifyPasswordReset({ email, at: fmtLocal(new Date()) });

  return NextResponse.json({ ok: true, message: MESSAGES.RESET_PASSWORD.okNotice });
}

import { NextResponse, type NextRequest } from 'next/server';
import { USER_ROLE } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { PRODUCT } from '@/config/product';
import { ROUTES } from '@/config/routes';
import { getQuotaProfile } from '@/lib/member-quota';
import { buildRouteSnapshot, generateShareToken } from '@/lib/route-share';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * 阶段 3 路线分享令牌
 * POST   /api/routes/[id]/share → 作废旧令牌 + 生成新令牌，返回 { token, url, snapshot }
 * DELETE /api/routes/[id]/share → 撤销该路线当前有效的分享令牌
 *
 * 权限：登录 + 该路线归属本人（或管理员）+ 档位非 free（会员功能）。
 * route_shares 无策略，读写一律走 service_role。
 */

/**
 * 由请求头推导站点地址。
 * 优先取 config/product.ts 的 DEPLOY_DOMAIN（正式域名 / 局域网 IP）：本地用 localhost 打开时，
 * 二维码里写的是 localhost，手机扫码后指向手机自己 → 必然「无法访问」，配了 DEPLOY_DOMAIN 即可避免。
 * 未配置时回落到请求 Host，兼容未填域名的本地开发。
 */
function siteOrigin(request: NextRequest): string {
  const configured = PRODUCT.DEPLOY_DOMAIN.trim();
  if (configured) return configured.replace(/\/+$/, '');

  const forwardedProto = request.headers.get('x-forwarded-proto');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (host) {
    // 无代理头时（本地 http 直连）按请求自身协议推导，避免误拼成 https 导致二维码打不开
    const proto = forwardedProto?.split(',')[0]?.trim() || request.nextUrl.protocol.replace(':', '');
    return `${proto || 'http'}://${host}`;
  }
  return request.nextUrl.origin;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: MESSAGES.LOGIN_FIRST }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data: route } = await admin
      .from('routes')
      .select('id,user_id')
      .eq('id', params.id)
      .maybeSingle();
    if (!route) {
      return NextResponse.json({ ok: false, message: MESSAGES.SHARE.failNotFound }, { status: 404 });
    }

    // 归属本人，或管理员
    if (route.user_id !== user.id) {
      const { data: me } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
      if (me?.role !== USER_ROLE.ADMIN) {
        return NextResponse.json({ ok: false, message: MESSAGES.FORBIDDEN }, { status: 403 });
      }
    }

    // 会员分层：游客 / 免费用户不可导出，管理员不受限
    const { tier } = await getQuotaProfile(user.id);
    if (tier === 'free') {
      return NextResponse.json({ ok: false, message: MESSAGES.SHARE.needMember }, { status: 403 });
    }

    const snapshot = await buildRouteSnapshot(route.id, route.user_id);
    if (!snapshot) {
      return NextResponse.json({ ok: false, message: MESSAGES.SHARE.failNotFound }, { status: 404 });
    }

    // 一图一码：先作废该路线已有的未撤销令牌，再写入新令牌
    await admin
      .from('route_shares')
      .update({ revoked_at: new Date().toISOString() })
      .eq('route_id', route.id)
      .is('revoked_at', null);

    const token = generateShareToken();
    const { error } = await admin.from('route_shares').insert({
      token,
      route_id: route.id,
      owner_id: user.id,
      snapshot,
    });
    if (error) {
      return NextResponse.json({ ok: false, message: MESSAGES.SHARE.failSave }, { status: 500 });
    }

    const url = `${siteOrigin(request)}${ROUTES.SHARE(token)}`;
    return NextResponse.json({ ok: true, token, url, snapshot });
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.SHARE.failSave }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: MESSAGES.LOGIN_FIRST }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data: route } = await admin
      .from('routes')
      .select('id,user_id')
      .eq('id', params.id)
      .maybeSingle();
    if (!route) {
      return NextResponse.json({ ok: false, message: MESSAGES.SHARE.failNotFound }, { status: 404 });
    }

    if (route.user_id !== user.id) {
      const { data: me } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
      if (me?.role !== USER_ROLE.ADMIN) {
        return NextResponse.json({ ok: false, message: MESSAGES.FORBIDDEN }, { status: 403 });
      }
    }

    const { error } = await admin
      .from('route_shares')
      .update({ revoked_at: new Date().toISOString() })
      .eq('route_id', route.id)
      .is('revoked_at', null);
    if (error) {
      return NextResponse.json({ ok: false, message: MESSAGES.SHARE.failSave }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: MESSAGES.SHARE.failSave }, { status: 500 });
  }
}

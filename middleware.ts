import { NextResponse, type NextRequest } from 'next/server';
import { MESSAGES } from '@/config/messages';
import { ADMIN_ROUTES, PROTECTED_ROUTES, ROUTES } from '@/config/routes';
import { USER_ROLE } from '@/config/enums';
import { updateSession } from '@/lib/supabase/middleware';

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function redirectTo(request: NextRequest, path: string, params?: Record<string, string>) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = '';
  Object.entries(params ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
}

/** 路由守卫（技术方案 v1.1 §4.1）：用户受保护页需登录，/admin/* 需 role=admin。 */
export async function middleware(request: NextRequest) {
  const { response, supabase, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // 登录页公开
  if (pathname === ROUTES.LOGIN || pathname === ROUTES.ADMIN_LOGIN) {
    return response;
  }

  // 管理员端：需登录且 role=admin
  if (pathname === ROUTES.ADMIN_HOME || ADMIN_ROUTES.some((r) => matchesPrefix(pathname, r))) {
    if (!user) {
      return redirectTo(request, ROUTES.ADMIN_LOGIN);
    }

    const { data } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (data?.role !== USER_ROLE.ADMIN) {
      return redirectTo(request, ROUTES.ADMIN_LOGIN, { error: MESSAGES.FORBIDDEN });
    }

    return response;
  }

  // 用户端受保护页：需登录
  if (PROTECTED_ROUTES.some((r) => matchesPrefix(pathname, r)) && !user) {
    return redirectTo(request, ROUTES.LOGIN, { redirect: pathname });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { ENV } from '@/config/env';
import { noStoreFetch } from '@/lib/supabase/fetch';

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * 刷新 Supabase 会话并返回当前用户（技术方案 v1.1 §4.1）。
 * 由 middleware.ts 调用，仅用于读取用户与回写 cookie。
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
    // 必须 no-store，否则会话校验会被 Next 的 Data Cache 冻结（见 lib/supabase/fetch.ts）
    global: { fetch: noStoreFetch },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user, response };
}

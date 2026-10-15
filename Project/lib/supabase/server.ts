import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { ENV } from '@/config/env';

type CookieToSet = { name: string; value: string; options: CookieOptions };

/** 服务端（Server Component / Route Handler / Server Action）Supabase 客户端 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component 中不允许写 cookie；会话刷新交给 middleware.ts
        }
      },
    },
  });
}

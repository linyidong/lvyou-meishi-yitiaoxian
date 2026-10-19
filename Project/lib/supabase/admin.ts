import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';
import { noStoreFetch } from '@/lib/supabase/fetch';

/**
 * 管理员客户端（service_role / secret key）。
 * ⚠️ 只能用在服务端（Route Handler / Server Action），绝不能进入前端组件。
 */
export function createAdminClient() {
  if (!ENV.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('缺少 SUPABASE_SERVICE_ROLE_KEY，请在 .env.local 中配置');
  }

  return createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    // 必须 no-store，否则查询会被 Next 的 Data Cache 冻结成永不过期的旧数据（见 lib/supabase/fetch.ts）
    global: { fetch: noStoreFetch },
  });
}

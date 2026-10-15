'use client';

import { createBrowserClient } from '@supabase/ssr';
import { ENV } from '@/config/env';

/** 浏览器端 Supabase 客户端（RSC 场景请用 lib/supabase/server.ts） */
export function createClient() {
  return createBrowserClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY);
}

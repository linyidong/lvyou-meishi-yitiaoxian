/**
 * 环境变量读取（C01-C06）
 * 只从环境变量读取，密钥绝不写入代码；变量名见根目录 .env.example。
 * 本地开发：复制 .env.example 为 .env.local 并填入真实值。
 */
export const ENV = {
  /** C01 Supabase 项目地址（前端可见） */
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  /** C02 Supabase Publishable Key（前端可见，等同旧 anon） */
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  /** C03 Supabase Secret Key（仅服务端，等同旧 service_role） */
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  /** C04 高德 Web 端(JS API) Key（前端地图） */
  AMAP_JS_KEY: process.env.NEXT_PUBLIC_AMAP_KEY!,
  /** C04b 高德 JS API 安全密钥 securityJsCode（前端地图） */
  AMAP_SECURITY_CODE: process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE!,
  /** C05 高德 Web 服务 Key（服务端搜索 / 路线规划） */
  AMAP_WEB_KEY: process.env.AMAP_WEB_SERVICE_KEY!,
  /** C06 DeepSeek API Key（服务端 AI 提取） */
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY!,
} as const;

/** 校验前端必需变量是否已配置，供地图组件在报错前给出人话提示。 */
export function assertPublicEnv(): string[] {
  const missing: string[] = [];
  if (!ENV.SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!ENV.SUPABASE_ANON_KEY) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return missing;
}

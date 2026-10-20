/**
 * 环境变量读取（C01-C06）
 * 只从环境变量读取，密钥绝不写入代码；变量名见根目录 .env.example。
 * 本地开发：复制 .env.example 为 .env.local 并填入真实值。
 */

/** 高德 Web 服务 Key 槽位（服务端）：key 用于请求，privateKey 兼容「该 Key 开启数字签名」的场景 */
export interface AmapWebKeySlot {
  key: string;
  privateKey: string;
}

/**
 * 高德 Web 服务 Key 池（服务端）。
 *
 * 支持多账号叠加额度：`AMAP_WEB_SERVICE_KEY` / `_2` / `_3` 各对应一个高德账号的「Web服务」Key，
 * 每个账号独立 15 万次/月，两个账号就是两个独立额度池（lib/amap.ts 按槽位轮询使用，
 * 只有一个 Key 时行为与单 Key 完全一致）。槽位下标即写入 public.amap_usage.key_slot 的值，
 * 管理端看板据此按账号分别展示用量。
 *
 * 注意：这里必须逐个静态引用 process.env.XXX（不能用动态键名），
 * 否则前端 / 打包阶段不会把变量内联进来。
 */
function amapWebKeySlots(): AmapWebKeySlot[] {
  const raw: [string | undefined, string | undefined][] = [
    [process.env.AMAP_WEB_SERVICE_KEY, process.env.AMAP_WEB_SERVICE_PRIVATE_KEY],
    [process.env.AMAP_WEB_SERVICE_KEY_2, process.env.AMAP_WEB_SERVICE_PRIVATE_KEY_2],
    [process.env.AMAP_WEB_SERVICE_KEY_3, process.env.AMAP_WEB_SERVICE_PRIVATE_KEY_3],
  ];
  const slots: AmapWebKeySlot[] = [];
  for (const [key, privateKey] of raw) {
    const k = (key ?? '').trim();
    if (!k) continue;
    slots.push({ key: k, privateKey: (privateKey ?? '').trim() });
  }
  return slots;
}

/**
 * 高德 JS API Key 池（前端地图）。
 * 同样支持多账号：`NEXT_PUBLIC_AMAP_KEY` / `_2` 各对应一个账号的「Web端(JS API)」Key，
 * 前端每次加载地图随机挑一个，用于分散前端地图的用量（JS API 不计入 Web 服务 15 万配额）。
 */
const amapJsKeys = [process.env.NEXT_PUBLIC_AMAP_KEY, process.env.NEXT_PUBLIC_AMAP_KEY_2]
  .map((k) => (k ?? '').trim())
  .filter((k) => k.length > 0);

const amapWebKeySlotsList = amapWebKeySlots();

export const ENV = {
  /** C01 Supabase 项目地址（前端可见） */
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  /** C02 Supabase Publishable Key（前端可见，等同旧 anon） */
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  /** C03 Supabase Secret Key（仅服务端，等同旧 service_role） */
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  /** C04 高德 Web 端(JS API) Key 池（前端地图）；只有一个时为单元素数组 */
  AMAP_JS_KEYS: amapJsKeys,
  /** C04b 高德 JS API 安全密钥 securityJsCode（前端地图，JS API 2.0 才需要） */
  AMAP_SECURITY_CODE: process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE!,
  /**
   * C05 高德 Web 服务 Key 池（服务端搜索 / 路线规划）。
   * 每个 Key 属于一个高德账号，各自独立 15 万次/月；多个 Key 叠加使用（见 lib/amap-key-pool.ts）。
   * 每个 Key 若在高德控制台开启了数字签名，必须在该槽位配好 privateKey，否则请求报 10007。
   */
  AMAP_WEB_KEYS: amapWebKeySlotsList,
  /** C06 DeepSeek API Key（服务端 AI 提取） */
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY!,
  /**
   * C07 会员订单到账提醒 Webhook（服务端）。
   * 目前接「企业微信群机器人」：在企业微信里建一个群 → 添加群机器人 → 复制 Webhook 地址填到这里。
   * 留空则关闭外发提醒（站内角标不受影响）。服务端提交新订单后 POST 一条 markdown 消息给管理员。
   */
  ORDER_NOTIFY_WECOM_WEBHOOK: process.env.ORDER_NOTIFY_WECOM_WEBHOOK ?? '',

  /**
   * 会员订单到账提醒 · 企业微信「自建应用」通道（服务端）。
   * 与上面的群机器人 Webhook 可同时启用、互不影响。四项齐全才启用：
   * 企业ID / 自建应用 Secret / 应用 AgentId / 接收人（默认 @all）。
   * 该通道的消息可通过「微信插件」送达成员的个人微信（需在企业微信后台开启微信插件）。
   */
  WECOM_CORP_ID: process.env.WECOM_CORP_ID ?? '',
  WECOM_APP_SECRET: process.env.WECOM_APP_SECRET ?? '',
  WECOM_AGENT_ID: process.env.WECOM_AGENT_ID ?? '',
  WECOM_APP_TOUSER: process.env.WECOM_APP_TOUSER ?? '@all',
} as const;

/** 校验前端必需变量是否已配置，供地图组件在报错前给出人话提示。 */
export function assertPublicEnv(): string[] {
  const missing: string[] = [];
  if (!ENV.SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!ENV.SUPABASE_ANON_KEY) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return missing;
}

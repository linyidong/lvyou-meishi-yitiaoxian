import { BUSINESS } from '@/config/business';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * T-049 全局应用设置（仅服务端）：读写 public.app_settings（迁移 032，key='global'，
 * RLS 开启无策略 = 只有 service_role 能读写）。
 * - 默认值全部取 config/business.ts，DB 缺行 / 读取失败时回退默认（fail-open，绝不阻断业务）；
 * - getAppSettings 带 30 秒进程缓存，保存后立即失效（同进程即时生效，多实例最多滞后 30 秒）；
 * - mergeAppSettings / validateSettingsPatch 为纯函数，便于单测与 API 层复用。
 * 注意：本模块只在服务端引用，禁止进入前端组件。
 * T-057：ai 段改为 { primary, fallback, ocrAction, ocrRegion }（可替换主模型 + 备用模型兜底）；
 * 读取旧结构（deepseekModel / deepseekBaseUrl）自动映射到 primary，下一次保存写新结构；
 * apiKey 仅服务端存储，对外一律走 toPublicSettings 掩码（绝不回传明文）。
 */

/** T-053：OCR 接口白名单（腾讯云通用印刷体 / 高精度版，只允许这两个值） */
export const OCR_ACTION_VALUES = ['GeneralBasicOCR', 'GeneralAccurateOCR'] as const;
export type OcrAction = (typeof OCR_ACTION_VALUES)[number];

/** T-057：单个大模型供应商配置（OpenAI 兼容 /chat/completions）；apiKey 空字符串 = 回落环境变量 */
export interface LlmProvider {
  /** 展示名，如 "DeepSeek" / "通义千问" */
  label: string;
  /** API 地址（不含 /chat/completions 路径），必须 https，禁内网（SSRF 校验见 validateLlmBaseUrl） */
  baseUrl: string;
  /** 模型名，如 deepseek-chat */
  model: string;
  /** API Key：仅服务端存储，任何对外响应只给掩码 */
  apiKey: string;
  enabled: boolean;
}

/** PATCH 入参里的 provider 松散形态：apiKey 省略/空串 = 保持不变，null = 清空回落环境变量 */
export interface LlmProviderPatch {
  label?: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string | null;
  enabled?: boolean;
}

/** ai 段 PATCH 形态（含旧结构兼容字段 deepseekModel / deepseekBaseUrl） */
export interface AiSettingsPatch {
  primary?: LlmProviderPatch;
  /** null = 清除备用模型 */
  fallback?: LlmProviderPatch | null;
  ocrAction?: OcrAction;
  ocrRegion?: string;
  /** 旧结构（T-057 前）：读取旧库行 / 旧客户端提交时自动映射到 primary */
  deepseekModel?: string;
  deepseekBaseUrl?: string;
}

export interface AppSettings {
  /** AI 模型参数（T-057：主/备双通道；T-053 接线生效：llm.ts / tencent-ocr.ts 从设置读取） */
  ai: {
    primary: LlmProvider;
    /** 备用模型：null = 未配置 */
    fallback: LlmProvider | null;
    /** 腾讯云 OCR 接口类型（X-TC-Action），白名单见 OCR_ACTION_VALUES */
    ocrAction: OcrAction;
    ocrRegion: string;
  };
  /** 业务开关 */
  flags: {
    /** 开放付费：false 时 POST /api/member/orders 返回 403 */
    billingEnabled: boolean;
    /** 图片识别：false 时 POST /api/ai/extract-image 返回 403 */
    ocrEnabled: boolean;
    /** 导入地点：false 时 POST /api/ai/extract 与 POST /api/places 返回 403 */
    importEnabled: boolean;
  };
  /** 配额数字（覆盖 config/business.ts 的同名默认值） */
  quotas: {
    /** 正常用户单日地点数上限（默认 P03） */
    freePlacesPerDay: number;
    /** 会员单日地点数上限（默认 P04） */
    memberPlacesPerDay: number;
    /** 会员每月路线数上限（默认 P02） */
    memberMonthlyRoutes: number;
    /** 每天 AI 提取地点次数上限 · 正常用户（默认 P07） */
    freeAiExtractPerDay: number;
    /** 每天 AI 提取地点次数上限 · 会员（默认 P08） */
    memberAiExtractPerDay: number;
    /** 每人每天图片识别（OCR）次数上限（默认 P09） */
    ocrDailyLimit: number;
  };
  /** 全站每月图片识别（OCR）总额度（默认 T-048 常量） */
  ocrMonthlyQuota: number;
}

/** T-057：对外（GET / PATCH 响应、客户端表单初值）的安全形态：apiKey 换成掩码，绝不回传明文 */
export interface PublicLlmProvider {
  label: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  /** 掩码后的 Key，如 sk-••••m3k9；未设置时为空串 */
  apiKeyMask: string;
  hasApiKey: boolean;
}

export type PublicAppSettings = Omit<AppSettings, 'ai'> & {
  ai: {
    primary: PublicLlmProvider;
    fallback: PublicLlmProvider | null;
    ocrAction: OcrAction;
    ocrRegion: string;
  };
};

/** app_settings 表内的固定行键 */
export const SETTINGS_KEY = 'global';

/** 进程缓存有效期（毫秒） */
const CACHE_TTL_MS = 30_000;

/** 默认值一律取 config/business.ts，不在本文件写死数字 */
export function defaultAppSettings(): AppSettings {
  return {
    ai: {
      primary: {
        label: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-chat',
        apiKey: '',
        enabled: true,
      },
      fallback: null,
      ocrAction: 'GeneralBasicOCR',
      ocrRegion: 'ap-guangzhou',
    },
    flags: { billingEnabled: BUSINESS.BILLING_ENABLED, ocrEnabled: true, importEnabled: true },
    quotas: {
      freePlacesPerDay: BUSINESS.FREE_MAX_PLACES_PER_DAY,
      memberPlacesPerDay: BUSINESS.MEMBER_MAX_PLACES_PER_DAY,
      memberMonthlyRoutes: BUSINESS.MEMBER_MONTHLY_ROUTE_LIMIT,
      freeAiExtractPerDay: BUSINESS.FREE_AI_EXTRACT_DAILY_LIMIT,
      memberAiExtractPerDay: BUSINESS.MEMBER_AI_EXTRACT_DAILY_LIMIT,
      ocrDailyLimit: BUSINESS.OCR_DAILY_LIMIT,
    },
    ocrMonthlyQuota: BUSINESS.OCR_MONTHLY_QUOTA,
  };
}

/** PATCH 入参的松散形态（各字段可缺省，只合并提交的字段） */
export interface AppSettingsPatch {
  ai?: AiSettingsPatch;
  flags?: Partial<AppSettings['flags']>;
  quotas?: Partial<AppSettings['quotas']>;
  ocrMonthlyQuota?: number;
}

/** provider 字段级合并（纯函数）：apiKey 省略/空串 = 保持，null = 清空 */
function mergeProvider(base: LlmProvider, patch: LlmProviderPatch | undefined | null): LlmProvider {
  if (!patch || typeof patch !== 'object') return base;
  const next: LlmProvider = { ...base };
  if (typeof patch.label === 'string') next.label = patch.label;
  if (typeof patch.baseUrl === 'string') next.baseUrl = patch.baseUrl;
  if (typeof patch.model === 'string') next.model = patch.model;
  if (patch.apiKey === null) next.apiKey = '';
  else if (typeof patch.apiKey === 'string' && patch.apiKey !== '') next.apiKey = patch.apiKey;
  if (typeof patch.enabled === 'boolean') next.enabled = patch.enabled;
  return next;
}

/** ai 段合并（纯函数）：新结构字段优先；旧结构 deepseekModel / deepseekBaseUrl 自动映射到 primary */
function mergeAi(base: AppSettings['ai'], patch: AiSettingsPatch | undefined | null): AppSettings['ai'] {
  if (!patch || typeof patch !== 'object') return base;
  let primary = mergeProvider(base.primary, patch.primary);
  if (typeof patch.deepseekModel === 'string' && patch.deepseekModel.trim()) {
    primary = { ...primary, model: patch.deepseekModel };
  }
  if (typeof patch.deepseekBaseUrl === 'string' && patch.deepseekBaseUrl.trim()) {
    primary = { ...primary, baseUrl: patch.deepseekBaseUrl };
  }
  let fallback = base.fallback;
  if (patch.fallback === null) {
    fallback = null;
  } else if (patch.fallback && typeof patch.fallback === 'object') {
    // 首次添加备用：从空白模板起步（默认启用）
    fallback = mergeProvider(
      base.fallback ?? { label: '', baseUrl: '', model: '', apiKey: '', enabled: true },
      patch.fallback,
    );
  }
  return {
    primary,
    fallback,
    ocrAction: patch.ocrAction ?? base.ocrAction,
    ocrRegion: patch.ocrRegion ?? base.ocrRegion,
  };
}

/** 深合并：patch 中出现的字段覆盖 base，未出现的保留 base（纯函数） */
export function mergeAppSettings(base: AppSettings, patch: AppSettingsPatch | null | undefined): AppSettings {
  if (!patch || typeof patch !== 'object') return base;
  return {
    ai: mergeAi(base.ai, patch.ai),
    flags: { ...base.flags, ...(patch.flags ?? {}) },
    quotas: { ...base.quotas, ...(patch.quotas ?? {}) },
    ocrMonthlyQuota:
      typeof patch.ocrMonthlyQuota === 'number' ? patch.ocrMonthlyQuota : base.ocrMonthlyQuota,
  };
}

/**
 * T-057：API Key 掩码（纯函数）：形如 sk-••••m3k9；
 * 过短（≤8）只出全星号，避免掩码本身泄露大半内容；空串返回空串。
 */
export function maskApiKey(key: string): string {
  const s = (key ?? '').trim();
  if (!s) return '';
  if (s.length <= 8) return '••••••••';
  const head = s.startsWith('sk-') ? 'sk-' : s.slice(0, 3);
  return `${head}••••${s.slice(-4)}`;
}

/** T-057：单个 provider 转对外安全形态（去明文、加掩码） */
function toPublicProvider(p: LlmProvider): PublicLlmProvider {
  return {
    label: p.label,
    baseUrl: p.baseUrl,
    model: p.model,
    enabled: p.enabled,
    apiKeyMask: maskApiKey(p.apiKey),
    hasApiKey: !!p.apiKey,
  };
}

/** T-057：完整设置 → 对外形态（GET / PATCH 响应与管理端页面初值统一走这里，杜绝明文 Key 出服务端） */
export function toPublicSettings(settings: AppSettings): PublicAppSettings {
  return {
    ai: {
      primary: toPublicProvider(settings.ai.primary),
      fallback: settings.ai.fallback ? toPublicProvider(settings.ai.fallback) : null,
      ocrAction: settings.ai.ocrAction,
      ocrRegion: settings.ai.ocrRegion,
    },
    flags: settings.flags,
    quotas: settings.quotas,
    ocrMonthlyQuota: settings.ocrMonthlyQuota,
  };
}

/** 数字配额字段校验范围：[min, max] 闭区间（正整数 + 合理上限，防误填把系统调死） */
const NUM_RULES: Record<string, { min: number; max: number }> = {
  'quotas.freePlacesPerDay': { min: 1, max: 100 },
  'quotas.memberPlacesPerDay': { min: 1, max: 100 },
  'quotas.memberMonthlyRoutes': { min: 1, max: 100 },
  'quotas.freeAiExtractPerDay': { min: 1, max: 100 },
  'quotas.memberAiExtractPerDay': { min: 1, max: 100 },
  'quotas.ocrDailyLimit': { min: 1, max: 1000 },
  ocrMonthlyQuota: { min: 1, max: 100000 },
};

/**
 * T-057：LLM Base URL 校验（纯函数，防 SSRF）：
 * 必须 https；禁 localhost / 127.* / 10.* / 172.16-31.* / 192.168.* / 169.254.* / *.internal；
 * 路径只允许空或 /；长度 1–200。返回 null = 合法，否则为错误信息。
 */
export function validateLlmBaseUrl(raw: unknown, field: string): string | null {
  if (typeof raw !== 'string') return `字段 ${field} 需为字符串`;
  const v = raw.trim();
  if (!v || v.length > 200) return `字段 ${field} 需为 1–200 个字符的 https 地址`;
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return `字段 ${field} 需为合法的 https 地址`;
  }
  if (url.protocol !== 'https:') return `字段 ${field} 仅支持 https 协议`;
  const host = url.hostname.toLowerCase();
  const privateErr = `字段 ${field} 不允许指向内网 / 本机地址`;
  if (host === 'localhost' || host.endsWith('.internal')) return privateErr;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) {
    return privateErr;
  }
  const m172 = host.match(/^172\.(\d{1,3})\./);
  if (m172) {
    const n = Number(m172[1]);
    if (n >= 16 && n <= 31) return privateErr;
  }
  if (url.pathname !== '' && url.pathname !== '/') return `字段 ${field} 路径必须为空或 /（不含 /chat/completions）`;
  return null;
}

/** 备用 provider 的空白模板（校验用：允许字段缺省，只校验提交的项） */
const PROVIDER_STR_MAX = 200;

/** 校验单个 provider PATCH 对象（纯函数）：返回 null = 合法 */
function validateProviderPatch(rec: Record<string, unknown>, field: string): string | null {
  const label = rec.label;
  if (label !== undefined && (typeof label !== 'string' || label.trim().length === 0 || label.trim().length > 64)) {
    return `字段 ${field}.label 需为 1–64 个字符的字符串`;
  }
  const model = rec.model;
  if (model !== undefined && (typeof model !== 'string' || model.trim().length === 0 || model.trim().length > 64)) {
    return `字段 ${field}.model 需为 1–64 个字符的字符串`;
  }
  if (rec.baseUrl !== undefined) {
    const e = validateLlmBaseUrl(rec.baseUrl, `${field}.baseUrl`);
    if (e) return e;
  }
  const apiKey = rec.apiKey;
  if (apiKey !== undefined && apiKey !== null) {
    if (typeof apiKey !== 'string' || apiKey.length > PROVIDER_STR_MAX) {
      return `字段 ${field}.apiKey 需为不超过 ${PROVIDER_STR_MAX} 个字符的字符串或 null`;
    }
  }
  const enabled = rec.enabled;
  if (enabled !== undefined && typeof enabled !== 'boolean') {
    return `字段 ${field}.enabled 需为布尔值`;
  }
  return null;
}

/**
 * 校验 PATCH 入参（纯函数，供 API 层与单测复用）：
 * 只接受已知字段；数字必须为范围内整数；字符串 1–64 字符；开关必须为布尔。
 * T-057：ai 段支持 primary / fallback（含 SSRF 校验与 apiKey 三态），兼容旧字段 deepseekModel / deepseekBaseUrl。
 * 返回 { ok: true, patch } 或 { ok: false, error }。
 */
export function validateSettingsPatch(raw: unknown): { ok: true; patch: AppSettingsPatch } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: '提交的参数不合法' };
  }
  const src = raw as Record<string, unknown>;
  const patch: AppSettingsPatch = {};

  const checkStr = (obj: Record<string, unknown>, key: string): string | null => {
    const v = obj[key];
    if (v === undefined) return null;
    if (typeof v !== 'string' || v.trim().length === 0 || v.trim().length > 64) {
      return `字段 ${key} 需为 1–64 个字符的字符串`;
    }
    return null;
  };
  const checkNum = (path: string, v: unknown): string | null => {
    if (v === undefined) return null;
    const rule = NUM_RULES[path];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < rule.min || v > rule.max) {
      return `字段 ${path} 需为 ${rule.min}–${rule.max} 之间的整数`;
    }
    return null;
  };

  // ai 组
  if (src.ai !== undefined) {
    if (typeof src.ai !== 'object' || src.ai === null || Array.isArray(src.ai)) {
      return { ok: false, error: '字段 ai 格式不正确' };
    }
    const ai = src.ai as Record<string, unknown>;
    patch.ai = {};

    // 旧结构兼容：deepseekModel / deepseekBaseUrl 映射到 primary
    const legacyModelErr = checkStr(ai, 'deepseekModel');
    if (legacyModelErr) return { ok: false, error: legacyModelErr };
    if (ai.deepseekBaseUrl !== undefined) {
      const e = validateLlmBaseUrl(ai.deepseekBaseUrl, 'deepseekBaseUrl');
      if (e) return { ok: false, error: e };
    }
    if (typeof ai.deepseekModel === 'string') patch.ai.deepseekModel = ai.deepseekModel.trim();
    if (typeof ai.deepseekBaseUrl === 'string') patch.ai.deepseekBaseUrl = ai.deepseekBaseUrl.trim();

    // 新结构：primary / fallback
    for (const which of ['primary', 'fallback'] as const) {
      const v = ai[which];
      if (v === undefined) continue;
      if (which === 'fallback' && v === null) {
        patch.ai.fallback = null;
        continue;
      }
      if (typeof v !== 'object' || v === null || Array.isArray(v)) {
        return { ok: false, error: `字段 ai.${which} 格式不正确` };
      }
      const e = validateProviderPatch(v as Record<string, unknown>, `ai.${which}`);
      if (e) return { ok: false, error: e };
      const rec = v as Record<string, unknown>;
      const p: LlmProviderPatch = {};
      if (typeof rec.label === 'string') p.label = rec.label.trim();
      if (typeof rec.baseUrl === 'string') p.baseUrl = rec.baseUrl.trim();
      if (typeof rec.model === 'string') p.model = rec.model.trim();
      if (rec.apiKey === null) p.apiKey = null;
      else if (typeof rec.apiKey === 'string') p.apiKey = rec.apiKey.trim();
      if (typeof rec.enabled === 'boolean') p.enabled = rec.enabled;
      patch.ai[which] = p;
    }

    const e = checkStr(ai, 'ocrRegion');
    if (e) return { ok: false, error: e };
    if (ai.ocrAction !== undefined) {
      const v = ai.ocrAction;
      if (typeof v !== 'string' || !(OCR_ACTION_VALUES as readonly string[]).includes(v.trim())) {
        return { ok: false, error: `字段 ocrAction 仅支持 ${OCR_ACTION_VALUES.join(' / ')}` };
      }
    }
    if (typeof ai.ocrAction === 'string') {
      patch.ai.ocrAction = ai.ocrAction.trim() as OcrAction;
    }
    if (typeof ai.ocrRegion === 'string') patch.ai.ocrRegion = ai.ocrRegion.trim();
  }

  // flags 组
  if (src.flags !== undefined) {
    if (typeof src.flags !== 'object' || src.flags === null || Array.isArray(src.flags)) {
      return { ok: false, error: '字段 flags 格式不正确' };
    }
    const flags = src.flags as Record<string, unknown>;
    patch.flags = {};
    for (const key of ['billingEnabled', 'ocrEnabled', 'importEnabled'] as const) {
      const v = flags[key];
      if (v !== undefined) {
        if (typeof v !== 'boolean') return { ok: false, error: `字段 flags.${key} 需为布尔值` };
        patch.flags[key] = v;
      }
    }
  }

  // quotas 组 + 顶层 ocrMonthlyQuota
  if (src.quotas !== undefined) {
    if (typeof src.quotas !== 'object' || src.quotas === null || Array.isArray(src.quotas)) {
      return { ok: false, error: '字段 quotas 格式不正确' };
    }
    const quotas = src.quotas as Record<string, unknown>;
    patch.quotas = {};
    for (const key of Object.keys(NUM_RULES)) {
      if (!key.startsWith('quotas.')) continue;
      const field = key.slice('quotas.'.length) as keyof AppSettings['quotas'];
      const e = checkNum(key, quotas[field]);
      if (e) return { ok: false, error: e };
      if (quotas[field] !== undefined) patch.quotas[field] = quotas[field] as number;
    }
  }
  const quotaErr = checkNum('ocrMonthlyQuota', src.ocrMonthlyQuota);
  if (quotaErr) return { ok: false, error: quotaErr };
  if (src.ocrMonthlyQuota !== undefined) patch.ocrMonthlyQuota = src.ocrMonthlyQuota as number;

  // 拒绝未知顶层字段，避免脏数据进库
  for (const key of Object.keys(src)) {
    if (!['ai', 'flags', 'quotas', 'ocrMonthlyQuota'].includes(key)) {
      return { ok: false, error: `未知字段 ${key}` };
    }
  }

  return { ok: true, patch };
}

/** 进程缓存（module 级；Next dev 热重载会重置，生产多实例各自独立，靠 TTL 收敛） */
let cache: { value: AppSettings; at: number } | null = null;

/** 读全局设置：30 秒缓存；DB 缺行 / 查询失败一律回退默认值（不缓存降级结果） */
export async function getAppSettings(): Promise<AppSettings> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('app_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle();
    if (error) throw error;
    const value = mergeAppSettings(defaultAppSettings(), (data?.value ?? null) as AppSettingsPatch);
    cache = { value, at: Date.now() };
    return value;
  } catch (err) {
    console.warn('[app-settings] 全局设置读取失败，使用默认值（降级放行）：', err);
    return defaultAppSettings();
  }
}

/** 保存全局设置：与当前值深合并后整行 upsert，成功后立即失效缓存（同进程即时生效） */
export async function saveAppSettings(patch: AppSettingsPatch): Promise<AppSettings> {
  const current = await getAppSettings();
  const merged = mergeAppSettings(current, patch);
  const admin = createAdminClient();
  const { error } = await admin.from('app_settings').upsert(
    { key: SETTINGS_KEY, value: merged, updated_at: new Date().toISOString() },
    { onConflict: 'key' },
  );
  if (error) throw error;
  cache = null;
  return merged;
}

import { BUSINESS } from '@/config/business';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * T-049 全局应用设置（仅服务端）：读写 public.app_settings（迁移 032，key='global'，
 * RLS 开启无策略 = 只有 service_role 能读写）。
 * - 默认值全部取 config/business.ts，DB 缺行 / 读取失败时回退默认（fail-open，绝不阻断业务）；
 * - getAppSettings 带 30 秒进程缓存，保存后立即失效（同进程即时生效，多实例最多滞后 30 秒）；
 * - mergeAppSettings / validateSettingsPatch 为纯函数，便于单测与 API 层复用。
 * 注意：本模块只在服务端引用，禁止进入前端组件。
 */

export interface AppSettings {
  /** AI 模型参数（本期仅持久化，接线生效见后续任务） */
  ai: {
    deepseekModel: string;
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

/** app_settings 表内的固定行键 */
export const SETTINGS_KEY = 'global';

/** 进程缓存有效期（毫秒） */
const CACHE_TTL_MS = 30_000;

/** 默认值一律取 config/business.ts，不在本文件写死数字 */
export function defaultAppSettings(): AppSettings {
  return {
    ai: { deepseekModel: 'deepseek-chat', ocrRegion: 'ap-guangzhou' },
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
  ai?: Partial<AppSettings['ai']>;
  flags?: Partial<AppSettings['flags']>;
  quotas?: Partial<AppSettings['quotas']>;
  ocrMonthlyQuota?: number;
}

/** 深合并：patch 中出现的字段覆盖 base，未出现的保留 base（纯函数） */
export function mergeAppSettings(base: AppSettings, patch: AppSettingsPatch | null | undefined): AppSettings {
  if (!patch || typeof patch !== 'object') return base;
  return {
    ai: { ...base.ai, ...(patch.ai ?? {}) },
    flags: { ...base.flags, ...(patch.flags ?? {}) },
    quotas: { ...base.quotas, ...(patch.quotas ?? {}) },
    ocrMonthlyQuota:
      typeof patch.ocrMonthlyQuota === 'number' ? patch.ocrMonthlyQuota : base.ocrMonthlyQuota,
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
 * 校验 PATCH 入参（纯函数，供 API 层与单测复用）：
 * 只接受已知字段；数字必须为范围内整数；字符串 1–64 字符；开关必须为布尔。
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
    const e = checkStr(ai, 'deepseekModel') ?? checkStr(ai, 'ocrRegion');
    if (e) return { ok: false, error: e };
    patch.ai = {};
    if (typeof ai.deepseekModel === 'string') patch.ai.deepseekModel = ai.deepseekModel.trim();
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

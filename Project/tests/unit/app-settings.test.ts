import { describe, expect, it } from 'vitest';
import { BUSINESS } from '@/config/business';
import {
  defaultAppSettings,
  maskApiKey,
  mergeAppSettings,
  toPublicSettings,
  validateLlmBaseUrl,
  validateSettingsPatch,
} from '@/lib/app-settings';

/**
 * T-049 全局设置纯函数单测：默认值对齐 config/business.ts、深合并语义、PATCH 校验范围。
 * T-057：ai 段改主/备双模型结构（旧结构自动映射）、API Key 掩码、Base URL SSRF 校验。
 * （getAppSettings / saveAppSettings 依赖 service_role 网络请求，走运行时人工实测取证。）
 */

describe('defaultAppSettings 默认值（与 config/business.ts 对齐，防漂移）', () => {
  it('配额默认值全部取自 BUSINESS', () => {
    const s = defaultAppSettings();
    expect(s.quotas.freePlacesPerDay).toBe(BUSINESS.FREE_MAX_PLACES_PER_DAY);
    expect(s.quotas.memberPlacesPerDay).toBe(BUSINESS.MEMBER_MAX_PLACES_PER_DAY);
    expect(s.quotas.memberMonthlyRoutes).toBe(BUSINESS.MEMBER_MONTHLY_ROUTE_LIMIT);
    expect(s.quotas.freeAiExtractPerDay).toBe(BUSINESS.FREE_AI_EXTRACT_DAILY_LIMIT);
    expect(s.quotas.memberAiExtractPerDay).toBe(BUSINESS.MEMBER_AI_EXTRACT_DAILY_LIMIT);
    expect(s.quotas.ocrDailyLimit).toBe(BUSINESS.OCR_DAILY_LIMIT);
    expect(s.ocrMonthlyQuota).toBe(BUSINESS.OCR_MONTHLY_QUOTA);
  });

  it('开关默认值：付费取 BILLING_ENABLED，OCR / 导入默认开', () => {
    const s = defaultAppSettings();
    expect(s.flags.billingEnabled).toBe(BUSINESS.BILLING_ENABLED);
    expect(s.flags.ocrEnabled).toBe(true);
    expect(s.flags.importEnabled).toBe(true);
  });

  it('T-057：ai 默认主模型 DeepSeek，备用为 null，OCR 保持原默认', () => {
    const s = defaultAppSettings();
    expect(s.ai.primary.label).toBe('DeepSeek');
    expect(s.ai.primary.model).toBe('deepseek-chat');
    expect(s.ai.primary.baseUrl).toBe('https://api.deepseek.com');
    expect(s.ai.primary.apiKey).toBe('');
    expect(s.ai.primary.enabled).toBe(true);
    expect(s.ai.fallback).toBeNull();
    expect(s.ai.ocrAction).toBe('GeneralBasicOCR');
    expect(s.ai.ocrRegion).toBe('ap-guangzhou');
  });
});

describe('mergeAppSettings 深合并', () => {
  it('patch 为空 / 非对象时原样返回', () => {
    const base = defaultAppSettings();
    expect(mergeAppSettings(base, null)).toBe(base);
    expect(mergeAppSettings(base, undefined)).toBe(base);
  });

  it('只覆盖提交的字段，其余保留', () => {
    const base = defaultAppSettings();
    const merged = mergeAppSettings(base, { quotas: { ocrDailyLimit: 1 } });
    expect(merged.quotas.ocrDailyLimit).toBe(1);
    expect(merged.quotas.freePlacesPerDay).toBe(base.quotas.freePlacesPerDay);
    expect(merged.flags).toEqual(base.flags);
    expect(merged.ai).toEqual(base.ai);
    expect(merged.ocrMonthlyQuota).toBe(base.ocrMonthlyQuota);
  });

  it('多组混合提交各自生效', () => {
    const base = defaultAppSettings();
    const merged = mergeAppSettings(base, {
      ai: { primary: { model: 'deepseek-reasoner' } },
      flags: { ocrEnabled: false },
      ocrMonthlyQuota: 500,
    });
    expect(merged.ai.primary.model).toBe('deepseek-reasoner');
    expect(merged.ai.primary.baseUrl).toBe(base.ai.primary.baseUrl);
    expect(merged.ai.ocrRegion).toBe(base.ai.ocrRegion);
    expect(merged.flags.ocrEnabled).toBe(false);
    expect(merged.flags.billingEnabled).toBe(base.flags.billingEnabled);
    expect(merged.ocrMonthlyQuota).toBe(500);
  });

  it('T-057：旧结构（deepseekModel / deepseekBaseUrl）自动映射到 primary', () => {
    const base = defaultAppSettings();
    // 模拟旧库行：ai 段只有旧字段
    const merged = mergeAppSettings(base, {
      ai: { deepseekModel: 'glm-4-plus', deepseekBaseUrl: 'https://open.bigmodel.cn/api/paas' },
    });
    expect(merged.ai.primary.model).toBe('glm-4-plus');
    expect(merged.ai.primary.baseUrl).toBe('https://open.bigmodel.cn/api/paas');
    expect(merged.ai.primary.label).toBe('DeepSeek');
    expect(merged.ai.fallback).toBeNull();
  });

  it('T-057：primary.apiKey 三态——省略/空串保持、null 清空、字符串覆盖', () => {
    const d = defaultAppSettings();
    const base = { ...d, ai: { ...d.ai, primary: { ...d.ai.primary, apiKey: 'sk-old' } } };
    expect(mergeAppSettings(base, { ai: { primary: {} } }).ai.primary.apiKey).toBe('sk-old');
    expect(mergeAppSettings(base, { ai: { primary: { apiKey: '' } } }).ai.primary.apiKey).toBe('sk-old');
    expect(mergeAppSettings(base, { ai: { primary: { apiKey: null } } }).ai.primary.apiKey).toBe('');
    expect(mergeAppSettings(base, { ai: { primary: { apiKey: 'sk-new' } } }).ai.primary.apiKey).toBe('sk-new');
  });

  it('T-057：fallback null 清除；首次添加从空白模板合并且默认启用', () => {
    const withFb = mergeAppSettings(defaultAppSettings(), {
      ai: { fallback: { label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode', model: 'qwen-plus' } },
    });
    expect(withFb.ai.fallback?.label).toBe('通义千问');
    expect(withFb.ai.fallback?.enabled).toBe(true);
    expect(withFb.ai.fallback?.apiKey).toBe('');
    const cleared = mergeAppSettings(withFb, { ai: { fallback: null } });
    expect(cleared.ai.fallback).toBeNull();
  });
});

describe('maskApiKey（T-057 掩码规则）', () => {
  it('sk- 前缀：保留 sk- 与末 4 位', () => {
    expect(maskApiKey('sk-abcdef123456m3k9')).toBe('sk-••••m3k9');
  });
  it('非 sk- 前缀：保留首 3 位与末 4 位', () => {
    expect(maskApiKey('abc123456789xyz')).toBe('abc••••9xyz');
  });
  it('过短（≤8）只出全星号；空串返回空串', () => {
    expect(maskApiKey('abcdefgh')).toBe('••••••••');
    expect(maskApiKey('')).toBe('');
  });
});

describe('toPublicSettings（T-057 对外形态绝不带明文 Key）', () => {
  it('primary / fallback 的 apiKey 字段被替换为 apiKeyMask + hasApiKey', () => {
    const s = mergeAppSettings(defaultAppSettings(), {
      ai: {
        primary: { apiKey: 'sk-supersecret0001' },
        fallback: { label: 'Q', baseUrl: 'https://q.example.com', model: 'm', apiKey: 'qk-abcdefghij' },
      },
    });
    const pub = toPublicSettings(s);
    const json = JSON.stringify(pub);
    expect(json).not.toContain('supersecret');
    expect(json).not.toContain('qk-abcdefghij');
    expect(json).not.toContain('"apiKey"');
    expect(pub.ai.primary.apiKeyMask).toBe('sk-••••0001');
    expect(pub.ai.primary.hasApiKey).toBe(true);
    expect(pub.ai.fallback?.hasApiKey).toBe(true);
    expect(pub.ai.fallback?.apiKeyMask).toBe('qk-••••ghij');
    const pubNone = toPublicSettings(defaultAppSettings());
    expect(pubNone.ai.primary.hasApiKey).toBe(false);
    expect(pubNone.ai.primary.apiKeyMask).toBe('');
    expect(pubNone.ai.fallback).toBeNull();
  });
});

describe('validateLlmBaseUrl（T-057 防 SSRF）', () => {
  it('合法：https + 空路径或 /', () => {
    expect(validateLlmBaseUrl('https://api.deepseek.com', 'x')).toBeNull();
    expect(validateLlmBaseUrl('https://api.deepseek.com/', 'x')).toBeNull();
    expect(validateLlmBaseUrl('https://dashscope.aliyuncs.com/compatible-mode', 'x')).not.toBeNull(); // 带路径必须拒
  });
  it('非法协议 http 被拒', () => {
    expect(validateLlmBaseUrl('http://api.deepseek.com', 'x')).not.toBeNull();
  });
  it('内网 / 本机 / .internal 全被拒', () => {
    for (const bad of [
      'https://localhost',
      'https://127.0.0.1',
      'https://10.1.2.3',
      'https://172.16.0.1',
      'https://172.31.255.255',
      'https://192.168.1.1',
      'https://169.254.169.254',
      'https://metadata.internal',
    ]) {
      expect(validateLlmBaseUrl(bad, 'x'), bad).not.toBeNull();
    }
  });
  it('172.15 与 172.32 不在保留段，放行', () => {
    expect(validateLlmBaseUrl('https://172.15.0.1', 'x')).toBeNull();
    expect(validateLlmBaseUrl('https://172.32.0.1', 'x')).toBeNull();
  });
  it('空 / 超长 / 不可解析被拒', () => {
    expect(validateLlmBaseUrl('', 'x')).not.toBeNull();
    expect(validateLlmBaseUrl('not-a-url', 'x')).not.toBeNull();
    expect(validateLlmBaseUrl(`https://a.com/${'y'.repeat(200)}`, 'x')).not.toBeNull();
  });
});

describe('validateSettingsPatch 范围校验', () => {
  it('合法 PATCH 通过并去除字符串首尾空格', () => {
    const r = validateSettingsPatch({
      ai: { primary: { model: ' deepseek-chat ' }, ocrRegion: ' ap-guangzhou ' },
      flags: { billingEnabled: false },
      quotas: { ocrDailyLimit: 1 },
      ocrMonthlyQuota: 1000,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.patch.ai?.primary?.model).toBe('deepseek-chat');
      expect(r.patch.ai?.ocrRegion).toBe('ap-guangzhou');
      expect(r.patch.flags?.billingEnabled).toBe(false);
      expect(r.patch.quotas?.ocrDailyLimit).toBe(1);
      expect(r.patch.ocrMonthlyQuota).toBe(1000);
    }
  });

  it('数字越界 / 非整数被拒', () => {
    expect(validateSettingsPatch({ quotas: { ocrDailyLimit: 0 } }).ok).toBe(false);
    expect(validateSettingsPatch({ quotas: { freePlacesPerDay: 101 } }).ok).toBe(false);
    expect(validateSettingsPatch({ quotas: { memberMonthlyRoutes: 2.5 } }).ok).toBe(false);
    expect(validateSettingsPatch({ ocrMonthlyQuota: 100001 }).ok).toBe(false);
  });

  it('开关非布尔被拒', () => {
    expect(validateSettingsPatch({ flags: { ocrEnabled: 'true' } }).ok).toBe(false);
  });

  it('字符串空 / 超长被拒', () => {
    expect(validateSettingsPatch({ ai: { primary: { model: '' } } }).ok).toBe(false);
    expect(validateSettingsPatch({ ai: { ocrRegion: 'x'.repeat(65) } }).ok).toBe(false);
  });

  it('T-057：primary / fallback baseUrl 非法（http / 内网 / 带路径）被拒', () => {
    expect(validateSettingsPatch({ ai: { primary: { baseUrl: 'http://api.deepseek.com' } } }).ok).toBe(false);
    expect(validateSettingsPatch({ ai: { primary: { baseUrl: 'https://192.168.1.10' } } }).ok).toBe(false);
    expect(validateSettingsPatch({ ai: { fallback: { baseUrl: 'https://x.com/v1' } } }).ok).toBe(false);
    expect(validateSettingsPatch({ ai: { primary: { baseUrl: 'https://api.deepseek.com' } } }).ok).toBe(true);
  });

  it('T-057：旧字段 deepseekBaseUrl 同样走 SSRF 校验', () => {
    expect(validateSettingsPatch({ ai: { deepseekBaseUrl: 'ftp://api.deepseek.com' } }).ok).toBe(false);
    expect(validateSettingsPatch({ ai: { deepseekBaseUrl: 'https://localhost' } }).ok).toBe(false);
    const ok = validateSettingsPatch({ ai: { deepseekBaseUrl: ' https://api.deepseek.com/ ' } });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.patch.ai?.deepseekBaseUrl).toBe('https://api.deepseek.com/');
  });

  it('T-057：apiKey 允许 null（清空）与字符串；fallback 允许 null（清除备用）', () => {
    expect(validateSettingsPatch({ ai: { primary: { apiKey: null } } }).ok).toBe(true);
    expect(validateSettingsPatch({ ai: { primary: { apiKey: 'sk-abc' } } }).ok).toBe(true);
    expect(validateSettingsPatch({ ai: { primary: { apiKey: 123 } } }).ok).toBe(false);
    expect(validateSettingsPatch({ ai: { fallback: null } }).ok).toBe(true);
    expect(validateSettingsPatch({ ai: { fallback: { model: 'm' } } }).ok).toBe(true);
    expect(validateSettingsPatch({ ai: { fallback: 'x' } }).ok).toBe(false);
  });

  it('T-057：primary / fallback 非对象被拒', () => {
    expect(validateSettingsPatch({ ai: { primary: 'x' } }).ok).toBe(false);
    expect(validateSettingsPatch({ ai: { fallback: [] } }).ok).toBe(false);
  });

  it('OCR 接口只允许白名单两个值', () => {
    expect(validateSettingsPatch({ ai: { ocrAction: 'GeneralAccurateOCR' } }).ok).toBe(true);
    expect(validateSettingsPatch({ ai: { ocrAction: 'GeneralOCR' } }).ok).toBe(false);
    expect(validateSettingsPatch({ ai: { ocrAction: '' } }).ok).toBe(false);
    expect(validateSettingsPatch({ ai: { ocrAction: 123 } }).ok).toBe(false);
  });

  it('未知字段被拒', () => {
    expect(validateSettingsPatch({ evil: 1 }).ok).toBe(false);
  });

  it('非对象入参被拒', () => {
    expect(validateSettingsPatch(null).ok).toBe(false);
    expect(validateSettingsPatch('x').ok).toBe(false);
    expect(validateSettingsPatch([]).ok).toBe(false);
  });
});

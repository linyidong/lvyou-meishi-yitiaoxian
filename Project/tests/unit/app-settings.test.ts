import { describe, expect, it } from 'vitest';
import { BUSINESS } from '@/config/business';
import {
  defaultAppSettings,
  mergeAppSettings,
  validateSettingsPatch,
} from '@/lib/app-settings';

/**
 * T-049 全局设置纯函数单测：默认值对齐 config/business.ts、深合并语义、PATCH 校验范围。
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
    expect(s.ai.deepseekModel).toBe('deepseek-chat');
    expect(s.ai.deepseekBaseUrl).toBe('https://api.deepseek.com');
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
      ai: { deepseekModel: 'deepseek-reasoner' },
      flags: { ocrEnabled: false },
      ocrMonthlyQuota: 500,
    });
    expect(merged.ai.deepseekModel).toBe('deepseek-reasoner');
    expect(merged.ai.ocrRegion).toBe(base.ai.ocrRegion);
    expect(merged.flags.ocrEnabled).toBe(false);
    expect(merged.flags.billingEnabled).toBe(base.flags.billingEnabled);
    expect(merged.ocrMonthlyQuota).toBe(500);
  });
});

describe('validateSettingsPatch 范围校验', () => {
  it('合法 PATCH 通过并去除字符串首尾空格', () => {
    const r = validateSettingsPatch({
      ai: { deepseekModel: ' deepseek-chat ' },
      flags: { billingEnabled: false },
      quotas: { ocrDailyLimit: 1 },
      ocrMonthlyQuota: 1000,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.patch.ai?.deepseekModel).toBe('deepseek-chat');
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
    expect(validateSettingsPatch({ ai: { deepseekModel: '' } }).ok).toBe(false);
    expect(validateSettingsPatch({ ai: { ocrRegion: 'x'.repeat(65) } }).ok).toBe(false);
  });

  // T-053：Base URL 与 OCR 接口校验
  it('Base URL 非 http(s) / 不可解析被拒', () => {
    expect(validateSettingsPatch({ ai: { deepseekBaseUrl: 'ftp://api.deepseek.com' } }).ok).toBe(false);
    expect(validateSettingsPatch({ ai: { deepseekBaseUrl: 'not-a-url' } }).ok).toBe(false);
    expect(validateSettingsPatch({ ai: { deepseekBaseUrl: '' } }).ok).toBe(false);
    const ok = validateSettingsPatch({ ai: { deepseekBaseUrl: ' https://api.deepseek.com/ ' } });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.patch.ai?.deepseekBaseUrl).toBe('https://api.deepseek.com/');
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

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CheckCircle2, Loader2, X } from 'lucide-react';
import { MESSAGES } from '@/config/messages';
import type { PublicAppSettings, PublicLlmProvider } from '@/lib/app-settings';

/**
 * T-049 设置页表单（客户端）：三组字段（AI 模型 / 业务开关 / 配额数字）。
 * T-052 分模块保存：每个卡片标题行右侧各一个保存按钮，PATCH 只提交自己那段
 * （服务端 mergeAppSettings 深合并，未提交的段保持 DB 原值），互不影响；
 * 各自显示保存中（按钮文案）/ 已保存 / 失败（toast），成功后 router.refresh() 回读 DB。
 * 初始值由服务端页面从 app_settings 读出传入，刷新后仍是 DB 持久化值。
 * T-057：AI 区改为主模型卡 + 备用模型卡（可添加/清除），每卡 [测试连接]；
 * API Key 输入框 type=password，占位只显示掩码；留空 = 保持不变，「清除 Key」= 提交 null 回落环境变量。
 */

const M = MESSAGES.ADMIN_SETTINGS;

/** 数字字段范围（与服务层 NUM_RULES 一致，仅用于提交前快速提示） */
const NUM_RANGE: Record<string, { min: number; max: number }> = {
  freePlacesPerDay: { min: 1, max: 100 },
  memberPlacesPerDay: { min: 1, max: 100 },
  memberMonthlyRoutes: { min: 1, max: 100 },
  freeAiExtractPerDay: { min: 1, max: 100 },
  memberAiExtractPerDay: { min: 1, max: 100 },
  ocrDailyLimit: { min: 1, max: 1000 },
  ocrMonthlyQuota: { min: 1, max: 100000 },
};

/** T-057：单张模型卡的编辑态（apiKeyInput 为空 = 不改动已存 Key；clearKey = 提交 null 清空） */
interface ProviderForm {
  label: string;
  baseUrl: string;
  model: string;
  apiKeyInput: string;
  clearKey: boolean;
  enabled: boolean;
}

/** 测试连接按钮状态（针对服务端已保存配置，与表单未保存改动无关） */
interface TestState {
  status: 'idle' | 'running' | 'done';
  ok?: boolean;
  ms?: number;
  error?: string;
}

interface FormState {
  primary: ProviderForm;
  /** 备用卡是否展开编辑（false 且初值有备用 = 用户点了「清除备用」，保存时提交 null） */
  fallbackPresent: boolean;
  /** 初值里是否本来就有备用模型（决定清除时提交 null 还是省略字段） */
  fallbackExisted: boolean;
  fallback: ProviderForm;
  ocrAction: string;
  ocrRegion: string;
  ocrMonthlyQuota: string;
  billingEnabled: boolean;
  ocrEnabled: boolean;
  importEnabled: boolean;
  freePlacesPerDay: string;
  memberPlacesPerDay: string;
  memberMonthlyRoutes: string;
  freeAiExtractPerDay: string;
  memberAiExtractPerDay: string;
  ocrDailyLimit: string;
}

function emptyProvider(): ProviderForm {
  return { label: '', baseUrl: '', model: '', apiKeyInput: '', clearKey: false, enabled: true };
}

function providerFromPublic(p: PublicLlmProvider): ProviderForm {
  return { label: p.label, baseUrl: p.baseUrl, model: p.model, apiKeyInput: '', clearKey: false, enabled: p.enabled };
}

function toForm(s: PublicAppSettings): FormState {
  return {
    primary: providerFromPublic(s.ai.primary),
    fallbackPresent: s.ai.fallback !== null,
    fallbackExisted: s.ai.fallback !== null,
    fallback: s.ai.fallback ? providerFromPublic(s.ai.fallback) : emptyProvider(),
    ocrAction: s.ai.ocrAction,
    ocrRegion: s.ai.ocrRegion,
    ocrMonthlyQuota: String(s.ocrMonthlyQuota),
    billingEnabled: s.flags.billingEnabled,
    ocrEnabled: s.flags.ocrEnabled,
    importEnabled: s.flags.importEnabled,
    freePlacesPerDay: String(s.quotas.freePlacesPerDay),
    memberPlacesPerDay: String(s.quotas.memberPlacesPerDay),
    memberMonthlyRoutes: String(s.quotas.memberMonthlyRoutes),
    freeAiExtractPerDay: String(s.quotas.freeAiExtractPerDay),
    memberAiExtractPerDay: String(s.quotas.memberAiExtractPerDay),
    ocrDailyLimit: String(s.quotas.ocrDailyLimit),
  };
}

/** 数字输入框（受控字符串，避免输入中途被强转） */
function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-slate-900 focus:outline-none"
      />
    </label>
  );
}

/**
 * 业务开关行（T-050 改滑动开关）：开=绿色轨道+圆钮靠右+对勾，关=灰色+靠左+叉号；
 * role=switch + aria-checked，button 原生支持 Space/Enter 触发 click，focus ring 可见。
 */
function SwitchField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-4 hover:bg-slate-50">
      <span>
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
          checked
            ? 'bg-emerald-500 focus-visible:ring-emerald-500'
            : 'bg-slate-300 focus-visible:ring-slate-400'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        >
          {checked ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <X className="h-3.5 w-3.5 text-slate-400" />
          )}
        </span>
      </button>
    </div>
  );
}

/** T-050 摘要行：只读展示「标签：供应商 · 当前值」，值与 DB 初值不一致时标「待保存」 */
function SummaryRow({
  label,
  provider,
  value,
  savedValue,
  pendingTag,
}: {
  label: string;
  provider: string;
  value: string;
  savedValue: string;
  pendingTag: string;
}) {
  const dirty = value !== savedValue;
  return (
    <p className="flex flex-wrap items-center gap-2">
      <span className="text-slate-600">{label}：</span>
      <span className="rounded-md bg-gradient-to-r from-primary-from to-primary-to px-2 py-0.5 font-mono text-xs text-white">
        {provider} · {value.trim() || '—'}
      </span>
      {dirty ? (
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
          {pendingTag}
        </span>
      ) : null}
    </p>
  );
}

/** T-052：可独立保存的模块（与各卡片一一对应） */
type Module = 'ai' | 'flags' | 'quotas';

/** T-057：单张模型卡（主/备共用）：显示名称 / Base URL / 模型名 / API Key（password）/ 启用 / 测试连接 */
function ProviderCard({
  title,
  form,
  saved,
  onChange,
  test,
  onTest,
  extra,
}: {
  title: string;
  form: ProviderForm;
  /** 服务端已保存形态（用于 Key 占位掩码；null = 尚未保存过，如刚点「添加备用模型」） */
  saved: PublicLlmProvider | null;
  onChange: (patch: Partial<ProviderForm>) => void;
  test: TestState;
  onTest: () => void;
  /** 卡片标题行右侧附加操作（如「清除备用」） */
  extra?: React.ReactNode;
}) {
  const keyPlaceholder = form.clearKey
    ? M.apiKeyClear
    : saved?.hasApiKey
      ? M.apiKeySaved(saved.apiKeyMask)
      : M.apiKeyNone;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <div className="flex items-center gap-2">
          {extra}
          <button
            type="button"
            onClick={onTest}
            disabled={test.status === 'running'}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {test.status === 'running' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {test.status === 'running' ? M.testing : M.testBtn}
          </button>
        </div>
      </div>
      {test.status === 'done' ? (
        <p
          className={`mb-3 text-xs font-medium ${test.ok ? 'text-emerald-600' : 'text-red-600'}`}
          role="status"
        >
          {test.ok ? M.testOk(test.ms ?? 0) : M.testErr(test.error ?? '')}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">{M.fieldProviderLabel}</span>
          <input
            value={form.label}
            onChange={(e) => onChange({ label: e.target.value })}
            maxLength={64}
            placeholder={M.fieldProviderLabelHint}
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-slate-900 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">{M.fieldLlmModel}</span>
          <input
            value={form.model}
            onChange={(e) => onChange({ model: e.target.value })}
            maxLength={64}
            placeholder="deepseek-chat"
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-slate-900 focus:outline-none"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs text-slate-500">{M.fieldLlmBaseUrl}</span>
          <input
            value={form.baseUrl}
            onChange={(e) => onChange({ baseUrl: e.target.value })}
            maxLength={200}
            placeholder="https://api.deepseek.com"
            className="h-10 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm focus:border-slate-900 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">{M.fieldLlmApiKey}</span>
          <div className="flex gap-2">
            <input
              type="password"
              autoComplete="new-password"
              value={form.apiKeyInput}
              onChange={(e) => onChange({ apiKeyInput: e.target.value, clearKey: false })}
              placeholder={keyPlaceholder}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-slate-900 focus:outline-none"
            />
            {saved?.hasApiKey && !form.clearKey ? (
              <button
                type="button"
                onClick={() => onChange({ clearKey: true, apiKeyInput: '' })}
                className="h-10 shrink-0 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-500 hover:bg-slate-50"
              >
                {M.apiKeyClear}
              </button>
            ) : null}
          </div>
        </label>
        <div className="flex items-end pb-1">
          <button
            type="button"
            role="switch"
            aria-checked={form.enabled}
            aria-label={`${title} ${M.fieldLlmEnabled}`}
            onClick={() => onChange({ enabled: !form.enabled })}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              form.enabled
                ? 'bg-emerald-500 focus-visible:ring-emerald-500'
                : 'bg-slate-300 focus-visible:ring-slate-400'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow transition-transform duration-200 ${
                form.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            >
              {form.enabled ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <X className="h-3.5 w-3.5 text-slate-400" />
              )}
            </span>
            <span className="sr-only">{M.fieldLlmEnabled}</span>
          </button>
          <span className="ml-2 text-xs text-slate-500">{M.fieldLlmEnabled}</span>
        </div>
      </div>
    </div>
  );
}

export function SettingsForm({ initial }: { initial: PublicAppSettings }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => toForm(initial));
  /** 当前正在保存的模块（null=空闲）；同一时刻只允许一个模块提交 */
  const [savingModule, setSavingModule] = useState<Module | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  /** T-057：两张卡各自的测试连接状态 */
  const [test, setTest] = useState<Record<'primary' | 'fallback', TestState>>({
    primary: { status: 'idle' },
    fallback: { status: 'idle' },
  });

  function showToast(kind: 'ok' | 'err', text: string) {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 2500);
  }

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function patchPrimary(p: Partial<ProviderForm>) {
    setForm((f) => ({ ...f, primary: { ...f.primary, ...p } }));
  }

  function patchFallback(p: Partial<ProviderForm>) {
    setForm((f) => ({ ...f, fallback: { ...f.fallback, ...p } }));
  }

  /** 数字字段提交前范围校验（服务端 validateSettingsPatch 仍会二次校验） */
  function validateNums(fields: [keyof typeof NUM_RANGE, string][]): string {
    for (const [key, raw] of fields) {
      const n = Number(raw);
      const rule = NUM_RANGE[key];
      if (!Number.isInteger(n) || n < rule.min || n > rule.max) {
        return `字段需为 ${rule.min}–${rule.max} 之间的整数`;
      }
    }
    return '';
  }

  /**
   * T-057：单卡 → PATCH provider 形态。
   * apiKey 三态：输入了新值 → 提交字符串；点了「清除 Key」→ 提交 null；都没动 → 省略（保持不变）。
   */
  function providerPatch(p: ProviderForm): Record<string, unknown> {
    const body: Record<string, unknown> = {
      label: p.label.trim(),
      baseUrl: p.baseUrl.trim(),
      model: p.model.trim(),
      enabled: p.enabled,
    };
    if (p.clearKey) body.apiKey = null;
    else if (p.apiKeyInput.trim()) body.apiKey = p.apiKeyInput.trim();
    return body;
  }

  /** T-057：测试连接（针对服务端已保存配置；Key 不出服务端，结果只含 ok/ms/error） */
  async function testLlm(which: 'primary' | 'fallback') {
    setTest((t) => ({ ...t, [which]: { status: 'running' } }));
    try {
      const res = await fetch('/api/admin/settings/test-llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ which }),
      });
      const data = (await res.json()) as { ok?: boolean; ms?: number; error?: string; message?: string };
      if (!res.ok && !data.error) {
        setTest((t) => ({ ...t, [which]: { status: 'done', ok: false, error: data.message || M.errTest } }));
        return;
      }
      setTest((t) => ({
        ...t,
        [which]: { status: 'done', ok: !!data.ok, ms: data.ms ?? 0, error: data.error },
      }));
    } catch {
      setTest((t) => ({ ...t, [which]: { status: 'done', ok: false, error: M.errTest } }));
    }
  }

  /**
   * 分模块保存（T-052）：每块只 PATCH 自己的段，服务端深合并后其余段保持 DB 原值。
   * 保存中显示在对应按钮上；成功 / 失败用 toast 反馈，成功后 refresh 回读持久化值。
   */
  async function saveModule(module: Module) {
    if (savingModule) return;
    let body: Record<string, unknown>;
    let okText: string;

    if (module === 'ai') {
      if (!form.primary.label.trim() || !form.primary.baseUrl.trim() || !form.primary.model.trim() || !form.ocrRegion.trim()) {
        showToast('err', M.errSave);
        return;
      }
      if (form.fallbackPresent && (!form.fallback.baseUrl.trim() || !form.fallback.model.trim())) {
        showToast('err', M.errSave);
        return;
      }
      // T-057：主/备双卡 + OCR 两项一并提交；非法 baseUrl（http / 内网）由服务端 400 拒绝
      const aiBody: Record<string, unknown> = {
        primary: providerPatch(form.primary),
        ocrAction: form.ocrAction,
        ocrRegion: form.ocrRegion.trim(),
      };
      if (form.fallbackPresent) aiBody.fallback = providerPatch(form.fallback);
      else if (form.fallbackExisted) aiBody.fallback = null; // 用户点了「清除备用」
      body = { ai: aiBody };
      okText = M.savedAiToast;
    } else if (module === 'flags') {
      body = {
        flags: {
          billingEnabled: form.billingEnabled,
          ocrEnabled: form.ocrEnabled,
          importEnabled: form.importEnabled,
        },
      };
      okText = M.savedFlagsToast;
    } else {
      const err = validateNums([
        ['freePlacesPerDay', form.freePlacesPerDay],
        ['memberPlacesPerDay', form.memberPlacesPerDay],
        ['memberMonthlyRoutes', form.memberMonthlyRoutes],
        ['freeAiExtractPerDay', form.freeAiExtractPerDay],
        ['memberAiExtractPerDay', form.memberAiExtractPerDay],
        ['ocrDailyLimit', form.ocrDailyLimit],
        ['ocrMonthlyQuota', form.ocrMonthlyQuota],
      ]);
      if (err) {
        showToast('err', err);
        return;
      }
      body = {
        quotas: {
          freePlacesPerDay: Number(form.freePlacesPerDay),
          memberPlacesPerDay: Number(form.memberPlacesPerDay),
          memberMonthlyRoutes: Number(form.memberMonthlyRoutes),
          freeAiExtractPerDay: Number(form.freeAiExtractPerDay),
          memberAiExtractPerDay: Number(form.memberAiExtractPerDay),
          ocrDailyLimit: Number(form.ocrDailyLimit),
        },
        // OCR 月额度是配额语义（T-052 归入「通用」分组），随配额段一起提交
        ocrMonthlyQuota: Number(form.ocrMonthlyQuota),
      };
      okText = M.savedQuotasToast;
    }

    setSavingModule(module);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        showToast('err', data.message || M.errSave);
        return;
      }
      // 保存成功：表单保留当前值（DB 已持久化，刷新后仍在），并让服务端组件重新取数
      showToast('ok', okText);
      router.refresh();
    } catch {
      showToast('err', M.errSave);
    } finally {
      setSavingModule(null);
    }
  }

  /** 卡片标题行右侧的模块保存按钮：本模块显示「正在保存…」，提交期间三个按钮统一禁用 */
  function saveBtn(module: Module, label: string) {
    const busy = savingModule === module;
    return (
      <button
        type="button"
        onClick={() => saveModule(module)}
        disabled={savingModule !== null}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {busy ? M.saving : label}
      </button>
    );
  }

  /** T-057：备用模型摘要文本（未配置 / label · model（已启用/未启用）） */
  function fallbackSummaryText(): string {
    if (!form.fallbackPresent) return M.summaryFallbackNone;
    const label = form.fallback.label.trim() || '—';
    return `${label} · ${form.fallback.model.trim() || '—'}（${form.fallback.enabled ? M.summaryFallbackOn : M.summaryFallbackOff}）`;
  }

  function fallbackSavedText(): string {
    if (!initial.ai.fallback) return M.summaryFallbackNone;
    const f = initial.ai.fallback;
    return `${f.label || '—'} · ${f.model || '—'}（${f.enabled ? M.summaryFallbackOn : M.summaryFallbackOff}）`;
  }

  /** 备用行摘要：「label · model（状态）」拆成 provider/value；无分隔符（未配置）时 provider 固定「备用」 */
  function splitSummary(text: string): { provider: string; value: string } {
    const i = text.indexOf(' · ');
    return i === -1 ? { provider: '备用', value: text } : { provider: text.slice(0, i), value: text.slice(i + 3) };
  }
  const fbNow = splitSummary(fallbackSummaryText());
  const fbSaved = splitSummary(fallbackSavedText());

  return (
    <div className="space-y-6">
      {/* AI 模型（T-057：主/备双卡 + 测试连接） */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">{M.groupAi}</h2>
          {saveBtn('ai', M.saveAi)}
        </div>
        {/* T-050 只读摘要：一眼看清当前生效的 AI 通道，输入改动实时同步，未保存标「待保存」 */}
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="mb-2 text-xs font-medium text-slate-500">{M.summaryTitle}</p>
          <div className="space-y-1.5 text-sm">
            {/* T-057：主/备当前模型两行；T-053：OCR 接口类型与地域仍单列 */}
            <SummaryRow
              label={M.summaryPrimaryLabel}
              provider={form.primary.label.trim() || '—'}
              value={form.primary.model}
              savedValue={initial.ai.primary.model}
              pendingTag={M.pendingSave}
            />
            <SummaryRow
              label={M.summaryFallbackLabel}
              provider={fbNow.provider}
              value={fbNow.value}
              savedValue={fbSaved.value}
              pendingTag={M.pendingSave}
            />
            <SummaryRow
              label={M.summaryOcrLabel}
              provider={M.summaryOcrProvider}
              value={form.ocrAction}
              savedValue={initial.ai.ocrAction}
              pendingTag={M.pendingSave}
            />
            <SummaryRow
              label={M.summaryOcrRegionLabel}
              provider={M.summaryOcrProvider}
              value={form.ocrRegion}
              savedValue={initial.ai.ocrRegion}
              pendingTag={M.pendingSave}
            />
          </div>
        </div>

        <div className="space-y-4">
          <ProviderCard
            title={M.cardPrimary}
            form={form.primary}
            saved={initial.ai.primary}
            onChange={patchPrimary}
            test={test.primary}
            onTest={() => testLlm('primary')}
          />
          {form.fallbackPresent ? (
            <ProviderCard
              title={M.cardFallback}
              form={form.fallback}
              saved={initial.ai.fallback}
              onChange={patchFallback}
              test={test.fallback}
              onTest={() => testLlm('fallback')}
              extra={
                <button
                  type="button"
                  onClick={() => patch('fallbackPresent', false)}
                  className="h-8 rounded-lg border border-red-200 bg-white px-3 text-xs text-red-600 hover:bg-red-50"
                >
                  {M.fallbackClear}
                </button>
              }
            />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3">
              <p className="text-xs text-slate-500">{M.fallbackNoneHint}</p>
              <button
                type="button"
                onClick={() => patch('fallbackPresent', true)}
                className="h-8 shrink-0 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {M.fallbackAdd}
              </button>
            </div>
          )}

          {/* T-052：OCR 月额度属配额语义，在下方「配额数字 · 通用」分组；本区保留 OCR 接口 / 地域两项 */}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">{M.fieldOcrAction}</span>
              <select
                value={form.ocrAction}
                onChange={(e) => patch('ocrAction', e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-slate-900 focus:outline-none"
              >
                <option value="GeneralBasicOCR">{M.ocrActionBasic}</option>
                <option value="GeneralAccurateOCR">{M.ocrActionAccurate}</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">{M.fieldOcrRegion}</span>
              <input
                value={form.ocrRegion}
                onChange={(e) => patch('ocrRegion', e.target.value)}
                maxLength={64}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-slate-900 focus:outline-none"
              />
            </label>
          </div>
        </div>
      </section>

      {/* 业务开关 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">{M.groupFlags}</h2>
          {saveBtn('flags', M.saveFlags)}
        </div>
        <div className="space-y-3">
          <SwitchField
            label={M.fieldBilling}
            hint={M.fieldBillingHint}
            checked={form.billingEnabled}
            onChange={(v) => patch('billingEnabled', v)}
          />
          <SwitchField
            label={M.fieldOcr}
            hint={M.fieldOcrHint}
            checked={form.ocrEnabled}
            onChange={(v) => patch('ocrEnabled', v)}
          />
          <SwitchField
            label={M.fieldImport}
            hint={M.fieldImportHint}
            checked={form.importEnabled}
            onChange={(v) => patch('importEnabled', v)}
          />
        </div>
      </section>

      {/* 配额数字（T-052：按身份分三组，保存按钮在卡片标题行右侧） */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">{M.groupQuotas}</h2>
          {saveBtn('quotas', M.saveQuotas)}
        </div>
        <div className="space-y-5">
          <div>
            <p className="mb-3 text-xs font-semibold text-slate-500">{M.quotaGroupFree}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumField
                label={M.fieldFreePlacesPerDay}
                value={form.freePlacesPerDay}
                onChange={(v) => patch('freePlacesPerDay', v)}
              />
              <NumField
                label={M.fieldFreeAiExtract}
                value={form.freeAiExtractPerDay}
                onChange={(v) => patch('freeAiExtractPerDay', v)}
              />
            </div>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold text-slate-500">{M.quotaGroupMember}</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <NumField
                label={M.fieldMemberPlacesPerDay}
                value={form.memberPlacesPerDay}
                onChange={(v) => patch('memberPlacesPerDay', v)}
              />
              <NumField
                label={M.fieldMemberMonthlyRoutes}
                value={form.memberMonthlyRoutes}
                onChange={(v) => patch('memberMonthlyRoutes', v)}
              />
              <NumField
                label={M.fieldMemberAiExtract}
                value={form.memberAiExtractPerDay}
                onChange={(v) => patch('memberAiExtractPerDay', v)}
              />
            </div>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold text-slate-500">{M.quotaGroupCommon}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumField
                label={M.fieldOcrDailyLimit}
                value={form.ocrDailyLimit}
                onChange={(v) => patch('ocrDailyLimit', v)}
              />
              <NumField
                label={M.fieldOcrMonthlyQuota}
                value={form.ocrMonthlyQuota}
                onChange={(v) => patch('ocrMonthlyQuota', v)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 轻量 toast：保存成功 / 失败反馈 */}
      {toast ? (
        <div
          role="status"
          className={`fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg px-4 py-2.5 text-sm shadow-lg lg:bottom-8 ${
            toast.kind === 'ok'
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.kind === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : null}
          {toast.text}
        </div>
      ) : null}
    </div>
  );
}

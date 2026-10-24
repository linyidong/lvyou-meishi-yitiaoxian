'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CheckCircle2, Loader2, X } from 'lucide-react';
import { MESSAGES } from '@/config/messages';
import type { AppSettings } from '@/lib/app-settings';

/**
 * T-049 设置页表单（客户端）：三组字段（AI 模型 / 业务开关 / 配额数字）。
 * T-052 分模块保存：每个卡片标题行右侧各一个保存按钮，PATCH 只提交自己那段
 * （服务端 mergeAppSettings 深合并，未提交的段保持 DB 原值），互不影响；
 * 各自显示保存中（按钮文案）/ 已保存 / 失败（toast），成功后 router.refresh() 回读 DB。
 * 初始值由服务端页面从 app_settings 读出传入，刷新后仍是 DB 持久化值。
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

interface FormState {
  deepseekModel: string;
  /** T-053：DeepSeek API 地址与 OCR 接口类型（下拉值即 X-TC-Action） */
  deepseekBaseUrl: string;
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

function toForm(s: AppSettings): FormState {
  return {
    deepseekModel: s.ai.deepseekModel,
    deepseekBaseUrl: s.ai.deepseekBaseUrl,
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

export function SettingsForm({ initial }: { initial: AppSettings }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => toForm(initial));
  /** 当前正在保存的模块（null=空闲）；同一时刻只允许一个模块提交 */
  const [savingModule, setSavingModule] = useState<Module | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function showToast(kind: 'ok' | 'err', text: string) {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 2500);
  }

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
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
   * 分模块保存（T-052）：每块只 PATCH 自己的段，服务端深合并后其余段保持 DB 原值。
   * 保存中显示在对应按钮上；成功 / 失败用 toast 反馈，成功后 refresh 回读持久化值。
   */
  async function saveModule(module: Module) {
    if (savingModule) return;
    let body: Record<string, unknown>;
    let okText: string;

    if (module === 'ai') {
      if (!form.deepseekModel.trim() || !form.ocrRegion.trim()) {
        showToast('err', M.errSave);
        return;
      }
      // T-053：Base URL / OCR 接口一并提交；非法值由服务端 validateSettingsPatch 返回 400
      body = {
        ai: {
          deepseekModel: form.deepseekModel.trim(),
          deepseekBaseUrl: form.deepseekBaseUrl.trim(),
          ocrAction: form.ocrAction,
          ocrRegion: form.ocrRegion.trim(),
        },
      };
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

  return (
    <div className="space-y-6">
      {/* AI 模型 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">{M.groupAi}</h2>
          {saveBtn('ai', M.saveAi)}
        </div>
        {/* T-050 只读摘要：一眼看清当前生效的 AI 通道，输入改动实时同步，未保存标「待保存」 */}
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="mb-2 text-xs font-medium text-slate-500">{M.summaryTitle}</p>
          <div className="space-y-1.5 text-sm">
            {/* T-053：摘要显示「模型 @ Base URL」与 OCR 接口类型（地域单列一行） */}
            <SummaryRow
              label={M.summaryExtractLabel}
              provider={M.summaryExtractProvider}
              value={`${form.deepseekModel} @ ${form.deepseekBaseUrl}`}
              savedValue={`${initial.ai.deepseekModel} @ ${initial.ai.deepseekBaseUrl}`}
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
        {/* T-052：OCR 月额度属配额语义，移入下方「配额数字 · 通用」分组；T-053：本卡四项（模型 / Base URL / OCR 接口 / 地域） */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">{M.fieldDeepseekModel}</span>
            <input
              value={form.deepseekModel}
              onChange={(e) => patch('deepseekModel', e.target.value)}
              maxLength={64}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-slate-900 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">{M.fieldDeepseekBaseUrl}</span>
            <input
              value={form.deepseekBaseUrl}
              onChange={(e) => patch('deepseekBaseUrl', e.target.value)}
              maxLength={200}
              placeholder="https://api.deepseek.com"
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-slate-900 focus:outline-none"
            />
          </label>
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

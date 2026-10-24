'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { MESSAGES } from '@/config/messages';
import type { AppSettings } from '@/lib/app-settings';

/**
 * T-049 设置页表单（客户端）：三组字段（AI 模型 / 业务开关 / 配额数字），
 * 保存走 PATCH /api/admin/settings（服务端二次校验范围），成功后 toast 并保留当前值；
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

/** 业务开关行 */
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
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 p-4 hover:bg-slate-50">
      <span>
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-slate-900"
      />
    </label>
  );
}

export function SettingsForm({ initial }: { initial: AppSettings }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => toForm(initial));
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function showToast(kind: 'ok' | 'err', text: string) {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 2500);
  }

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    // 提交前范围校验（服务端 validateSettingsPatch 仍会二次校验）
    const nums: [keyof typeof NUM_RANGE, string][] = [
      ['freePlacesPerDay', form.freePlacesPerDay],
      ['memberPlacesPerDay', form.memberPlacesPerDay],
      ['memberMonthlyRoutes', form.memberMonthlyRoutes],
      ['freeAiExtractPerDay', form.freeAiExtractPerDay],
      ['memberAiExtractPerDay', form.memberAiExtractPerDay],
      ['ocrDailyLimit', form.ocrDailyLimit],
      ['ocrMonthlyQuota', form.ocrMonthlyQuota],
    ];
    for (const [key, raw] of nums) {
      const n = Number(raw);
      const rule = NUM_RANGE[key];
      if (!Number.isInteger(n) || n < rule.min || n > rule.max) {
        showToast('err', `字段需为 ${rule.min}–${rule.max} 之间的整数`);
        return;
      }
    }
    if (!form.deepseekModel.trim() || !form.ocrRegion.trim()) {
      showToast('err', M.errSave);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ai: { deepseekModel: form.deepseekModel.trim(), ocrRegion: form.ocrRegion.trim() },
          flags: {
            billingEnabled: form.billingEnabled,
            ocrEnabled: form.ocrEnabled,
            importEnabled: form.importEnabled,
          },
          quotas: {
            freePlacesPerDay: Number(form.freePlacesPerDay),
            memberPlacesPerDay: Number(form.memberPlacesPerDay),
            memberMonthlyRoutes: Number(form.memberMonthlyRoutes),
            freeAiExtractPerDay: Number(form.freeAiExtractPerDay),
            memberAiExtractPerDay: Number(form.memberAiExtractPerDay),
            ocrDailyLimit: Number(form.ocrDailyLimit),
          },
          ocrMonthlyQuota: Number(form.ocrMonthlyQuota),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        showToast('err', data.message || M.errSave);
        return;
      }
      // 保存成功：表单保留当前值（DB 已持久化，刷新后仍在），并让服务端组件重新取数
      showToast('ok', M.savedToast);
      router.refresh();
    } catch {
      showToast('err', M.errSave);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* AI 模型 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">{M.groupAi}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
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
            <span className="mb-1 block text-xs text-slate-500">{M.fieldOcrRegion}</span>
            <input
              value={form.ocrRegion}
              onChange={(e) => patch('ocrRegion', e.target.value)}
              maxLength={64}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-slate-900 focus:outline-none"
            />
          </label>
          <NumField
            label={M.fieldOcrMonthlyQuota}
            value={form.ocrMonthlyQuota}
            onChange={(v) => patch('ocrMonthlyQuota', v)}
          />
        </div>
      </section>

      {/* 业务开关 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">{M.groupFlags}</h2>
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

      {/* 配额数字 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">{M.groupQuotas}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumField
            label={M.fieldFreePlacesPerDay}
            value={form.freePlacesPerDay}
            onChange={(v) => patch('freePlacesPerDay', v)}
          />
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
            label={M.fieldFreeAiExtract}
            value={form.freeAiExtractPerDay}
            onChange={(v) => patch('freeAiExtractPerDay', v)}
          />
          <NumField
            label={M.fieldMemberAiExtract}
            value={form.memberAiExtractPerDay}
            onChange={(v) => patch('memberAiExtractPerDay', v)}
          />
          <NumField
            label={M.fieldOcrDailyLimit}
            value={form.ocrDailyLimit}
            onChange={(v) => patch('ocrDailyLimit', v)}
          />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? M.saving : M.save}
        </button>
      </div>

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

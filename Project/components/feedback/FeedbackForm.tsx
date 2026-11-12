'use client';

import { useEffect, useState } from 'react';
import { CircleAlert, CircleCheck, Loader2, MessageSquarePlus } from 'lucide-react';
import { FEEDBACK_PAGES, feedbackLabel } from '@/config/feedback';
import { MESSAGES } from '@/config/messages';

const M = MESSAGES.FEEDBACK;

/** 我提交过的建议（服务端返回，字段与 API 一致） */
interface MyFeedback {
  id: string;
  page_key: string;
  feature_key: string;
  content: string;
  status: 'new' | 'read' | 'done';
  created_at: string;
}

const STATUS_LABEL: Record<MyFeedback['status'], string> = {
  new: '待处理',
  read: '已查看',
  done: '已处理',
};

const INPUT_CLS =
  'h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

/** T-098 功能建议表单：页面 → 功能 → 内容 */
export function FeedbackForm() {
  const [pageKey, setPageKey] = useState('');
  const [featureKey, setFeatureKey] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [mine, setMine] = useState<MyFeedback[]>([]);

  const page = FEEDBACK_PAGES.find((p) => p.key === pageKey);

  async function loadMine() {
    try {
      const res = await fetch('/api/feedback');
      if (!res.ok) return;
      const data = (await res.json()) as { ok?: boolean; items?: MyFeedback[] };
      if (data.ok && data.items) setMine(data.items);
    } catch {
      /* 忽略：最近提交只做展示 */
    }
  }

  useEffect(() => {
    void loadMine();
  }, []);

  async function submit() {
    const len = content.trim().length;
    // 分开提示：选择类 / 内容为空 / 内容过短，避免“都填了却报请选择”的误解
    if (!pageKey || !featureKey) {
      setNotice({ tone: 'err', text: M.selectRequired });
      return;
    }
    if (len === 0) {
      setNotice({ tone: 'err', text: M.contentRequired });
      return;
    }
    if (len < 5) {
      setNotice({ tone: 'err', text: M.tooShort(len) });
      return;
    }
    if (len > 1000) {
      setNotice({ tone: 'err', text: M.tooLong });
      return;
    }
    setSubmitting(true);
    setNotice(null);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageKey, featureKey, content: content.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setNotice({ tone: 'err', text: data.message ?? M.fail });
        return;
      }
      setNotice({ tone: 'ok', text: M.ok });
      setContent('');
      void loadMine();
    } catch {
      setNotice({ tone: 'err', text: M.fail });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-stone-200 bg-white p-5 md:p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/5 text-primary">
            <MessageSquarePlus className="h-5 w-5" />
          </span>
          <h1 className="text-xl font-bold text-stone-900">{M.title}</h1>
        </div>
        <p className="mt-3 text-sm text-stone-500">{M.desc}</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-stone-900">{M.pageLabel}</span>
            <select
              value={pageKey}
              onChange={(e) => {
                setPageKey(e.target.value);
                setFeatureKey('');
              }}
              className={`mt-1 ${INPUT_CLS}`}
            >
              <option value="">{M.pagePlaceholder}</option>
              {FEEDBACK_PAGES.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-stone-900">{M.featureLabel}</span>
            <select
              value={featureKey}
              onChange={(e) => setFeatureKey(e.target.value)}
              disabled={!page}
              className={`mt-1 ${INPUT_CLS} disabled:bg-stone-100 disabled:text-stone-400`}
            >
              <option value="">{page ? M.featurePlaceholder : '请先选择页面'}</option>
              {(page?.features ?? []).map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-4 block">
          <span className="text-sm font-semibold text-stone-900">{M.contentLabel}</span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={1000}
            rows={5}
            placeholder={M.contentPlaceholder}
            className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <span className="mt-1 flex justify-between text-xs text-stone-400">
            <span>{M.minHint}</span>
            <span>{content.trim().length}/1000</span>
          </span>
        </label>

        {notice ? (
          <p
            className={`mt-3 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
              notice.tone === 'ok'
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {notice.tone === 'ok' ? <CircleCheck className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
            {notice.text}
          </p>
        ) : null}

        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="mt-4 flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-6 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitting ? M.submitting : M.submit}
        </button>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5 md:p-6">
        <h2 className="text-sm font-semibold text-stone-900">{M.myRecent}</h2>
        {mine.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">{M.emptyMine}</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {mine.map((item) => {
              const label = feedbackLabel(item.page_key, item.feature_key);
              return (
                <li key={item.id} className="rounded-xl bg-stone-50 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                    <span className="font-semibold text-stone-700">
                      {label.page} · {label.feature}
                    </span>
                    <span>{new Date(item.created_at).toLocaleString('zh-CN')}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-stone-600">
                      {STATUS_LABEL[item.status]}
                    </span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-stone-700">{item.content}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

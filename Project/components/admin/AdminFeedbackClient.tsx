'use client';

import { useMemo, useState } from 'react';
import { CheckCheck, Loader2, MailOpen, Save } from 'lucide-react';
import { FEEDBACK_PAGES, feedbackLabel } from '@/config/feedback';
import { MESSAGES } from '@/config/messages';

const M = MESSAGES.ADMIN_FEEDBACK;

export interface AdminFeedbackItem {
  id: string;
  pageKey: string;
  featureKey: string;
  content: string;
  status: 'new' | 'read' | 'done';
  adminNote: string | null;
  createdAt: string;
  userLabel: string;
}

const STATUS_STYLE: Record<AdminFeedbackItem['status'], string> = {
  new: 'bg-rose-50 text-rose-700 border-rose-200',
  read: 'bg-amber-50 text-amber-700 border-amber-200',
  done: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const STATUS_LABEL: Record<AdminFeedbackItem['status'], string> = {
  new: M.statusNew,
  read: M.statusRead,
  done: M.statusDone,
};

/** T-098 意见箱：按页面/状态筛选，标记已读/已处理，写后台备注 */
export function AdminFeedbackClient({ items }: { items: AdminFeedbackItem[] }) {
  const [list, setList] = useState(items);
  const [page, setPage] = useState('');
  const [status, setStatus] = useState('');
  const [busyId, setBusyId] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [tip, setTip] = useState('');

  const filtered = useMemo(
    () =>
      list.filter(
        (it) => (!page || it.pageKey === page) && (!status || it.status === status),
      ),
    [list, page, status],
  );

  const counts = useMemo(() => {
    const base: Record<'new' | 'read' | 'done', number> = { new: 0, read: 0, done: 0 };
    list.forEach((it) => {
      base[it.status] += 1;
    });
    return base;
  }, [list]);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setTip('');
    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...body }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setTip(data.message ?? M.loadFailed);
        return;
      }
      setList((prev) =>
        prev.map((it) =>
          it.id === id
            ? {
                ...it,
                status: (body.status as AdminFeedbackItem['status']) ?? it.status,
                adminNote: (body.adminNote as string | undefined) ?? it.adminNote,
              }
            : it,
        ),
      );
      setTip(M.saved);
    } catch {
      setTip(M.loadFailed);
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={page}
            onChange={(e) => setPage(e.target.value)}
            className="h-10 rounded-xl border border-stone-300 bg-white px-3 text-sm"
          >
            <option value="">{M.allPages}</option>
            {FEEDBACK_PAGES.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-xl border border-stone-300 bg-white px-3 text-sm"
          >
            <option value="">{M.allStatus}</option>
            <option value="new">{M.statusNew}</option>
            <option value="read">{M.statusRead}</option>
            <option value="done">{M.statusDone}</option>
          </select>
          <span className="text-xs text-stone-500">
            {M.statusNew} {counts.new} · {M.statusRead} {counts.read} · {M.statusDone} {counts.done}
          </span>
          {tip ? <span className="ml-auto text-xs text-emerald-600">{tip}</span> : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-10 text-center text-sm text-stone-500">
          {M.empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((it) => {
            const label = feedbackLabel(it.pageKey, it.featureKey);
            const busy = busyId === it.id;
            return (
              <li key={it.id} className="rounded-2xl border border-stone-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary/5 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    {label.page} · {label.feature}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLE[it.status]}`}>
                    {STATUS_LABEL[it.status]}
                  </span>
                  <span className="text-xs text-stone-500">{it.userLabel}</span>
                  <span className="text-xs text-stone-400">
                    {new Date(it.createdAt).toLocaleString('zh-CN')}
                  </span>
                </div>

                <p className="mt-2 whitespace-pre-wrap text-sm text-stone-800">{it.content}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {it.status !== 'read' && it.status !== 'done' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => patch(it.id, { status: 'read' })}
                      className="flex h-9 items-center gap-1 rounded-lg border border-stone-300 px-3 text-xs disabled:opacity-60"
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MailOpen className="h-3.5 w-3.5" />}
                      {M.markRead}
                    </button>
                  ) : null}
                  {it.status !== 'done' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => patch(it.id, { status: 'done' })}
                      className="flex h-9 items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-xs text-emerald-700 disabled:opacity-60"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      {M.markDone}
                    </button>
                  ) : null}
                  <input
                    value={notes[it.id] ?? it.adminNote ?? ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [it.id]: e.target.value }))}
                    placeholder={M.notePlaceholder}
                    maxLength={500}
                    className="h-9 min-w-[200px] flex-1 rounded-lg border border-stone-300 px-3 text-xs"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => patch(it.id, { adminNote: notes[it.id] ?? it.adminNote ?? '' })}
                    className="flex h-9 items-center gap-1 rounded-lg bg-stone-900 px-3 text-xs text-white disabled:opacity-60"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {M.save}
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-stone-400">{M.replyHint}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

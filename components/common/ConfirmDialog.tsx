'use client';

import type { ReactNode } from 'react';

/** 轻量确认弹窗（不依赖额外 UI 依赖） */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-lg bg-background p-5 shadow-lg">
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <div className="mt-2 text-sm text-muted-foreground">{description}</div> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-1.5 text-sm"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import type { Transport } from '@/types';

/** 未登录草稿的 localStorage key（技术方案 v1.1 §4.2） */
const DRAFT_KEY = 'tfl_draft_route';

export interface RouteDraft {
  city: string;
  title: string;
  days: number;
  transport: Transport;
  /** 地点名列表（按顺序） */
  places: string[];
  updatedAt: string;
}

export function readDraft(): RouteDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RouteDraft;
  } catch {
    return null;
  }
}

export function saveDraft(draft: Omit<RouteDraft, 'updatedAt'>) {
  try {
    const payload: RouteDraft = { ...draft, updatedAt: new Date().toISOString() };
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // 隐私模式下 localStorage 不可用，忽略
  }
}

export function clearDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // 同上
  }
}

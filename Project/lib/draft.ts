'use client';

import type { PlaceType, Transport } from '@/types';

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

/* ==================== 游客试用草稿（sessionStorage，关闭标签页即归零） ====================
 * 游客试用三步（/try/new → /try/pick → /try/result）共用这一份草稿；
 * 与上面的登录用户草稿分开存放，互不影响。所有读取都必须在客户端 useEffect 里做，
 * 避免页面在服务端渲染时读到 window 报错。 */

/** 游客试用草稿的 sessionStorage key（关闭标签页即清空） */
const TRY_DRAFT_KEY = 'tfl_try_draft';

/** 试用草稿里的一个地点（只保留公共字段，不含 user_id 等任何用户信息） */
export interface TryDraftPlace {
  /** 稳定键，等于地点名（同城同名只留一条） */
  key: string;
  name: string;
  type: PlaceType;
  lat: number;
  lng: number;
  address: string | null;
  imageUrl: string | null;
}

/** 游客试用草稿（三步共用，不写库） */
export interface TryDraft {
  cityId: string;
  cityName: string;
  cityAdcode: string;
  title: string;
  days: number;
  transport: Transport;
  lodgingName: string;
  lodgingArea: string;
  /** 已挑选的地点（按挑选顺序；最终顺序在结果页按出行方式重排） */
  places: TryDraftPlace[];
  /**
   * 游客自己粘贴文案 / 链接导入的地点：游客没有账号、写不了库（RLS），
   * 因此导入结果只留在浏览器草稿里，与库内已有地点一起参与勾选与排路线。
   */
  importedPlaces?: TryDraftPlace[];
  updatedAt: string;
}

export function readTryDraft(): TryDraft | null {
  try {
    const raw = window.sessionStorage.getItem(TRY_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TryDraft;
  } catch {
    return null;
  }
}

export function saveTryDraft(draft: Omit<TryDraft, 'updatedAt'>) {
  try {
    const payload: TryDraft = { ...draft, updatedAt: new Date().toISOString() };
    window.sessionStorage.setItem(TRY_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // 隐私模式下 sessionStorage 不可用，忽略
  }
}

export function clearTryDraft() {
  try {
    window.sessionStorage.removeItem(TRY_DRAFT_KEY);
  } catch {
    // 同上
  }
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CircleAlert,
  Info,
  LoaderCircle,
  MapPinOff,
  Search,
  Sparkles,
} from 'lucide-react';
import { BUSINESS } from '@/config/business';
import { PLACE_TYPE } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { readTryDraft, saveTryDraft, type TryDraftPlace } from '@/lib/draft';
import { cn } from '@/lib/utils';
import type { PlaceType } from '@/types';

interface CityPlaceItem {
  key: string;
  name: string;
  type: PlaceType;
  lat: number;
  lng: number;
  address: string | null;
  imageUrl: string | null;
}

const INPUT_CLS =
  'h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

function rowCls(on: boolean) {
  return cn(
    'flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition',
    on ? 'border-primary bg-primary/5' : 'border-stone-200 bg-white hover:border-stone-300',
  );
}

/**
 * 游客试用第 3 步：挑地点。
 * 既能勾选「库内已有地点」，也能自己粘贴分享文案 / 链接导入地点
 * （导入结果不落库，只写浏览器 sessionStorage 草稿，与库内地点一起参与勾选与排路线）。
 */
export function TryPickClient() {
  const M = MESSAGES.TRY.PICK;
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [cityId, setCityId] = useState('');
  const [cityName, setCityName] = useState('');
  const [items, setItems] = useState<CityPlaceItem[]>([]);
  /** 游客导入的地点（来自草稿，不落库） */
  const [imported, setImported] = useState<TryDraftPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importText, setImportText] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importOk, setImportOk] = useState('');

  // 读草稿（必须在客户端 useEffect 里，避免 SSR 读到 window）
  useEffect(() => {
    const draft = readTryDraft();
    if (!draft) {
      router.replace(ROUTES.TRY_NEW);
      return;
    }
    setCityId(draft.cityId);
    setCityName(draft.cityName);
    // 默认勾上草稿里已有的地点（含导入的），回到本页时保持上次的选择
    setSelected(new Set(draft.places.map((p) => p.key)));
    setImported(draft.importedPlaces ?? []);
    setReady(true);
  }, [router]);

  const load = useCallback(async () => {
    if (!cityId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/try/city-places?cityId=${encodeURIComponent(cityId)}`);
      const data = (await res.json()) as { ok: boolean; items?: CityPlaceItem[]; message?: string };
      if (res.status === 429) {
        setError(M.rateLimited);
        setItems([]);
        return;
      }
      if (!data.ok) {
        setError(data.message ?? M.error);
        setItems([]);
        return;
      }
      setItems(data.items ?? []);
    } catch {
      setError(M.error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [cityId, M.error, M.rateLimited]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  /** 库内地点 + 导入地点（同名以库内为准），两者共用同一套勾选 */
  const importedOnly = useMemo(() => {
    const inDb = new Set(items.map((it) => it.key));
    return imported.filter((p) => !inDb.has(p.key));
  }, [items, imported]);

  const allItems = useMemo(() => [...items, ...importedOnly], [items, importedOnly]);

  const matched = useCallback(
    (it: { name: string; address?: string | null }) => {
      const kw = keyword.trim();
      if (!kw) return true;
      return it.name.includes(kw) || (it.address ?? '').includes(kw);
    },
    [keyword],
  );

  const dbFiltered = useMemo(() => items.filter(matched), [items, matched]);
  const importedFiltered = useMemo(() => importedOnly.filter(matched), [importedOnly, matched]);

  const spots = dbFiltered.filter((it) => it.type === PLACE_TYPE.ATTRACTION);
  const foods = dbFiltered.filter((it) => it.type === PLACE_TYPE.FOOD);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /** 粘贴文案 / 链接 → AI 提取 → 高德补坐标 → 写进草稿（全程不落库） */
  async function doImport() {
    const text = importText.trim();
    if (!text || importLoading || !cityName) return;

    setImportLoading(true);
    setImportError('');
    setImportOk('');
    try {
      const res = await fetch('/api/try/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, cityName }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        places?: TryDraftPlace[];
        failed?: number;
        message?: string;
      };
      if (!data.ok) {
        setImportError(data.message ?? M.importEmpty);
        return;
      }

      const list = data.places ?? [];
      if (list.length === 0) {
        setImportError(M.importEmpty);
        return;
      }

      // 已存在的地点（库内 + 之前导入的）按名称去重
      const existing = new Set(allItems.map((it) => it.key));
      const added = list.filter((p) => !existing.has(p.key));
      if (added.length === 0) {
        setImportOk(M.importDup);
        return;
      }

      const nextImported = [...imported, ...added];
      setImported(nextImported);

      // 立即写回草稿：来回切步骤（上一步 / 下一步）也不会丢导入结果
      const draft = readTryDraft();
      if (draft) saveTryDraft({ ...draft, importedPlaces: nextImported });

      // 自动勾选新导入的地点，但不超过单次可选上限
      setSelected((prev) => {
        const next = new Set(prev);
        for (const p of added) {
          if (next.size >= BUSINESS.GUEST_TRY_MAX_PLACES) break;
          next.add(p.key);
        }
        return next;
      });

      setImportText('');
      setImportOk(
        data.failed ? M.importPartial(added.length, data.failed) : M.importAdded(added.length),
      );
    } catch {
      setImportError(M.error);
    } finally {
      setImportLoading(false);
    }
  }

  function goNext() {
    const picked: TryDraftPlace[] = allItems
      .filter((it) => selected.has(it.key))
      .map((it) => ({
        key: it.key,
        name: it.name,
        type: it.type,
        lat: it.lat,
        lng: it.lng,
        address: it.address,
        imageUrl: it.imageUrl,
      }));

    if (picked.length < BUSINESS.GUEST_TRY_MIN_PLACES) {
      setError(M.minPlaces);
      return;
    }
    if (picked.length > BUSINESS.GUEST_TRY_MAX_PLACES) {
      setError(M.maxPlaces(BUSINESS.GUEST_TRY_MAX_PLACES));
      return;
    }

    const draft = readTryDraft();
    if (!draft) {
      router.replace(ROUTES.TRY_NEW);
      return;
    }
    setError('');
    saveTryDraft({ ...draft, places: picked, importedPlaces: imported });
    router.push(ROUTES.TRY_RESULT);
  }

  function renderGroup(title: string, list: CityPlaceItem[]) {
    if (list.length === 0) return null;
    return (
      <div className="mt-5">
        <h2 className="text-sm font-semibold text-stone-500">{title}</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {list.map((it) => {
            const on = selected.has(it.key);
            return (
              <button key={it.key} type="button" onClick={() => toggle(it.key)} className={rowCls(on)}>
                <span
                  className={cn(
                    'grid h-5 w-5 shrink-0 place-items-center rounded-md border-2',
                    on ? 'border-primary bg-primary text-white' : 'border-stone-300 bg-white',
                  )}
                >
                  {on ? '✓' : ''}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-stone-900">{it.name}</span>
                  <span className="block truncate text-xs text-stone-500">
                    {it.address ?? MESSAGES.ROUTE_RESULT.noAddress}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary">
          {MESSAGES.TRY.guestBadge}
        </span>
        <span className="text-xs text-stone-400">
          {MESSAGES.TRY.stepNew} · {MESSAGES.TRY.stepPick} · {MESSAGES.TRY.stepResult}
        </span>
      </div>
      <h1 className="mt-2 text-2xl font-bold text-stone-900 md:text-3xl">{M.title}</h1>
      <p className="mt-2 text-sm text-stone-500">{M.desc}</p>
      {cityName ? (
        <p className="mt-1 text-sm text-stone-500">
          {M.cityPrefix}
          <span className="font-semibold text-stone-800">{cityName}</span>
        </p>
      ) : null}

      {/* 导入地点：粘贴文案 / 链接，AI 提取后加入下方可选列表（不落库） */}
      <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 md:p-5">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
          <Sparkles className="h-4 w-4 text-primary" />
          {M.importTitle}
        </h2>
        <p className="mt-1 text-xs text-stone-500">{M.importDesc}</p>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          rows={4}
          maxLength={BUSINESS.MAX_IMPORT_TEXT_LENGTH}
          placeholder={M.importPlaceholder}
          className="mt-3 w-full resize-y rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <div className="mt-1.5 flex items-start gap-1 text-xs text-stone-500">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>{M.importTip}</span>
        </div>
        {importError ? <p className="mt-2 text-xs text-red-600">{importError}</p> : null}
        {importOk ? <p className="mt-2 text-xs text-emerald-600">{importOk}</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={importLoading || !importText.trim()}
            onClick={doImport}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-4 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importLoading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {importLoading ? M.importLoading : M.importSubmit}
          </button>
          <span className="text-xs text-stone-400">
            {importText.length} / {BUSINESS.MAX_IMPORT_TEXT_LENGTH}
          </span>
        </div>
      </div>

      <div className="relative mt-4">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={M.keywordPlaceholder}
          className={cn(INPUT_CLS, 'pl-10')}
        />
      </div>

      {error ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-10 flex flex-col items-center gap-3 text-stone-400">
          <LoaderCircle className="h-8 w-8 animate-spin" />
          <p className="text-sm">{M.loading}</p>
        </div>
      ) : allItems.length === 0 && !error ? (
        <div className="mt-10 rounded-2xl border border-dashed border-stone-300 bg-white py-16 text-center">
          <MapPinOff className="mx-auto h-10 w-10 text-stone-300" />
          <p className="mt-3 px-6 font-medium">{M.emptyGuest}</p>
          {ready ? (
            <button
              type="button"
              onClick={() => router.push(ROUTES.TRY_NEW)}
              className="mt-4 h-9 rounded-lg border border-stone-300 px-4 text-sm"
            >
              {M.back}
            </button>
          ) : null}
        </div>
      ) : (
        <>
          {renderGroup(M.importGroup, importedFiltered)}
          {renderGroup(M.groupSpot, spots)}
          {renderGroup(M.groupFood, foods)}
          {dbFiltered.length === 0 && importedFiltered.length === 0 && keyword.trim() ? (
            <p className="mt-8 text-center text-sm text-stone-400">{M.noMatch}</p>
          ) : null}
        </>
      )}

      {/* 底部选择条 */}
      <div className="sticky bottom-20 z-20 mt-8 md:bottom-4">
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-lg">
          <span className="font-semibold text-stone-900">
            {M.selected(allItems.filter((it) => selected.has(it.key)).length)}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {selected.size > 0 ? (
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="h-11 rounded-xl border border-stone-300 px-4 text-sm hover:bg-stone-50"
              >
                {M.clear}
              </button>
            ) : null}
            <Link
              href={ROUTES.TRY_NEW}
              className="flex h-11 items-center gap-1.5 rounded-xl border border-stone-300 px-4 text-sm hover:bg-stone-50"
            >
              <ArrowLeft className="h-4 w-4" />
              {M.back}
            </Link>
            <button
              type="button"
              onClick={goNext}
              className="h-11 rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-6 font-semibold text-white hover:brightness-110"
            >
              {M.next}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

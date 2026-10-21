'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bike,
  Bus,
  Camera,
  Car,
  CircleAlert,
  Footprints,
  Info,
  Loader2,
  MapPinOff,
  Route as RouteIcon,
  Sparkles,
  Utensils,
  X,
  type LucideIcon,
} from 'lucide-react';
import { BUSINESS } from '@/config/business';
import { PLACE_TYPE, PLACE_TYPE_LABEL, TRANSPORT, TRANSPORT_LABEL } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { readTryDraft, saveTryDraft, type TryDraftPlace } from '@/lib/draft';
import { cn } from '@/lib/utils';
import type { PlaceType, Transport } from '@/types';

interface CityPlaceItem {
  key: string;
  name: string;
  type: PlaceType;
  lat: number;
  lng: number;
  address: string | null;
  imageUrl: string | null;
}

/** 列表项：库内地点 or 游客导入地点（导入项带标记，展示「我导入的」角标，移除时同时从草稿里删掉） */
interface PickItem extends CityPlaceItem {
  imported: boolean;
}

type PlaceTab = 'all' | PlaceType;

const M = MESSAGES.TRY.PICK;
const RP = MESSAGES.ROUTE_PLACES;

/** 游客勾选上限（6 就是 6，不放宽）：拦截、置灰、提示文案共用同一数字 */
const GUEST_MAX_PLACES = BUSINESS.GUEST_TRY_MAX_PLACES;

/** 市内交通各方式的图标（与 TRANSPORT 取值一一对应） */
const TRANSPORT_ICON: Record<Transport, LucideIcon> = {
  [TRANSPORT.WALK]: Footprints,
  [TRANSPORT.BIKE]: Bike,
  [TRANSPORT.TRANSIT]: Bus,
  [TRANSPORT.DRIVE]: Car,
};

/** 与普通用户 U07（RoutePlacesClient）同一套筛选 / 行样式，保证两个页面视觉一致 */
const filterTabCls = (on: boolean) =>
  `px-3 py-1.5 rounded-lg text-sm ${on ? 'bg-white shadow-sm font-semibold text-stone-900' : 'text-stone-500'}`;
const pickCls = (on: boolean) =>
  `h-10 rounded-lg border text-sm flex items-center justify-center gap-1 ${
    on ? 'border-primary bg-primary/5 text-primary font-semibold' : 'border-stone-200 text-stone-600'
  }`;
const typeIconCls = (type: PlaceType) =>
  `w-10 h-10 rounded-xl grid place-items-center shrink-0 ${
    type === PLACE_TYPE.FOOD ? 'bg-amber-50 text-amber-600' : 'bg-teal-50 text-teal-600'
  }`;

/**
 * 游客试用第 2 步：挑选地点。
 *
 * 与普通用户 U07（RoutePlacesClient）保持同一套界面：页头统计 → 左侧「筛选 + 勾选列表」→
 * 右侧「路线设置（天数/交通/上限）+ 生成路线按钮」，行式为复选框 + 类型图标 + 「类型 · 地址」。
 * 差异只在游客特有部分：
 * - 页面上方多一块「导入地点」（普通用户是独立的 U06 导入页，把文案粘贴放进来方便一页走完）；
 * - 导入结果不落库，只写浏览器草稿；勾选后同样能排路线，仅保存路线需要登录。
 */
export function TryPickClient() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [cityId, setCityId] = useState('');
  const [cityName, setCityName] = useState('');
  const [items, setItems] = useState<CityPlaceItem[]>([]);
  /** 游客导入的地点（来自草稿，不落库） */
  const [imported, setImported] = useState<TryDraftPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<PlaceTab>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [genErr, setGenErr] = useState('');
  const [delTarget, setDelTarget] = useState<PickItem | null>(null);
  const [toastText, setToastText] = useState('');
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
    setLoadError('');
    try {
      const res = await fetch(`/api/try/city-places?cityId=${encodeURIComponent(cityId)}`);
      const data = (await res.json()) as { ok: boolean; items?: CityPlaceItem[]; message?: string };
      if (res.status === 429) {
        setLoadError(M.rateLimited);
        setItems([]);
        return;
      }
      if (!data.ok) {
        setLoadError(data.message ?? M.error);
        setItems([]);
        return;
      }
      setItems(data.items ?? []);
    } catch {
      setLoadError(M.error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [cityId, M.error, M.rateLimited]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  /** 库内地点 + 导入地点（同名以库内为准），两者共用同一套勾选 */
  const allItems: PickItem[] = useMemo(() => {
    const inDb = new Set(items.map((it) => it.key));
    return [
      ...items.map((it) => ({ ...it, imported: false })),
      ...imported.filter((p) => !inDb.has(p.key)).map((p) => ({ ...p, imported: true })),
    ];
  }, [items, imported]);

  const visible = useMemo(
    () => allItems.filter((it) => (tab === 'all' ? true : it.type === tab)),
    [allItems, tab],
  );

  const selectedList = useMemo(() => allItems.filter((it) => selected.has(it.key)), [allItems, selected]);
  /** 已勾满上限：未选项置灰禁用 + 列表上方常驻提示 */
  const atLimit = selected.size >= GUEST_MAX_PLACES;
  const checkedSpots = selectedList.filter((p) => p.type === PLACE_TYPE.ATTRACTION).length;
  const checkedFoods = selectedList.filter((p) => p.type === PLACE_TYPE.FOOD).length;

  /** 草稿里已有的天数 / 交通（游客固定单日 + 第 1 步选的市内交通），本页只读展示 */
  const [days, setDays] = useState(1);
  const [transport, setTransport] = useState<Transport>(TRANSPORT.WALK);
  useEffect(() => {
    const draft = readTryDraft();
    if (!draft) return;
    setDays(draft.days > 1 ? draft.days : 1);
    setTransport(draft.transport);
  }, [ready]);

  function toggle(key: string) {
    setGenErr('');
    // 双保险：勾满后拦截第 7 个并即时提示（正常情况下未选项已禁用点不到）
    if (!selected.has(key) && selected.size >= GUEST_MAX_PLACES) {
      setGenErr(M.maxPlaces(GUEST_MAX_PLACES));
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function checkAllVisible(on: boolean) {
    setGenErr('');
    setSelected((prev) => {
      const next = new Set(prev);
      if (!on) {
        visible.forEach((p) => next.delete(p.key));
        return next;
      }
      // 全选最多补到游客上限（与 doImport 自动勾选同一口径），剩余不勾
      for (const p of visible) {
        if (next.size >= GUEST_MAX_PLACES) break;
        next.add(p.key);
      }
      return next;
    });
  }

  /** 移除：导入地点既取消勾选也从草稿里删掉（不再回到列表），库内地点只取消勾选 */
  function removePlace() {
    if (!delTarget) return;
    const target = delTarget;
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(target.key);
      return next;
    });
    if (target.imported) {
      const nextImported = imported.filter((p) => p.key !== target.key);
      setImported(nextImported);
      const draft = readTryDraft();
      if (draft) saveTryDraft({ ...draft, importedPlaces: nextImported });
    }
    setDelTarget(null);
    setToastText(RP.toastRemoved(target.name));
    setTimeout(() => setToastText(''), 2600);
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

  /** 生成路线：先校验档位上限，再把勾选结果写进草稿，进结果页按顺路顺序排 */
  function generate() {
    if (selectedList.length < BUSINESS.GUEST_TRY_MIN_PLACES) {
      setGenErr(M.minPlaces);
      return;
    }
    if (selectedList.length > BUSINESS.GUEST_TRY_MAX_PLACES) {
      setGenErr(M.maxPlaces(BUSINESS.GUEST_TRY_MAX_PLACES));
      return;
    }

    const draft = readTryDraft();
    if (!draft) {
      router.replace(ROUTES.TRY_NEW);
      return;
    }
    setGenErr('');
    saveTryDraft({
      ...draft,
      places: selectedList.map((it) => ({
        key: it.key,
        name: it.name,
        type: it.type,
        lat: it.lat,
        lng: it.lng,
        address: it.address,
        imageUrl: it.imageUrl,
      })),
      importedPlaces: imported,
    });
    router.push(ROUTES.TRY_RESULT);
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary">
          {MESSAGES.TRY.guestBadge}
        </span>
        <span className="text-xs text-stone-400">
          {MESSAGES.TRY.stepNew} · {MESSAGES.TRY.stepPick} · {MESSAGES.TRY.stepResult}
        </span>
      </div>

      {/* 页头（与普通用户 U07 同构：城市 + 统计 + 返回上一步） */}
      <div className="mt-2 flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-bold text-stone-900 md:text-2xl">
            {cityName || RP.noCity} {M.titleSuffix}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {allItems.length > 0 && !loadError
              ? RP.sum(allItems.length, selectedList.length, checkedSpots, checkedFoods)
              : M.desc}
          </p>
        </div>
        <Link
          href={ROUTES.TRY_NEW}
          className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 text-sm font-medium hover:bg-stone-50"
        >
          <ArrowLeft className="h-4 w-4" />
          {M.back}
        </Link>
      </div>

      {/* 导入地点（普通用户是独立的 U06 导入页，游客合并到本页；不落库） */}
      <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4 md:p-5">
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
              <Loader2 className="h-4 w-4 animate-spin" />
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

      {/* 勾选地点 + 路线设置（与普通用户 U07 同构） */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-stone-200 bg-white lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 p-4">
            <div className="flex rounded-xl bg-stone-100 p-1">
              {(
                [
                  ['all', RP.tabAll],
                  [PLACE_TYPE.ATTRACTION, PLACE_TYPE_LABEL[PLACE_TYPE.ATTRACTION]],
                  [PLACE_TYPE.FOOD, PLACE_TYPE_LABEL[PLACE_TYPE.FOOD]],
                ] as const
              ).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setTab(value)} className={filterTabCls(tab === value)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-3 text-sm">
              {/* T-015：上限提示常驻为 tabs 行右侧橙色 pill，勾满时高亮（拦截逻辑不变） */}
              <span
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium',
                  atLimit
                    ? 'border-orange-300 bg-orange-100 text-orange-800 shadow-sm'
                    : 'border-amber-200 bg-amber-50 text-amber-700',
                )}
              >
                {M.limitGuest}
              </span>
              <button type="button" onClick={() => checkAllVisible(true)} className="text-primary hover:underline">
                {RP.checkAll}
              </button>
              <button type="button" onClick={() => checkAllVisible(false)} className="text-stone-500 hover:underline">
                {RP.checkNone}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center gap-3 p-12 text-stone-400">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">{M.loading}</p>
            </div>
          ) : loadError ? (
            <div className="p-10 text-center">
              <CircleAlert className="mx-auto h-10 w-10 text-red-400" />
              <p className="mt-3 text-sm text-red-600">{loadError}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-4 h-9 rounded-lg bg-gradient-to-r from-primary-from to-primary-to px-4 text-sm font-semibold text-white hover:brightness-110"
              >
                {M.retry}
              </button>
            </div>
          ) : allItems.length === 0 ? (
            <div className="p-10 text-center">
              <MapPinOff className="mx-auto h-10 w-10 text-stone-300" />
              <p className="mt-3 px-6 text-sm text-stone-500">{M.emptyGuest}</p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-stone-100">
                {visible.map((p) => {
                  const on = selected.has(p.key);
                  /** 勾满后未选项置灰禁用（行样式 + checkbox disabled） */
                  const locked = !on && atLimit;
                  return (
                    <li
                      key={p.key}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3',
                        locked ? 'opacity-50' : 'hover:bg-stone-50',
                      )}
                    >
                      <label
                        className={cn(
                          'flex min-w-0 flex-1 items-center gap-3',
                          locked ? 'cursor-not-allowed' : 'cursor-pointer',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={locked}
                          onChange={() => toggle(p.key)}
                          className="h-5 w-5 shrink-0 accent-primary"
                        />
                        <span className={typeIconCls(p.type)}>
                          {p.type === PLACE_TYPE.FOOD ? (
                            <Utensils className="h-5 w-5" />
                          ) : (
                            <Camera className="h-5 w-5" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className={cn('truncate font-medium', on ? 'text-stone-900' : 'text-stone-400')}>
                              {p.name}
                            </span>
                            {p.imported ? (
                              <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                {M.importGroup}
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block text-xs text-stone-500">
                            {PLACE_TYPE_LABEL[p.type]} · {p.address ?? RP.noAddress}
                          </span>
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setDelTarget(p)}
                        aria-label={RP.delConfirm}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
              {visible.length === 0 ? (
                <div className="p-10 text-center text-sm text-stone-500">{RP.filterEmpty}</div>
              ) : null}
            </>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <h3 className="font-semibold">{RP.settingsTitle}</h3>
            <p className="mt-3 text-xs font-medium text-stone-500">{RP.daysLabel}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" disabled className={pickCls(days === 1)}>
                {RP.single}
              </button>
              <button type="button" disabled className={pickCls(days > 1)}>
                {RP.many}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-stone-400">{MESSAGES.TRY.NEW.daysGuestHint}</p>
            <p className="mt-1 text-[11px] text-stone-400">{M.limitGuest}</p>
            <p className="mt-4 text-xs font-medium text-stone-500">{RP.transportLabel}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {Object.values(TRANSPORT).map((m) => {
                const Icon = TRANSPORT_ICON[m];
                return (
                  <button key={m} type="button" disabled className={pickCls(transport === m)}>
                    <Icon className="h-4 w-4" />
                    {TRANSPORT_LABEL[m]}
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-xs font-medium text-stone-500">{RP.startLabel}</p>
            <p className="mt-1 text-[11px] text-stone-400">{M.startAuto}</p>
            {genErr ? (
              <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{genErr}</div>
            ) : null}
            <button
              type="button"
              onClick={generate}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-from to-primary-to font-semibold text-white hover:brightness-110"
            >
              <RouteIcon className="h-5 w-5" />
              <span>{RP.generateCount(selectedList.length)}</span>
            </button>
          </div>
        </aside>
      </div>

      {delTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6">
            <h3 className="text-lg font-semibold">{RP.delTitle}</h3>
            <p className="mt-2 text-sm text-stone-600">
              {RP.delPre}
              <span>{delTarget.name}</span>
              {RP.delPost}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDelTarget(null)}
                className="h-11 rounded-xl border border-stone-300 text-sm"
              >
                {RP.delCancel}
              </button>
              <button
                type="button"
                onClick={removePlace}
                className="h-11 rounded-xl bg-red-600 text-sm font-semibold text-white"
              >
                {RP.delConfirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toastText ? (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-xl bg-foreground px-4 py-2.5 text-sm text-white shadow-lg">
          {toastText}
        </div>
      ) : null}
    </div>
  );
}

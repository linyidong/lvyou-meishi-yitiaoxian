'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BadgeCheck,
  Bookmark,
  Bot,
  Camera,
  Check,
  CheckCheck,
  Lightbulb,
  ListChecks,
  ListPlus,
  Loader2,
  MapPin,
  MapPinPlus,
  Plus,
  Sparkles,
  SquarePen,
  Trash2,
  Undo2,
  Utensils,
} from 'lucide-react';
import { BUSINESS } from '@/config/business';
import { PLACE_TYPE, PLACE_TYPE_LABEL } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import type { PlaceType } from '@/types';

/** 当前城市里已有的收藏地点 */
export interface CityPlaceOption {
  id: string;
  name: string;
  type: PlaceType;
  address: string | null;
}

interface Candidate {
  key: string;
  name: string;
  type: PlaceType;
  checked: boolean;
  /** 由手动添加而来 */
  manual?: boolean;
}

type PlaceTab = 'all' | PlaceType;
type ImportTab = 'text' | 'link';
/** 导入卡状态：normal 输入 / loading 识别中 / success 候选确认 / empty 未识别 / error 失败 */
type Status = 'normal' | 'loading' | 'success' | 'empty' | 'error';
type Toast = { text: string; tone: 'ok' | 'info' | 'err' };

const M = MESSAGES.ROUTE_ADD;

const cardCls = 'rounded-2xl bg-white border border-stone-200 p-5 md:p-6';
const gradBtnCls =
  'bg-gradient-to-r from-primary-from to-primary-to hover:brightness-110 text-white font-semibold';
const softBtnCls =
  'border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary font-semibold';
const segTabCls = (on: boolean) =>
  `flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-semibold ${
    on ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'
  }`;
const typeIconCls = (type: PlaceType) =>
  type === PLACE_TYPE.FOOD ? 'bg-amber-50 text-amber-600' : 'bg-teal-50 text-teal-600';
const typeBadgeCls = (type: PlaceType) =>
  `text-[11px] px-2 py-0.5 rounded-full ${
    type === PLACE_TYPE.FOOD ? 'bg-amber-50 text-amber-700' : 'bg-teal-50 text-teal-700'
  }`;

/**
 * U06 添加地点（六步流程第 3 步）：左侧「当前城市收藏」「导入文案」，右侧小贴士。
 * AI 提取结果经确认后由 /api/places 落库，随后进入 U07 勾选。
 */
export function RouteAddClient({
  routeId,
  cityName,
  cityId,
  cityPlaces,
  addedPlaceIds,
}: {
  routeId: string;
  cityName: string | null;
  cityId: string | null;
  cityPlaces: CityPlaceOption[];
  /** 已经在当前路线中的 place_id */
  addedPlaceIds: string[];
}) {
  const router = useRouter();

  const [favTab, setFavTab] = useState<PlaceTab>('all');
  const [addedSet, setAddedSet] = useState<Set<string>>(() => new Set(addedPlaceIds));
  const [busyId, setBusyId] = useState<string | null>(null);

  const [importTab, setImportTab] = useState<ImportTab>('text');
  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>('normal');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [manualName, setManualName] = useState('');
  const [manualType, setManualType] = useState<PlaceType>(PLACE_TYPE.ATTRACTION);
  const [manualErr, setManualErr] = useState('');
  const [inputErr, setInputErr] = useState('');
  const [needText, setNeedText] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const tooLong = text.length > BUSINESS.MAX_IMPORT_TEXT_LENGTH;
  const importedCount = addedSet.size;
  const spotCount = cityPlaces.filter((p) => p.type === PLACE_TYPE.ATTRACTION).length;
  const foodCount = cityPlaces.filter((p) => p.type === PLACE_TYPE.FOOD).length;

  const visibleFav = useMemo(
    () => cityPlaces.filter((p) => (favTab === 'all' ? true : p.type === favTab)),
    [cityPlaces, favTab],
  );

  const importedNames = useMemo(
    () => cityPlaces.filter((p) => addedSet.has(p.id)).map((p) => p.name),
    [cityPlaces, addedSet],
  );

  const selectableCandidates = candidates.filter(
    (c) => c.checked && c.name.trim().length >= 2 && !importedNames.includes(c.name),
  );

  function showToast(text2: string, tone: Toast['tone'] = 'info') {
    setToast({ text: text2, tone });
    setTimeout(() => setToast(null), 2600);
  }

  function switchTab(next: ImportTab) {
    setImportTab(next);
  }

  function onInput(value: string) {
    setText(value);
    setInputErr(value.length > BUSINESS.MAX_IMPORT_TEXT_LENGTH ? MESSAGES.IMPORT_TEXT_TOO_LONG : '');
    setNeedText(false);
  }

  function fillSample(index: number) {
    setText(M.samples[index].value);
    switchTab(index === 1 || index === 2 ? 'link' : 'text');
    setInputErr('');
    setNeedText(false);
  }

  async function addToRoute(placeId: string, placeName: string) {
    setBusyId(placeId);
    try {
      const res = await fetch('/api/collected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId, routeId }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!data.ok) {
        showToast(data.message ?? MESSAGES.NETWORK_ERROR, 'err');
        return;
      }
      setAddedSet((prev) => new Set(prev).add(placeId));
      showToast(M.toastAdded(placeName), 'ok');
    } catch {
      showToast(MESSAGES.NETWORK_ERROR, 'err');
    } finally {
      setBusyId(null);
    }
  }

  async function addAllFav() {
    const pending = cityPlaces.filter((p) => !addedSet.has(p.id));
    if (pending.length === 0) {
      showToast(cityPlaces.length === 0 ? M.toastFavNone : M.toastFavAllAlready, 'info');
      return;
    }
    let added = 0;
    let skipped = 0;
    for (const place of pending) {
      try {
        const res = await fetch('/api/collected', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ placeId: place.id, routeId }),
        });
        const data = (await res.json()) as { ok: boolean };
        if (data.ok) {
          added += 1;
          setAddedSet((prev) => new Set(prev).add(place.id));
        } else {
          skipped += 1;
        }
      } catch {
        skipped += 1;
      }
    }
    showToast(M.toastFavAll(added, skipped), added > 0 ? 'ok' : 'info');
  }

  function backToInput() {
    setStatus('normal');
    if (typeof document !== 'undefined') {
      document.getElementById('import-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  async function extract() {
    const value = text.trim();
    if (!value) {
      setStatus('normal');
      setInputErr(M.emptyInput);
      return;
    }
    // 「几乎只有链接」时不拦，交给服务端跟随后抓正文（小红书 / 抖音短链）
    const linkOnly = /https?:\/\//.test(value) && value.replace(/https?:\/\/\S+/g, '').replace(/[\s\p{P}\p{S}]/gu, '').length < 6;
    if (!linkOnly && tooLong) {
      setStatus('normal');
      setInputErr(MESSAGES.IMPORT_TEXT_TOO_LONG);
      return;
    }
    setInputErr('');
    setNeedText(false);
    setStatus('loading');
    try {
      const res = await fetch('/api/ai/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        places?: { name: string; type: PlaceType }[];
        error?: string;
      };
      if (!data.ok) {
        // 链接读不到内容：回退到「请补充分享文案」提示，文案方式照常可用
        if (data.error === MESSAGES.LINK_NEED_TEXT) {
          setStatus('normal');
          setNeedText(true);
          return;
        }
        setStatus('error');
        return;
      }
      const places = data.places ?? [];
      if (places.length === 0) {
        setCandidates([]);
        setStatus('empty');
        return;
      }
      setCandidates(
        places.map((p, i) => ({
          key: `${i}-${p.name}`,
          name: p.name,
          type: p.type,
          checked: true,
        })),
      );
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }

  function manualOnly() {
    setCandidates([]);
    setStatus('success');
    if (typeof document !== 'undefined') {
      document.getElementById('manual-name')?.focus();
    }
  }

  function toggleKeep(key: string) {
    setCandidates((prev) => prev.map((c) => (c.key === key ? { ...c, checked: !c.checked } : c)));
  }

  function rename(key: string, value: string) {
    const next = value.trim();
    if (!next) {
      showToast(M.renameEmpty, 'err');
      return;
    }
    setCandidates((prev) => prev.map((c) => (c.key === key ? { ...c, name: next } : c)));
  }

  function retype(key: string, type: PlaceType) {
    setCandidates((prev) => prev.map((c) => (c.key === key ? { ...c, type } : c)));
  }

  function removeCand(key: string) {
    setCandidates((prev) => prev.filter((c) => c.key !== key));
  }

  function addManual() {
    const name = manualName.trim();
    if (name.length < 2) {
      setManualErr(M.manualNameTooShort);
      return;
    }
    if (
      candidates.some((c) => c.name === name) ||
      importedNames.includes(name)
    ) {
      setManualErr(M.manualDuplicate(name));
      return;
    }
    setManualErr('');
    setCandidates((prev) => [
      ...prev,
      { key: `manual-${Date.now()}`, name, type: manualType, checked: true, manual: true },
    ]);
    setManualName('');
  }

  async function confirmAdd() {
    const adds = selectableCandidates;
    if (adds.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeId,
          cityId,
          rawText: text.trim() || undefined,
          items: adds.map((c) => ({ name: c.name.trim(), type: c.type })),
        }),
      });
      const data = (await res.json()) as { ok: boolean; inserted?: number; message?: string };
      if (!data.ok) {
        showToast(data.message ?? MESSAGES.NETWORK_ERROR, 'err');
        return;
      }
      router.push(ROUTES.ROUTE_PLACES(routeId));
    } catch {
      showToast(MESSAGES.NETWORK_ERROR, 'err');
    } finally {
      setSubmitting(false);
    }
  }

  const favBody = (() => {
    if (cityPlaces.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-stone-300 p-6 text-center">
          <span className="w-14 h-14 mx-auto rounded-2xl bg-primary/5 text-primary grid place-items-center">
            <Bookmark className="h-7 w-7" />
          </span>
          <p className="mt-3 font-semibold text-stone-800">{M.favEmptyTitle}</p>
          <p className="mt-1 text-sm text-stone-500">{M.favEmptyDesc}</p>
          <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={backToInput}
              className={`h-10 px-5 rounded-xl text-sm flex items-center justify-center gap-1.5 ${gradBtnCls}`}
            >
              <Sparkles className="h-4 w-4" />
              {M.favEmptyImport}
            </button>
            <Link
              href={ROUTES.COLLECTED}
              className="h-10 px-5 rounded-xl border border-stone-300 hover:bg-stone-50 text-sm font-medium flex items-center justify-center gap-1.5"
            >
              <Bookmark className="h-4 w-4" />
              {M.favEmptyGo}
            </Link>
          </div>
        </div>
      );
    }
    if (visibleFav.length === 0) {
      return <p className="text-sm text-stone-500 py-6 text-center">{M.favEmptyFilter}</p>;
    }
    return (
      <div className="space-y-2">
        {visibleFav.map((p) => {
          const added = addedSet.has(p.id);
          return (
            <div
              key={p.id}
              className="flex flex-wrap md:flex-nowrap items-center gap-3 p-3 rounded-xl border border-stone-200 bg-white"
            >
              <span
                className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${typeIconCls(p.type)}`}
              >
                {p.type === PLACE_TYPE.FOOD ? (
                  <Utensils className="h-5 w-5" />
                ) : (
                  <Camera className="h-5 w-5" />
                )}
              </span>
              <div className="flex-1 min-w-[160px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-stone-900">{p.name}</span>
                  <span className={typeBadgeCls(p.type)}>{PLACE_TYPE_LABEL[p.type]}</span>
                  {added ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                      {M.favInRoute}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-stone-500 flex flex-wrap gap-x-3 gap-y-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {p.address ?? M.noAddress}
                  </span>
                </p>
              </div>
              <button
                type="button"
                disabled={busyId === p.id}
                onClick={() => addToRoute(p.id, p.name)}
                className={`h-9 px-4 rounded-xl text-sm font-medium flex items-center gap-1.5 shrink-0 disabled:opacity-50 ${
                  added
                    ? 'border border-stone-300 text-stone-500 hover:bg-stone-50'
                    : gradBtnCls
                }`}
              >
                {added ? <Check className="h-4 w-4" /> : <MapPinPlus className="h-4 w-4" />}
                {added ? M.favInRouteBtn : M.favAddOne}
              </button>
            </div>
          );
        })}
      </div>
    );
  })();

  const importCard = (
    <section
      id="import-card"
      className="mt-6 rounded-2xl bg-white border border-stone-200 p-5 md:p-6"
      data-state="normal"
    >
      <div className="flex bg-stone-100 rounded-xl p-1 w-full sm:w-fit">
        <button type="button" onClick={() => switchTab('text')} className={segTabCls(importTab === 'text')}>
          {M.tabText}
        </button>
        <button type="button" onClick={() => switchTab('link')} className={segTabCls(importTab === 'link')}>
          {M.tabLink}
        </button>
      </div>
      {importTab === 'link' ? (
        <div className="mt-4 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 text-sm px-4 py-3">
          {M.linkTip}
        </div>
      ) : null}
      <textarea
        value={text}
        onChange={(e) => onInput(e.target.value)}
        rows={8}
        placeholder={importTab === 'link' ? M.placeholderLink : M.placeholderText}
        className="mt-4 w-full rounded-xl border border-stone-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none p-4 text-sm leading-relaxed resize-y"
      />
      <div className="mt-1 flex items-center justify-between text-xs">
        <p className="text-red-600">{inputErr}</p>
        <span className={tooLong ? 'text-red-600' : 'text-stone-400'}>
          {text.length} / {BUSINESS.MAX_IMPORT_TEXT_LENGTH}
        </span>
      </div>
      {needText ? (
        <div className="mt-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-sm px-4 py-3">
          <p className="font-semibold flex items-center gap-1.5">
            <SquarePen className="h-4 w-4" />
            {M.needTextTitle}
          </p>
          <p className="mt-1">{M.needTextDesc}</p>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="text-stone-400 py-1.5">{M.sampleLabel}</span>
        {M.samples.map((sample, index) => (
          <button
            key={sample.label}
            type="button"
            onClick={() => fillSample(index)}
            className={
              index === 0
                ? 'px-3 py-1.5 rounded-full bg-primary/5 text-primary hover:bg-primary/10'
                : 'px-3 py-1.5 rounded-full bg-stone-100 text-stone-700 hover:bg-stone-200'
            }
          >
            {sample.label}
          </button>
        ))}
      </div>
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={extract}
          className={`h-11 px-6 rounded-xl text-sm flex items-center justify-center gap-2 ${gradBtnCls}`}
        >
          <Sparkles className="h-4 w-4" />
          {M.extract}
        </button>
        <button
          type="button"
          onClick={manualOnly}
          className="h-11 px-6 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-700 text-sm font-medium flex items-center justify-center gap-2"
        >
          <SquarePen className="h-4 w-4" />
          {M.manual}
        </button>
      </div>
      <div className="mt-5 pt-4 border-t border-dashed border-stone-200 flex flex-wrap items-center gap-3">
        <p className="text-xs text-stone-500 flex items-center gap-1.5">
          <ListChecks className="h-4 w-4 text-stone-400" />
          {M.importedPre} <span className="font-semibold text-stone-700">{importedCount}</span>{' '}
          {M.importedPost}
        </p>
        <Link
          href={ROUTES.ROUTE_PLACES(routeId)}
          className={`ml-auto h-10 px-4 rounded-xl text-sm flex items-center gap-1.5 ${softBtnCls}`}
        >
          <CheckCheck className="h-4 w-4" />
          {M.goSelect}
        </Link>
      </div>
    </section>
  );

  const loadingBlock = (
    <section className="rounded-2xl bg-white border border-stone-200 p-6" data-state="loading">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-primary/5 text-primary grid place-items-center">
          <Sparkles className="h-5 w-5 animate-pulse" />
        </span>
        <div>
          <p className="font-semibold">{M.loadingTitle}</p>
          <p className="text-xs text-stone-500">{M.loadingDesc}</p>
        </div>
      </div>
      <div className="mt-6 space-y-3">
        <div className="h-14 rounded-xl bg-stone-100 animate-pulse" />
        <div className="h-14 rounded-xl bg-stone-100 animate-pulse" />
        <div className="h-14 rounded-xl bg-stone-100 animate-pulse" />
      </div>
    </section>
  );

  const successBlock = (
    <section className="rounded-2xl bg-white border border-stone-200 p-5 md:p-6" data-state="success">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h2 className="font-semibold text-stone-900 flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-emerald-500" />
            {M.successTitlePre} <span>{candidates.length}</span> {M.successTitlePost}
          </h2>
          <p className="mt-1 text-xs text-stone-500">{M.successDesc}</p>
        </div>
        <button
          type="button"
          onClick={backToInput}
          className="text-sm text-stone-500 hover:text-stone-800 flex items-center gap-1"
        >
          <Undo2 className="h-4 w-4" />
          {M.repaste}
        </button>
      </div>
      <div className="mt-4 space-y-2">
        {candidates.length === 0 ? (
          <p className="text-sm text-stone-500 py-4 text-center">{M.candEmpty}</p>
        ) : (
          candidates.map((c) => {
            const dup = importedNames.includes(c.name);
            return (
              <div
                key={c.key}
                className={`flex flex-wrap sm:flex-nowrap items-center gap-2 p-2.5 rounded-xl border ${
                  c.checked && !dup
                    ? 'border-stone-200 bg-white'
                    : 'border-stone-100 bg-stone-50 opacity-70'
                }`}
              >
                <input
                  type="checkbox"
                  checked={c.checked && !dup}
                  disabled={dup}
                  onChange={() => toggleKeep(c.key)}
                  aria-label="保留该地点"
                  className="w-4 h-4 accent-primary shrink-0"
                />
                <span
                  className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${typeIconCls(c.type)}`}
                >
                  {c.type === PLACE_TYPE.FOOD ? (
                    <Utensils className="h-4 w-4" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </span>
                <input
                  value={c.name}
                  maxLength={30}
                  onChange={(e) => rename(c.key, e.target.value)}
                  aria-label="地点名称"
                  className="flex-1 min-w-[120px] h-9 px-2 rounded-lg border border-transparent hover:border-stone-200 focus:border-primary outline-none text-sm font-medium"
                />
                <select
                  value={c.type}
                  onChange={(e) => retype(c.key, e.target.value as PlaceType)}
                  className="h-9 px-2 rounded-lg border border-stone-200 text-xs bg-white"
                >
                  <option value={PLACE_TYPE.ATTRACTION}>
                    {PLACE_TYPE_LABEL[PLACE_TYPE.ATTRACTION]}
                  </option>
                  <option value={PLACE_TYPE.FOOD}>{PLACE_TYPE_LABEL[PLACE_TYPE.FOOD]}</option>
                </select>
                {dup ? (
                  <span className="text-[11px] px-2 py-1 rounded bg-stone-200 text-stone-600 shrink-0">
                    {M.candDup}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => removeCand(c.key)}
                  aria-label="删除"
                  className="w-8 h-8 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 grid place-items-center shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
      <div className="mt-4 rounded-xl border border-dashed border-stone-300 p-3">
        <p className="text-xs font-semibold text-stone-500 mb-2">{M.manualTitle}</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="manual-name"
            value={manualName}
            maxLength={30}
            onChange={(e) => setManualName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addManual();
            }}
            placeholder={M.manualNamePlaceholder}
            className="flex-1 h-10 px-3 rounded-lg border border-stone-300 focus:border-primary outline-none text-sm"
          />
          <select
            value={manualType}
            onChange={(e) => setManualType(e.target.value as PlaceType)}
            className="h-10 px-3 rounded-lg border border-stone-300 text-sm bg-white"
          >
            <option value={PLACE_TYPE.ATTRACTION}>{PLACE_TYPE_LABEL[PLACE_TYPE.ATTRACTION]}</option>
            <option value={PLACE_TYPE.FOOD}>{PLACE_TYPE_LABEL[PLACE_TYPE.FOOD]}</option>
          </select>
          <button
            type="button"
            onClick={addManual}
            className="h-10 px-4 rounded-lg bg-stone-900 text-white text-sm flex items-center justify-center gap-1"
          >
            <Plus className="h-4 w-4" />
            {M.manualAdd}
          </button>
        </div>
        <p className="mt-1 text-xs text-red-600">{manualErr}</p>
      </div>
      <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center">
        <button
          type="button"
          disabled={submitting || selectableCandidates.length === 0}
          onClick={confirmAdd}
          className={`h-11 px-6 rounded-xl text-sm flex items-center justify-center gap-2 disabled:bg-stone-300 disabled:brightness-100 ${gradBtnCls}`}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          <span>{M.confirmCount(selectableCandidates.length)}</span>
        </button>
        <p className="text-xs text-stone-500">{M.confirmNote}</p>
      </div>
    </section>
  );

  const emptyBlock = (
    <section className="rounded-2xl bg-white border border-stone-200 p-8 text-center" data-state="empty">
      <span className="w-16 h-16 mx-auto rounded-2xl bg-stone-100 text-stone-400 grid place-items-center">
        <MapPin className="h-[34px] w-[34px]" />
      </span>
      <p className="mt-4 font-semibold">{M.emptyTitle}</p>
      <p className="mt-1 text-sm text-stone-500">{M.emptyDesc}</p>
      <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
        <button
          type="button"
          onClick={backToInput}
          className="h-10 px-5 rounded-lg border border-stone-300 text-sm"
        >
          {M.emptyChange}
        </button>
        <button
          type="button"
          onClick={manualOnly}
          className="h-10 px-5 rounded-lg bg-primary text-white text-sm font-semibold"
        >
          {M.emptyManual}
        </button>
      </div>
    </section>
  );

  const errorBlock = (
    <section className="rounded-2xl bg-red-50 border border-red-200 p-8 text-center" data-state="error">
      <span className="w-16 h-16 mx-auto rounded-2xl bg-white text-red-500 grid place-items-center">
        <Bot className="h-[34px] w-[34px]" />
      </span>
      <p className="mt-4 font-semibold text-red-700">{M.errorTitle}</p>
      <p className="mt-1 text-sm text-red-600">{M.errorDesc}</p>
      <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
        <button
          type="button"
          onClick={extract}
          className="h-10 px-5 rounded-lg bg-primary text-white text-sm font-semibold"
        >
          {M.errorRetry}
        </button>
        <button
          type="button"
          onClick={manualOnly}
          className="h-10 px-5 rounded-lg border border-red-300 bg-white text-sm"
        >
          {M.errorManual}
        </button>
      </div>
    </section>
  );

  return (
    <div>
      <div className="flex items-center gap-3">
        <Link
          href={ROUTES.ROUTE_NEW}
          aria-label="返回路线设置"
          className="w-9 h-9 rounded-lg border border-stone-200 bg-white grid place-items-center"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-stone-900">
            {M.titlePrefix} <span className="text-primary">{cityName ?? M.noCity}</span>
          </h1>
          <p className="text-sm text-stone-500">{M.desc}</p>
        </div>
      </div>

      <div className="mt-6 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* 当前城市的收藏地点和美食 */}
          <section className={cardCls} id="favorites">
            <div className="flex flex-wrap items-start gap-3 justify-between">
              <div>
                <h2 className="font-semibold text-stone-900 flex items-center gap-2">
                  <Bookmark className="h-4 w-4 text-primary" />
                  {M.favTitle}
                </h2>
                <p className="mt-1 text-xs text-stone-500">{M.favDesc}</p>
              </div>
              <Link
                href={ROUTES.COLLECTED}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <Bookmark className="h-4 w-4" />
                {M.favManage}
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="flex bg-stone-100 rounded-xl p-1">
                {(
                  [
                    ['all', M.favTabAll],
                    [PLACE_TYPE.ATTRACTION, PLACE_TYPE_LABEL[PLACE_TYPE.ATTRACTION]],
                    [PLACE_TYPE.FOOD, PLACE_TYPE_LABEL[PLACE_TYPE.FOOD]],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFavTab(value)}
                    className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold ${
                      favTab === value ? 'bg-white shadow-sm text-stone-900' : 'text-stone-500'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-stone-500">
                {M.favSum(cityPlaces.length, spotCount, foodCount)}
              </span>
              <button
                type="button"
                disabled={cityPlaces.length === 0}
                onClick={addAllFav}
                className={`ml-auto h-10 px-4 rounded-xl text-sm flex items-center gap-1.5 disabled:opacity-50 ${softBtnCls}`}
              >
                <ListPlus className="h-4 w-4" />
                {M.favAddAll}
              </button>
            </div>
            <div className="mt-4">{favBody}</div>
          </section>

          {/* 导入文案 / 识别中 / 候选确认 / 未识别 / 失败 */}
          {status === 'loading' ? loadingBlock : null}
          {status === 'success' ? successBlock : null}
          {status === 'empty' ? emptyBlock : null}
          {status === 'error' ? errorBlock : null}
          {status === 'normal' ? importCard : null}
        </div>

        {/* 右侧：导入小贴士（醒目卡片：加粗描边 + 标题徽标 + 底部已导入信息条） */}
        <aside className="space-y-4">
          <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-b from-amber-50 to-amber-100/60 p-5 text-sm text-amber-900 shadow-sm ring-1 ring-amber-100">
            <h3 className="flex items-center gap-2 text-base font-bold">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-500 text-white shadow-sm">
                <Lightbulb className="h-4 w-4" />
              </span>
              {M.asideTitle}
            </h3>
            <ul className="mt-3 space-y-2">
              {M.asideTips.map((tip) => (
                <li key={tip} className="flex gap-2">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  <span className="leading-relaxed">{tip}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-300 bg-white/80 px-3 py-2.5">
              <span className="text-amber-900">
                {M.asideImportedPre}{' '}
                <span className="text-lg font-bold text-amber-600">{importedCount}</span>{' '}
                {M.asideImportedPost}
              </span>
              <Link
                href={ROUTES.ROUTE_PLACES(routeId)}
                className="ml-auto flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-amber-500 px-4 text-sm font-bold text-white shadow-sm hover:bg-amber-600 hover:shadow"
              >
                <CheckCheck className="h-4 w-4" />
                {M.asideGo}
              </Link>
            </div>
          </div>
        </aside>
      </div>

      {toast ? (
        <div
          className={`fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm text-white shadow-lg ${
            toast.tone === 'ok' ? 'bg-emerald-600' : toast.tone === 'err' ? 'bg-red-600' : 'bg-foreground'
          }`}
        >
          {toast.text}
        </div>
      ) : null}
    </div>
  );
}

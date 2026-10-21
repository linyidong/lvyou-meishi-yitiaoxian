'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bookmark,
  Building2,
  Camera,
  ChevronDown,
  CircleCheckBig,
  ClipboardPaste,
  LoaderCircle,
  Plus,
  Sparkles,
  SquarePen,
  Star,
  Trash2,
  Undo2,
  Unlink,
  Utensils,
  WandSparkles,
} from 'lucide-react';
import { BUSINESS } from '@/config/business';
import { CITIES } from '@/config/cities';
import { IMPORT_SOURCE, PLACE_TYPE, PLACE_TYPE_LABEL } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import type { ImportSource, PlaceType } from '@/types';

interface Candidate {
  key: string;
  name: string;
  type: PlaceType;
  note?: string;
  checked: boolean;
}

type Toast = { text: string; tone: 'ok' | 'err' };

const URL_ONLY_PATTERN = /^https?:\/\/\S+$/i;

/** 从文案推断导入来源（与原型一致：含抖音 / 小红书特征则归到对应来源） */
function sourceOf(text: string): ImportSource {
  if (/douyin|抖音/i.test(text)) return IMPORT_SOURCE.DOUYIN;
  if (/xiaohongshu|小红书|xhslink/i.test(text)) return IMPORT_SOURCE.XIAOHONGSHU;
  return IMPORT_SOURCE.MANUAL;
}

/**
 * U02 首页の「导入地点美食先收藏」区块（本期新增）。
 * 粘贴分享文案 → POST /api/ai/extract 提取候选 → 勾选后 POST /api/places 落库为收藏。
 */
export function ImportCollectClient({
  isLoggedIn,
  collectedCount,
}: {
  isLoggedIn: boolean;
  collectedCount: number;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'text' | 'link'>('text');
  const [text, setText] = useState('');
  /** AI 从文案里识别出的城市（用于提示，未必在内置城市列表中） */
  const [aiCity, setAiCity] = useState('');
  /** 实际用于收藏的城市：AI 识别结果命中内置城市列表时自动带上，也可手动改选 */
  const [city, setCity] = useState('');
  const [extracting, setExtracting] = useState(false);
  /** 本次提取是否走「链接读取」路径，仅用于按钮文案区分（读取链接 / AI 识别） */
  const [linkMode, setLinkMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [resultOpen, setResultOpen] = useState(false);
  const [needText, setNeedText] = useState(false);
  /** 文案里带了链接、但链接正文没读到（平台登录墙 / 404），用于额外提示 */
  const [linkFailed, setLinkFailed] = useState(false);
  const [error, setError] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualType, setManualType] = useState<PlaceType>(PLACE_TYPE.ATTRACTION);
  const [manualError, setManualError] = useState('');
  const [toast, setToast] = useState<Toast | null>(null);
  /** 手动输入地点输入框：0 结果时用「去手动输入」按钮直接聚焦，减少操作步骤 */
  const manualRef = useRef<HTMLInputElement>(null);

  const tooLong = text.length > BUSINESS.MAX_IMPORT_TEXT_LENGTH;
  const selected = candidates.filter((c) => c.checked && c.name.trim().length > 0);
  /** 城市识别状态提示：AI 命中内置城市列表 / AI 给的城市不在列表 / AI 完全没识别到 */
  const cityStatusHint = aiCity
    ? CITIES.some((c) => c.name === aiCity)
      ? MESSAGES.HOME_IMPORT.cityAuto(aiCity)
      : MESSAGES.HOME_IMPORT.cityMissing(aiCity)
    : MESSAGES.HOME_IMPORT.cityUnknown;

  const tabCls = (on: boolean) =>
    `flex-1 rounded-lg px-4 py-2 text-sm font-semibold sm:flex-none ${
      on ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
    }`;

  function showToast(text2: string, tone: Toast['tone']) {
    setToast({ text: text2, tone });
    setTimeout(() => setToast(null), 2600);
  }

  function switchTab(next: 'text' | 'link') {
    setTab(next);
    setNeedText(false);
    setLinkFailed(false);
    setError('');
  }

  function applySample(i: number) {
    setText(MESSAGES.HOME_IMPORT.samples[i].value);
    setTab(i === 1 || i === 2 ? 'link' : 'text');
    setNeedText(false);
    setError('');
  }

  function onInput(value: string) {
    setText(value);
    setNeedText(false);
    setLinkFailed(false);
    setError(value.length > BUSINESS.MAX_IMPORT_TEXT_LENGTH ? MESSAGES.IMPORT_TEXT_TOO_LONG : '');
  }

  async function extract() {
    const value = text.trim();
    if (!value) {
      setError(MESSAGES.HOME_IMPORT.needText);
      return;
    }
    // 只粘贴了链接：走服务端「链接 → 正文」抓取路径（短链 302 由服务端跟随）
    const viaLink = URL_ONLY_PATTERN.test(value);
    if (!viaLink && tooLong) {
      setError(MESSAGES.IMPORT_TEXT_TOO_LONG);
      return;
    }
    setExtracting(true);
    setLinkMode(viaLink);
    setError('');
    setNeedText(false);
    setLinkFailed(false);
    try {
      const res = await fetch('/api/ai/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(viaLink ? { url: value } : { text: value }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        city?: string;
        places?: { name: string; type: PlaceType; note?: string }[];
        linkReadFailed?: boolean;
        error?: string;
      };
      if (!data.ok) {
        if (data.error === MESSAGES.LINK_NEED_TEXT) {
          setNeedText(true);
          return;
        }
        setError(data.error ?? MESSAGES.AI_FAILED);
        return;
      }
      setLinkFailed(data.linkReadFailed === true);
      // 先落城市：AI 识别的城市命中内置城市列表时自动选中，否则交给用户手动选
      const recognizedCity = (data.city ?? '').trim();
      setAiCity(recognizedCity);
      setCity(CITIES.some((c) => c.name === recognizedCity) ? recognizedCity : '');
      const places = data.places ?? [];
      setCandidates(
        places.map((p, i) => ({
          key: `${i}-${p.name}`,
          name: p.name,
          type: p.type,
          note: p.note,
          checked: true,
        })),
      );
      setResultOpen(true);
      if (places.length === 0) showToast(MESSAGES.HOME_IMPORT.noResult, 'err');
    } catch {
      setError(MESSAGES.NETWORK_ERROR);
    } finally {
      setExtracting(false);
    }
  }

  function addManual() {
    const name = manualName.trim();
    if (name.length < 2) {
      setManualError(MESSAGES.HOME_IMPORT.manualEmptyName);
      return;
    }
    if (candidates.some((c) => c.name === name)) {
      setManualError(MESSAGES.HOME_IMPORT.manualDuplicate(name));
      return;
    }
    setManualError('');
    setCandidates((prev) => [...prev, { key: `manual-${Date.now()}`, name, type: manualType, checked: true }]);
    setManualName('');
  }

  function resetFlow() {
    setResultOpen(false);
    setCandidates([]);
    setAiCity('');
    setCity('');
    setError('');
    setNeedText(false);
    setLinkFailed(false);
  }

  async function save() {
    if (!isLoggedIn) {
      router.push(ROUTES.LOGIN);
      return;
    }
    if (selected.length === 0) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cityName: city,
          source: sourceOf(text),
          rawText: text.trim(),
          items: selected.map((c) => ({ name: c.name.trim(), type: c.type, note: c.note })),
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        inserted?: number;
        cityMatched?: boolean;
        message?: string;
      };
      if (!data.ok) {
        setError(data.message ?? MESSAGES.NETWORK_ERROR);
        return;
      }
      const inserted = data.inserted ?? 0;
      if (city && data.cityMatched === false) {
        // 城市没落到库里：地点已收藏，但城市为空
        showToast(MESSAGES.HOME_IMPORT.cityMissingSaved(city), 'err');
      } else if (city) {
        showToast(MESSAGES.HOME_IMPORT.savedWithCity(inserted, city), 'ok');
      } else {
        showToast(MESSAGES.HOME_IMPORT.savedNoCity(inserted), 'ok');
      }
      setCandidates([]);
      setResultOpen(false);
      setText('');
      setAiCity('');
      setCity('');
      setNeedText(false);
      router.refresh();
    } catch {
      setError(MESSAGES.NETWORK_ERROR);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-primary/30 bg-white p-5 md:p-6">
      {toast ? (
        <div
          className={`fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm text-white shadow-lg ${
            toast.tone === 'ok' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          {toast.text}
        </div>
      ) : null}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/5 text-primary">
          <Sparkles className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-stone-900">{MESSAGES.HOME_COLLECT.title}</p>
            <span className="rounded-full bg-primary/5 px-2 py-0.5 text-[11px] text-primary">
              {MESSAGES.HOME_COLLECT.badgeNew}
            </span>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
              {MESSAGES.HOME_COLLECT.badgePrd}
            </span>
          </div>
          <p className="mt-1 text-sm text-stone-600">{MESSAGES.HOME_COLLECT.desc}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
            <span className="flex items-center gap-1">
              <Star className="h-4 w-4 text-primary" />
              {MESSAGES.HOME_COLLECT.count(collectedCount)}
            </span>
            <span className="text-stone-400">
              {collectedCount > 0 ? MESSAGES.HOME_COLLECT.hintHas : MESSAGES.HOME_COLLECT.hintEmpty}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <a
            href="#importCollect"
            className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-5 text-sm font-semibold text-white hover:brightness-110"
          >
            <WandSparkles className="h-4 w-4" />
            {MESSAGES.HOME_COLLECT.btnImport}
          </a>
          <Link
            href={ROUTES.COLLECTED}
            className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-stone-300 px-5 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            <Bookmark className="h-4 w-4" />
            {MESSAGES.HOME_COLLECT.btnCollected}
          </Link>
        </div>
      </div>

      <details id="importCollect" className="group mt-4 rounded-xl border border-stone-200 bg-stone-50/60">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-stone-800">
          <ClipboardPaste className="h-4 w-4 text-primary" />
          {MESSAGES.HOME_IMPORT.summary}
          <ChevronDown className="ml-auto h-4 w-4 text-stone-400 transition group-open:rotate-180" />
        </summary>

        <div className="px-4 pb-4">
          <div className="flex w-full rounded-xl border border-stone-200 bg-white p-1 sm:w-fit">
            <button type="button" onClick={() => switchTab('text')} className={tabCls(tab === 'text')}>
              {MESSAGES.HOME_IMPORT.tabText}
            </button>
            <button type="button" onClick={() => switchTab('link')} className={tabCls(tab === 'link')}>
              {MESSAGES.HOME_IMPORT.tabLink}
            </button>
          </div>

          {tab === 'link' ? (
            <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
              {MESSAGES.HOME_IMPORT.linkTip}
            </div>
          ) : null}

          <textarea
            value={text}
            onChange={(e) => onInput(e.target.value)}
            rows={5}
            placeholder={
              tab === 'link' ? MESSAGES.HOME_IMPORT.placeholderLink : MESSAGES.HOME_IMPORT.placeholderText
            }
            className="mt-3 w-full resize-y rounded-xl border border-stone-300 bg-white p-3 text-sm leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <div className="mt-1 flex items-center justify-between text-xs">
            <p className="text-red-600">{error}</p>
            <span className="text-stone-400">
              {text.length} / {BUSINESS.MAX_IMPORT_TEXT_LENGTH}
            </span>
          </div>

          {needText ? (
            <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="flex items-center gap-1.5 font-semibold">
                <Unlink className="h-4 w-4" />
                {MESSAGES.HOME_IMPORT.needTextTitle}
              </p>
              <p className="mt-1">{MESSAGES.HOME_IMPORT.needTextDesc}</p>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="py-1.5 text-stone-400">{MESSAGES.HOME_IMPORT.sampleLabel}</span>
            {MESSAGES.HOME_IMPORT.samples.map((s, i) => (
              <button
                key={s.label}
                type="button"
                onClick={() => applySample(i)}
                className={`rounded-full px-3 py-1.5 ${
                  i === 0
                    ? 'bg-primary/5 text-primary hover:bg-primary/10'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={extracting}
              onClick={extract}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-6 font-semibold text-white hover:brightness-110 disabled:opacity-60"
            >
              {extracting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              <span>{extracting ? (linkMode ? MESSAGES.HOME_IMPORT.linkBusy : MESSAGES.HOME_IMPORT.extractBusy) : MESSAGES.HOME_IMPORT.extract}</span>
            </button>
            <button
              type="button"
              onClick={() => setResultOpen(true)}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-6 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              <SquarePen className="h-4 w-4" />
              {MESSAGES.HOME_IMPORT.manual}
            </button>
          </div>

          {resultOpen ? (
            <div className="mt-4 rounded-xl border border-stone-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 font-semibold text-stone-900">
                    <CircleCheckBig className="h-4 w-4 text-emerald-500" />
                    {MESSAGES.HOME_IMPORT.resultTitle(candidates.length)}
                  </h3>
                  <p className="mt-0.5 text-xs text-stone-500">{MESSAGES.HOME_IMPORT.resultNote}</p>
                </div>
                <button
                  type="button"
                  onClick={resetFlow}
                  className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800"
                >
                  <Undo2 className="h-4 w-4" />
                  {MESSAGES.HOME_IMPORT.repaste}
                </button>
              </div>

              {/* 0 结果时说明原因：分享文本只有标题 / 链接正文读不到 */}
              {candidates.length === 0 ? (
                <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="flex items-center gap-1.5 font-semibold">
                    <Unlink className="h-4 w-4" />
                    {MESSAGES.HOME_IMPORT.noResultTitle}
                  </p>
                  <p className="mt-1">{MESSAGES.HOME_IMPORT.noResultDesc}</p>
                  {linkFailed ? (
                    <p className="mt-1 text-xs">{MESSAGES.HOME_IMPORT.linkFailNote}</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      manualRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      manualRef.current?.focus();
                    }}
                    className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-400 bg-white px-3 text-sm font-medium text-amber-900 hover:bg-amber-100"
                  >
                    <SquarePen className="h-4 w-4" />
                    {MESSAGES.HOME_IMPORT.goManual}
                  </button>
                </div>
              ) : null}

              {/* 城市归属：AI 先识别城市，下面的地点与美食都收藏到这个城市下 */}
              <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                <label
                  htmlFor="importCity"
                  className="flex items-center gap-1.5 text-xs font-semibold text-stone-700"
                >
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  {MESSAGES.HOME_IMPORT.cityLabel}
                </label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    id="importCity"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="h-10 rounded-lg border border-stone-300 bg-white px-2 text-sm outline-none focus:border-primary"
                  >
                    <option value="">{MESSAGES.HOME_IMPORT.cityPick}</option>
                    {CITIES.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-stone-600">{cityStatusHint}</p>
                </div>
                <p className="mt-1.5 text-xs text-stone-500">{MESSAGES.HOME_IMPORT.cityHint}</p>
              </div>

              <div className="mt-3 space-y-2">
                {candidates.map((c) => (
                  <div
                    key={c.key}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white p-2.5"
                  >
                    <input
                      type="checkbox"
                      checked={c.checked}
                      onChange={() =>
                        setCandidates((prev) =>
                          prev.map((x) => (x.key === c.key ? { ...x, checked: !x.checked } : x)),
                        )
                      }
                      className="h-4 w-4 shrink-0 accent-primary"
                      aria-label="勾选收藏该地点"
                    />
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                        c.type === PLACE_TYPE.FOOD
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-teal-50 text-teal-600'
                      }`}
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
                      onChange={(e) =>
                        setCandidates((prev) =>
                          prev.map((x) => (x.key === c.key ? { ...x, name: e.target.value } : x)),
                        )
                      }
                      className="h-9 min-w-[120px] flex-1 rounded-lg border border-transparent bg-transparent px-2 text-sm font-medium outline-none hover:border-stone-200 focus:border-primary"
                      aria-label="地点名称"
                    />
                    <select
                      value={c.type}
                      onChange={(e) =>
                        setCandidates((prev) =>
                          prev.map((x) =>
                            x.key === c.key ? { ...x, type: e.target.value as PlaceType } : x,
                          ),
                        )
                      }
                      className="h-9 shrink-0 rounded-lg border border-stone-200 bg-white px-2 text-xs outline-none focus:border-primary"
                    >
                      <option value={PLACE_TYPE.ATTRACTION}>
                        {PLACE_TYPE_LABEL[PLACE_TYPE.ATTRACTION]}
                      </option>
                      <option value={PLACE_TYPE.FOOD}>{PLACE_TYPE_LABEL[PLACE_TYPE.FOOD]}</option>
                    </select>
                    <button
                      type="button"
                      aria-label="删除"
                      onClick={() => setCandidates((prev) => prev.filter((x) => x.key !== c.key))}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                <div className="rounded-xl border border-dashed border-stone-300 p-3">
                  <p className="mb-2 text-xs font-semibold text-stone-500">
                    {MESSAGES.HOME_IMPORT.manualTitle}
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      ref={manualRef}
                      value={manualName}
                      maxLength={30}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder={MESSAGES.HOME_IMPORT.manualNamePlaceholder}
                      className="h-10 flex-1 rounded-lg border border-stone-300 px-3 text-sm outline-none focus:border-primary"
                    />
                    <select
                      value={manualType}
                      onChange={(e) => setManualType(e.target.value as PlaceType)}
                      className="h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm outline-none focus:border-primary"
                    >
                      <option value={PLACE_TYPE.ATTRACTION}>
                        {PLACE_TYPE_LABEL[PLACE_TYPE.ATTRACTION]}
                      </option>
                      <option value={PLACE_TYPE.FOOD}>{PLACE_TYPE_LABEL[PLACE_TYPE.FOOD]}</option>
                    </select>
                    <button
                      type="button"
                      onClick={addManual}
                      className="flex h-10 items-center justify-center gap-1 rounded-lg bg-stone-900 px-4 text-sm text-white"
                    >
                      <Plus className="h-4 w-4" />
                      {MESSAGES.HOME_IMPORT.manualAdd}
                    </button>
                  </div>
                  {manualError ? <p className="mt-1 text-xs text-red-600">{manualError}</p> : null}
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  disabled={saving || selected.length === 0}
                  onClick={save}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-6 font-semibold text-white hover:brightness-110 disabled:bg-none disabled:bg-stone-300"
                >
                  {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  <span>{MESSAGES.HOME_IMPORT.save(selected.length)}</span>
                </button>
                <p className="text-xs text-stone-500">{MESSAGES.HOME_IMPORT.saveNote}</p>
              </div>
            </div>
          ) : null}
        </div>
      </details>
    </section>
  );
}

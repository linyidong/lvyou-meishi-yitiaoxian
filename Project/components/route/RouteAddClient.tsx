'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Link2, Sparkles, Trash2 } from 'lucide-react';
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
}

type PlaceTab = 'all' | PlaceType;
type ImportTab = 'text' | 'link';
type Notice = { text: string; tone: 'info' | 'ok' | 'err' };

const URL_ONLY_PATTERN = /^https?:\/\/\S+$/i;

const cardCls = 'rounded-2xl border border-border bg-background p-5';
const inputCls =
  'h-11 w-full rounded-xl border border-border px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';
const tabCls = (on: boolean) =>
  `flex-1 rounded-lg px-3 py-2 text-sm font-medium ${on ? 'bg-background shadow-sm' : 'text-muted-foreground'}`;
const typeBadgeCls = (type: PlaceType) =>
  `rounded-full px-2 py-0.5 text-[11px] ${
    type === PLACE_TYPE.FOOD ? 'bg-amber-50 text-amber-700' : 'bg-teal-50 text-teal-700'
  }`;

/**
 * U06 添加地点：左侧「当前城市收藏」「导入文案」，右侧小贴士。
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

  const [placeTab, setPlaceTab] = useState<PlaceTab>('all');
  const [addedSet, setAddedSet] = useState<Set<string>>(() => new Set(addedPlaceIds));
  const [busyId, setBusyId] = useState<string | null>(null);

  const [importTab, setImportTab] = useState<ImportTab>('text');
  const [text, setText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualType, setManualType] = useState<PlaceType>(PLACE_TYPE.ATTRACTION);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const tooLong = text.length > BUSINESS.MAX_IMPORT_TEXT_LENGTH;

  const visiblePlaces = useMemo(
    () => cityPlaces.filter((p) => (placeTab === 'all' ? true : p.type === placeTab)),
    [cityPlaces, placeTab],
  );

  const selectedCandidates = candidates.filter((c) => c.checked && c.name.trim().length > 0);

  function showNotice(text: string, tone: Notice['tone'] = 'info') {
    setNotice({ text, tone });
  }

  async function addToRoute(placeId: string) {
    setBusyId(placeId);
    try {
      const res = await fetch('/api/collected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId, routeId }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!data.ok) {
        showNotice(data.message ?? MESSAGES.NETWORK_ERROR, 'err');
        return;
      }
      setAddedSet((prev) => new Set(prev).add(placeId));
      showNotice('已加入当前路线，可在「勾选地点」里确认', 'ok');
    } catch {
      showNotice(MESSAGES.NETWORK_ERROR, 'err');
    } finally {
      setBusyId(null);
    }
  }

  async function extract() {
    const value = text.trim();
    if (!value || URL_ONLY_PATTERN.test(value)) {
      showNotice(MESSAGES.LINK_NEED_TEXT, 'err');
      return;
    }
    if (tooLong) {
      showNotice(MESSAGES.IMPORT_TEXT_TOO_LONG, 'err');
      return;
    }
    setExtracting(true);
    setNotice(null);
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
        showNotice(data.error ?? MESSAGES.AI_FAILED, 'err');
        return;
      }
      const places = data.places ?? [];
      if (places.length === 0) {
        setCandidates([]);
        showNotice(MESSAGES.AI_FAILED, 'err');
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
      showNotice(`识别到 ${places.length} 个地点，请确认`, 'ok');
    } catch {
      showNotice(MESSAGES.NETWORK_ERROR, 'err');
    } finally {
      setExtracting(false);
    }
  }

  function addManual() {
    const name = manualName.trim();
    if (name.length < 2) {
      showNotice(MESSAGES.PLACE_NAME_TOO_SHORT, 'err');
      return;
    }
    const exists =
      cityPlaces.some((p) => p.name === name) || candidates.some((c) => c.name === name);
    if (exists) {
      showNotice(MESSAGES.PLACE_NAME_DUPLICATE, 'err');
      return;
    }
    setCandidates((prev) => [
      ...prev,
      { key: `manual-${Date.now()}`, name, type: manualType, checked: true },
    ]);
    setManualName('');
    showNotice('已加入待确认列表，点下方按钮确认添加', 'info');
  }

  async function confirmAdd() {
    if (selectedCandidates.length === 0) return;
    const tooShort = selectedCandidates.some((c) => c.name.trim().length < 2);
    if (tooShort) {
      showNotice(MESSAGES.PLACE_NAME_TOO_SHORT, 'err');
      return;
    }
    setSubmitting(true);
    setNotice(null);
    try {
      const res = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeId,
          cityId,
          rawText: text.trim() || undefined,
          items: selectedCandidates.map((c) => ({
            name: c.name.trim(),
            type: c.type,
          })),
        }),
      });
      const data = (await res.json()) as { ok: boolean; inserted?: number; message?: string };
      if (!data.ok) {
        showNotice(data.message ?? MESSAGES.NETWORK_ERROR, 'err');
        return;
      }
      showNotice(MESSAGES.PLACES_ADDED(data.inserted ?? 0), 'ok');
      router.push(ROUTES.ROUTE_PLACES(routeId));
    } catch {
      showNotice(MESSAGES.NETWORK_ERROR, 'err');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">导入地点 · {cityName ?? '未指定城市'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          粘贴小红书 / 抖音分享文案，AI 帮你找出里面的景点和美食，确认后再进入勾选。
        </p>
      </div>

      {notice ? (
        <p
          className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
            notice.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : notice.tone === 'err'
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          {/* 卡片① 当前城市的收藏地点和美食 */}
          <section className={cardCls}>
            <h2 className="text-sm font-semibold">当前城市的收藏地点和美食</h2>
            <div className="mt-3 flex rounded-xl bg-muted p-1">
              {(
                [
                  ['all', '全部'],
                  [PLACE_TYPE.ATTRACTION, PLACE_TYPE_LABEL[PLACE_TYPE.ATTRACTION]],
                  [PLACE_TYPE.FOOD, PLACE_TYPE_LABEL[PLACE_TYPE.FOOD]],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPlaceTab(value)}
                  className={tabCls(placeTab === value)}
                >
                  {label}
                </button>
              ))}
            </div>

            {cityPlaces.length === 0 ? (
              <p className="mt-3 rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground">
                这座城市还没有收藏地点，可用下方的导入卡粘贴文案，或手动输入地点。
              </p>
            ) : visiblePlaces.length === 0 ? (
              <p className="mt-3 rounded-xl bg-muted px-4 py-3 text-xs text-muted-foreground">
                当前分类下没有收藏地点。
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {visiblePlaces.map((p) => {
                  const added = addedSet.has(p.id);
                  return (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl border border-border px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium">{p.name}</span>
                          <span className={typeBadgeCls(p.type)}>{PLACE_TYPE_LABEL[p.type]}</span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {p.address ?? '待定位'}
                        </p>
                      </div>
                      {added ? (
                        <span className="shrink-0 text-xs text-muted-foreground">已在当前路线</span>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() => addToRoute(p.id)}
                          className="h-9 shrink-0 rounded-lg border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
                        >
                          加入当前路线
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* 卡片② 导入文案 */}
          <section className={cardCls}>
            <h2 className="text-sm font-semibold">导入文案</h2>
            <div className="mt-3 flex rounded-xl bg-muted p-1">
              {(
                [
                  ['text', '粘贴分享文案'],
                  ['link', '粘贴链接'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setImportTab(value)}
                  className={tabCls(importTab === value)}
                >
                  {label}
                </button>
              ))}
            </div>

            {importTab === 'link' ? (
              <p className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs text-sky-800">
                第一版不会直接打开或读取小红书 / 抖音页面；请同时粘贴分享时自动生成的文案，否则无法提取。
              </p>
            ) : null}

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="把小红书 / 抖音的分享文案整段粘贴到这里"
              className="mt-3 w-full rounded-xl border border-border p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">只识别文案中的景点和美食，不会打开外部链接</span>
              <span className={tooLong ? 'text-red-600' : 'text-muted-foreground'}>
                {text.length} / {BUSINESS.MAX_IMPORT_TEXT_LENGTH}
              </span>
            </div>
            {tooLong ? <p className="mt-1 text-xs text-red-600">{MESSAGES.IMPORT_TEXT_TOO_LONG}</p> : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={extracting || tooLong || text.trim().length === 0}
                onClick={extract}
                className="flex h-11 items-center gap-1.5 rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {extracting ? '提取中…' : 'AI 提取地点'}
              </button>
              <button
                type="button"
                onClick={() => setShowManual((v) => !v)}
                className="flex h-11 items-center gap-1.5 rounded-xl border border-border px-5 text-sm font-medium hover:bg-muted"
              >
                不识别，手动输入地点
              </button>
            </div>

            {showManual ? (
              <div className="mt-4 rounded-xl bg-muted p-3">
                <div className="flex flex-wrap gap-2">
                  <input
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="地点名称"
                    className={`${inputCls} flex-1 bg-background`}
                  />
                  <select
                    value={manualType}
                    onChange={(e) => setManualType(e.target.value as PlaceType)}
                    className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                  >
                    <option value={PLACE_TYPE.ATTRACTION}>{PLACE_TYPE_LABEL[PLACE_TYPE.ATTRACTION]}</option>
                    <option value={PLACE_TYPE.FOOD}>{PLACE_TYPE_LABEL[PLACE_TYPE.FOOD]}</option>
                  </select>
                  <button
                    type="button"
                    onClick={addManual}
                    className="h-11 shrink-0 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:brightness-110"
                  >
                    加入列表
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          {/* 提取 / 手动结果区 */}
          {candidates.length > 0 ? (
            <section className={cardCls}>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">识别到 {candidates.length} 个地点，请确认</h2>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                  AI 解析结果仅供参考，可修改名称、类型，或删除
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {candidates.map((c) => (
                  <li key={c.key} className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-3 py-2">
                    <button
                      type="button"
                      aria-label="勾选"
                      onClick={() =>
                        setCandidates((prev) =>
                          prev.map((x) => (x.key === c.key ? { ...x, checked: !x.checked } : x)),
                        )
                      }
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${
                        c.checked ? 'border-primary bg-primary text-white' : 'border-border'
                      }`}
                    >
                      {c.checked ? <Check className="h-3.5 w-3.5" /> : null}
                    </button>
                    <input
                      value={c.name}
                      onChange={(e) =>
                        setCandidates((prev) =>
                          prev.map((x) => (x.key === c.key ? { ...x, name: e.target.value } : x)),
                        )
                      }
                      className="h-9 min-w-0 flex-1 rounded-lg border border-border px-2 text-sm outline-none focus:border-primary"
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
                      className="h-9 shrink-0 rounded-lg border border-border bg-background px-2 text-sm outline-none focus:border-primary"
                    >
                      <option value={PLACE_TYPE.ATTRACTION}>{PLACE_TYPE_LABEL[PLACE_TYPE.ATTRACTION]}</option>
                      <option value={PLACE_TYPE.FOOD}>{PLACE_TYPE_LABEL[PLACE_TYPE.FOOD]}</option>
                    </select>
                    <button
                      type="button"
                      aria-label="删除"
                      onClick={() => setCandidates((prev) => prev.filter((x) => x.key !== c.key))}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => { setCandidates([]); setText(''); }}
                  className="h-11 rounded-xl border border-border px-5 text-sm font-medium hover:bg-muted"
                >
                  重新粘贴
                </button>
                <button
                  type="button"
                  disabled={submitting || selectedCandidates.length === 0}
                  onClick={confirmAdd}
                  className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-primary-from to-primary-to px-6 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
                >
                  {submitting ? '添加中…' : `确认添加 ${selectedCandidates.length} 个地点`}
                </button>
              </div>
            </section>
          ) : null}
        </div>

        {/* 右栏小贴士 */}
        <aside className="space-y-5">
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
              <Link2 className="h-4 w-4" />
              导入小贴士
            </h2>
            <ul className="mt-3 space-y-2 text-xs text-amber-800">
              <li>一次最多 {BUSINESS.MAX_IMPORT_TEXT_LENGTH} 字，超长请分次粘贴。</li>
              <li>同名地点会自动去重，不会重复保存。</li>
              <li>只识别当前城市（{cityName ?? '未指定城市'}）范围内的地点。</li>
              <li>已在当前路线中的地点重复加入会自动跳过。</li>
            </ul>
          </section>
          <section className={cardCls}>
            <p className="text-xs text-muted-foreground">
              完成导入后，进入「勾选地点」挑选这次想去的地点，再生成路线。
            </p>
          </section>
        </aside>
      </div>

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={() => router.push(ROUTES.ROUTE_PLACES(routeId))}
          className="flex h-11 items-center justify-center rounded-xl border border-border px-6 text-sm font-medium hover:bg-muted"
        >
          去勾选地点
        </button>
      </div>
    </div>
  );
}

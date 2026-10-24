'use client';

import { useEffect, useRef, useState } from 'react';
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
  ScanText,
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
import { CITIES, cityLabel } from '@/config/cities';
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

/** T-044 图片识别放行的格式（与服务端魔数嗅探口径一致） */
const OCR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** 文件大小展示（B / KB / MB，一位小数） */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 从文案推断导入来源（与原型一致：含抖音 / 小红书特征则归到对应来源） */
function sourceOf(text: string): ImportSource {
  if (/douyin|抖音/i.test(text)) return IMPORT_SOURCE.DOUYIN;
  if (/xiaohongshu|小红书|xhslink/i.test(text)) return IMPORT_SOURCE.XIAOHONGSHU;
  return IMPORT_SOURCE.MANUAL;
}

/**
 * U02 首页の「导入地点美食先收藏」区块（本期新增）。
 * 粘贴笔记文案 → POST /api/ai/extract 提取候选 → 勾选后 POST /api/places 落库为收藏。
 */
export function ImportCollectClient({
  isLoggedIn,
  collectedCount,
}: {
  isLoggedIn: boolean;
  collectedCount: number;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'text' | 'link' | 'image'>('text');
  const [text, setText] = useState('');
  /** AI 从文案里识别出的城市（用于提示，未必在内置城市列表中） */
  const [aiCity, setAiCity] = useState('');
  /** T-042：AI 识别的城市是否已在城市库（库里没有 → 提示将作为新城市加入，收藏时自动入库） */
  const [aiCityInDb, setAiCityInDb] = useState(true);
  /** T-043：登录用户在识别阶段即入库返回的城市 id（收藏时直接带上，免二次解析） */
  const [aiCityId, setAiCityId] = useState<string | null>(null);
  /** T-043：本次识别是否把新城市加入了城市库（前端据此标注「已加入城市库」） */
  const [aiCityIsNew, setAiCityIsNew] = useState(false);
  /** 实际用于收藏的城市：AI 识别结果直接带上（不在内置列表时作为新城市自动入库），也可手动改选 */
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
  /** T-044 图片识别：已选文件 / 识别中 / 错误提示（与文本 error 分开，切标签互不干扰） */
  const [imageFile, setImageFile] = useState<File | null>(null);
  /** T-046 已选图片的本地预览 URL（objectURL，换图/卸载时释放） */
  const [imagePreview, setImagePreview] = useState<string>('');
  /** 当前预览 URL 的 ref（卸载时统一释放；state 用于渲染） */
  const imagePreviewRef = useRef<string>('');
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState('');
  /** 手动输入地点输入框：0 结果时用「去手动输入」按钮直接聚焦，减少操作步骤 */
  const manualRef = useRef<HTMLInputElement>(null);
  /** 图片识别「选择图片」按钮代理的隐藏 file input */
  const imageInputRef = useRef<HTMLInputElement>(null);
  /** T-046 卸载时释放预览 URL（用 ref 取值，避免卸载后 setState） */
  useEffect(
    () => () => {
      if (imagePreviewRef.current) URL.revokeObjectURL(imagePreviewRef.current);
    },
    [],
  );

  /** T-045 粘贴图片：隐藏的可聚焦区；点「粘贴图片」时聚焦它，便于手机端唤起粘贴菜单 */
  const imagePasteRef = useRef<HTMLTextAreaElement>(null);

  const tooLong = text.length > BUSINESS.MAX_IMPORT_TEXT_LENGTH;
  const selected = candidates.filter((c) => c.checked && c.name.trim().length > 0);
  /**
   * 城市识别状态提示（T-043 三态）：
   * - 本次识别新入库（登录用户）→「新城市，已加入城市库」
   * - 已在库 → 直接确认；不在库（游客 / 写库失败）→ 提示收藏时加入；AI 没识别到 → 手动选
   */
  const aiCityIsKnown = aiCity !== '' && CITIES.some((c) => c.name === aiCity);
  const cityStatusHint = aiCity
    ? aiCityIsNew
      ? MESSAGES.HOME_IMPORT.cityAdded(cityLabel(aiCity))
      : aiCityInDb
        ? MESSAGES.HOME_IMPORT.cityAuto(cityLabel(aiCity))
        : MESSAGES.HOME_IMPORT.cityMissing(cityLabel(aiCity))
    : MESSAGES.HOME_IMPORT.cityUnknown;

  const tabCls = (on: boolean) =>
    `flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold sm:flex-none md:py-2 ${
      on ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
    }`;

  function showToast(text2: string, tone: Toast['tone']) {
    setToast({ text: text2, tone });
    setTimeout(() => setToast(null), 2600);
  }

  function switchTab(next: 'text' | 'link' | 'image') {
    setTab(next);
    setNeedText(false);
    setLinkFailed(false);
    setError('');
    setImageError('');
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
        /** T-042：识别出的城市是否已在城市库 */
        cityInDb?: boolean;
        /** T-043：登录用户识别阶段即入库返回的城市 id / 是否本次新加入 */
        cityId?: string | null;
        cityIsNew?: boolean;
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
      // 先落城市：AI 识别的城市直接带上（T-043 登录用户识别阶段已入库，收藏用返回的 cityId）；
      // 游客 / 写库失败时仍按 T-042 行为——收藏时由 api/places 兜底入库
      const recognizedCity = (data.city ?? '').trim();
      setAiCity(recognizedCity);
      setAiCityInDb(data.cityInDb !== false);
      setAiCityId(typeof data.cityId === 'string' && data.cityId ? data.cityId : null);
      setAiCityIsNew(data.cityIsNew === true);
      setCity(recognizedCity);
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

  /** T-044 选图：前端先校验格式与大小（服务端仍按魔数复验），不合格不落 state */
  function pickImage(file: File | null) {
    setImageError('');
    // 换图/清空时释放上一张的 objectURL，避免内存泄漏
    if (imagePreviewRef.current) URL.revokeObjectURL(imagePreviewRef.current);
    const nextUrl = file ? URL.createObjectURL(file) : '';
    imagePreviewRef.current = nextUrl;
    setImagePreview(nextUrl);
    if (!file) {
      setImageFile(null);
      return;
    }
    if (!OCR_ALLOWED_TYPES.includes(file.type)) {
      setImageFile(null);
      setImageError(MESSAGES.HOME_IMPORT.imageBadType);
      return;
    }
    if (file.size > BUSINESS.MAX_OCR_IMAGE_BYTES) {
      setImageFile(null);
      setImageError(MESSAGES.HOME_IMPORT.imageTooLarge);
      return;
    }
    setImageFile(file);
  }

  /**
   * T-045 粘贴图片：网页版小红书/其它站点可「复制图片」，用户在本页按 ⌘/Ctrl+V 即取剪贴板里的图片。
   * 仅在「图片识别」标签激活时监听，避免影响文本/链接标签下的普通粘贴。
   * 剪贴板里的图片没有文件名，补一个 pasted.png 便于展示。
   */
  useEffect(() => {
    if (tab !== 'image') return;
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i += 1) {
        if (!items[i].type.startsWith('image/')) continue;
        const blob = items[i].getAsFile();
        if (!blob) continue;
        e.preventDefault();
        const named = new File([blob], blob.name && blob.name !== 'image.png' ? blob.name : 'pasted.png', {
          type: blob.type,
        });
        pickImage(named);
        return;
      }
    }
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [tab]);

  /**
   * T-044 识别图片：POST /api/ai/extract-image（multipart，图片只在内存处理、不保存）。
   * 成功后把识别文本写入原文本框并切回「粘贴笔记文案」标签，继续走现有 AI 提取流程。
   */
  async function recognizeImage() {
    if (!imageFile) {
      setImageError(MESSAGES.HOME_IMPORT.imageNoFile);
      return;
    }
    setImageBusy(true);
    setImageError('');
    try {
      const fd = new FormData();
      fd.append('file', imageFile);
      const res = await fetch('/api/ai/extract-image', { method: 'POST', body: fd });
      const data = (await res.json()) as {
        ok: boolean;
        text?: string;
        lineCount?: number;
        error?: string;
      };
      if (!data.ok) {
        setImageError(data.error ?? MESSAGES.HOME_IMPORT.imageFailed);
        return;
      }
      const recognized = (data.text ?? '').trim();
      if (!recognized) {
        setImageError(MESSAGES.HOME_IMPORT.imageEmpty);
        return;
      }
      setText(recognized);
      setNeedText(false);
      setError('');
      setTab('text');
      showToast(
        MESSAGES.HOME_IMPORT.imageDone(data.lineCount ?? recognized.split('\n').length),
        'ok',
      );
    } catch {
      setImageError(MESSAGES.NETWORK_ERROR);
    } finally {
      setImageBusy(false);
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
    setAiCityInDb(true);
    setAiCityId(null);
    setAiCityIsNew(false);
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
      // T-043：城市仍是识别结果时直接带上识别阶段入库返回的 cityId（手动改选其他城市则按名称解析）
      const useCityId = city !== '' && city === aiCity ? aiCityId : null;
      const res = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(useCityId ? { cityId: useCityId } : {}),
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
        // 城市没能落到库里（自动入库失败）：地点已收藏，但城市为空
        showToast(MESSAGES.HOME_IMPORT.cityMissingSaved(cityLabel(city)), 'err');
      } else if (city) {
        showToast(MESSAGES.HOME_IMPORT.savedWithCity(inserted, cityLabel(city)), 'ok');
      } else {
        showToast(MESSAGES.HOME_IMPORT.savedNoCity(inserted), 'ok');
      }
      setCandidates([]);
      setResultOpen(false);
      setText('');
      setAiCity('');
      setAiCityInDb(true);
      setAiCityId(null);
      setAiCityIsNew(false);
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
            <button type="button" onClick={() => switchTab('image')} className={tabCls(tab === 'image')}>
              {MESSAGES.HOME_IMPORT.tabImage}
            </button>
          </div>

          {tab === 'link' ? (
            <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
              {MESSAGES.HOME_IMPORT.linkTip}
            </div>
          ) : null}

          {/* T-044 图片识别：选图 → 识别 → 文本回填下方文本框，复用现有 AI 提取流程；图片不落盘 */}
          {tab === 'image' ? (
            <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
              {MESSAGES.HOME_IMPORT.imageTip}
            </div>
          ) : null}
          {tab === 'image' ? (
            <div className="mt-3 rounded-xl border border-stone-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="flex h-10 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 hover:bg-stone-50"
                >
                  <ScanText className="h-4 w-4 text-violet-600" />
                  {MESSAGES.HOME_IMPORT.imageChoose}
                </button>
                <button
                  type="button"
                  onClick={() => imagePasteRef.current?.focus()}
                  className="hidden h-10 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-700 hover:bg-stone-50 sm:flex"
                >
                  <ClipboardPaste className="h-4 w-4 text-violet-600" />
                  {MESSAGES.HOME_IMPORT.imagePaste}
                </button>
                <textarea
                  ref={imagePasteRef}
                  aria-label={MESSAGES.HOME_IMPORT.imagePaste}
                  className="sr-only"
                  onPaste={(e) => {
                    const items = e.clipboardData?.items;
                    if (!items) return;
                    for (let i = 0; i < items.length; i += 1) {
                      if (!items[i].type.startsWith('image/')) continue;
                      const blob = items[i].getAsFile();
                      if (!blob) continue;
                      e.preventDefault();
                      pickImage(new File([blob], 'pasted.png', { type: blob.type || 'image/png' }));
                      return;
                    }
                  }}
                />
                {imageFile ? (
                  <span className="flex min-w-0 items-center gap-2">
                    {imagePreview ? (
                      // eslint-disable-next-line @next/next/no-img-element -- blob URL 预览，不走 next/image
                      <img
                        src={imagePreview}
                        alt={imageFile.name}
                        className="h-10 w-10 shrink-0 rounded-md border border-stone-200 object-cover"
                      />
                    ) : null}
                    <span className="min-w-0 truncate text-xs text-stone-600">
                      {imageFile.name}（{formatSize(imageFile.size)}）
                    </span>
                  </span>
                ) : null}
                <button
                  type="button"
                  disabled={imageBusy || !imageFile}
                  onClick={recognizeImage}
                  className="ml-auto flex h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-primary-from to-primary-to px-5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
                >
                  {imageBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  <span>{imageBusy ? MESSAGES.HOME_IMPORT.imageBusy : MESSAGES.HOME_IMPORT.imageSubmit}</span>
                </button>
              </div>
              {imageError ? <p className="mt-2 text-xs text-red-600">{imageError}</p> : null}
              <p className="mt-2 hidden text-xs text-stone-500 sm:block">{MESSAGES.HOME_IMPORT.imagePasteHint}</p>
              <p className="mt-1 text-xs text-stone-500">{MESSAGES.HOME_IMPORT.imagePrivacy}</p>
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
                className={`rounded-full px-3 py-3 md:py-1.5 ${
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
                    {/* T-042/043：AI 识别的新城市不在内置列表里，作为可选项直接带上
                        （登录用户识别阶段已入库；游客收藏时兜底入库） */}
                    {aiCity && !aiCityIsKnown ? (
                      <option value={aiCity}>
                        {`${cityLabel(aiCity)}（新城市，${aiCityIsNew ? '已加入城市库' : '将加入城市库'}）`}
                      </option>
                    ) : null}
                    {CITIES.map((c) => (
                      <option key={c.name} value={c.name}>
                        {cityLabel(c.name)}
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

'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import QRCode from 'qrcode';
import { Crown, Download, Loader2 } from 'lucide-react';
import { PLACE_TYPE_LABEL, TRANSPORT } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import { PRODUCT } from '@/config/product';
import { ROUTES } from '@/config/routes';
import { renderRoutePoster } from '@/lib/route-poster';
import type { PlaceType, RouteShareSnapshot } from '@/types';

/**
 * T-007 F-52 分享分级：非会员/游客的分享视图最小数据契约（服务端裁剪后的产物）。
 * 仅含海报绘制所需字段，不含坐标、地址、行程方式与住宿信息。
 */
export interface SharePosterView {
  title: string;
  cityName: string | null;
  days: number;
  totalPlaces: number;
  dayPlans: { dayIndex: number; places: { name: string; type: PlaceType }[] }[];
  exportedAt: string;
}

/**
 * T-007 F-52 公开分享页非会员视图（客户端）：
 * 用最小数据 + 既有 renderRoutePoster 客户端 canvas 渲染路线海报图片，
 * 附「保存为图片」与升级引导。二维码编码当前页地址（window.location.href），
 * token 不经过 props；坐标/地址在本组件数据面物理不存在。
 */
export function SharePosterCard({
  view,
  loggedIn,
  productName,
}: {
  view: SharePosterView;
  loggedIn: boolean;
  productName: string;
}) {
  const S = MESSAGES.SHARE;
  const [posterUrl, setPosterUrl] = useState('');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [failed, setFailed] = useState(false);
  const [loginHref, setLoginHref] = useState<string>(ROUTES.LOGIN);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    setLoginHref(`${ROUTES.LOGIN}?redirect=${encodeURIComponent(window.location.pathname)}`);
    (async () => {
      try {
        const shareUrl = window.location.href;
        const qrDataUrl = await QRCode.toDataURL(shareUrl, { margin: 1, width: 512 });
        // 拼成 renderRoutePoster 的类型兼容入参：下方占位字段均不会被绘制消费
        const snapshot: RouteShareSnapshot = {
          title: view.title,
          cityName: view.cityName,
          days: view.days,
          totalPlaces: view.totalPlaces,
          exportedAt: view.exportedAt,
          dayPlans: view.dayPlans.map((day) => ({
            dayIndex: day.dayIndex,
            places: day.places.map((place) => ({
              name: place.name,
              type: place.type,
              address: null,
              lat: null,
              lng: null,
            })),
          })),
          transport: TRANSPORT.WALK,
          originCity: null,
          intercityMode: null,
          intercityLabel: '',
          lodgingType: null,
          lodgingArea: null,
          lodgingName: null,
          lodgingNights: null,
          lodgingLabel: '',
        };
        const poster = await renderRoutePoster({ snapshot, shareUrl, qrDataUrl });
        if (cancelled) return;
        objectUrl = URL.createObjectURL(poster);
        setBlob(poster);
        setPosterUrl(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [view]);

  function saveImage() {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = S.downloadName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const summary = view.cityName
    ? view.days > 1
      ? S.summary(view.cityName, view.days, view.totalPlaces)
      : S.summarySingle(view.cityName, view.totalPlaces)
    : S.placesTotal(view.totalPlaces);

  return (
    <div className="mx-auto w-full max-w-screen-md">
      {/* 品牌区（与会员视图同款渐变头，仅展示最小字段） */}
      <header className="overflow-hidden bg-gradient-to-r from-primary-from to-primary-to px-5 pt-6 pb-8 text-white">
        <div className="flex items-center gap-2">
          <Image
            src={PRODUCT.LOGO_PATH}
            alt={productName}
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg bg-white/90 p-0.5"
          />
          <div>
            <p className="text-sm leading-tight font-semibold">{productName}</p>
            <p className="text-[11px] text-white/80">{S.sharedBy}</p>
          </div>
        </div>
        <h1 className="mt-4 text-xl leading-snug font-bold">{view.title}</h1>
        <p className="mt-2 text-sm text-white/85">{summary}</p>
      </header>

      <div className="px-4 pt-4">
        {posterUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element -- blob URL 无法走 next/image */
          <img
            src={posterUrl}
            alt={S.posterAlt}
            className="w-full rounded-2xl border border-stone-200 bg-white shadow-sm"
          />
        ) : failed ? (
          /* canvas 失败降级：仅名称与顺序的清单（同一份最小数据） */
          <div className="space-y-4">
            <p className="text-sm text-stone-500">{S.posterFailed}</p>
            {view.dayPlans.map((day) => (
              <section key={day.dayIndex} className="rounded-2xl border border-stone-200 bg-white p-4">
                <p className="text-sm font-semibold text-stone-900">{S.dayTitle(day.dayIndex + 1)}</p>
                <ol className="mt-2 space-y-1.5">
                  {day.places.map((place, i) => (
                    <li key={`${place.name}-${i}`} className="flex items-center gap-2 text-sm text-stone-700">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-stone-100 text-xs font-semibold text-stone-600">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{place.name}</span>
                      <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-500">
                        {PLACE_TYPE_LABEL[place.type]}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        ) : (
          <p className="flex items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white py-10 text-sm text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {S.posterGenerating}
          </p>
        )}

        {/* 操作区：保存为图片 + 升级引导 */}
        <div className="mt-4 flex flex-col gap-3">
          {blob ? (
            <button
              type="button"
              onClick={saveImage}
              className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50"
            >
              <Download className="h-4 w-4" />
              {S.posterSave}
            </button>
          ) : null}
          <div className="rounded-2xl bg-gradient-to-r from-primary-from/5 to-primary-to/5 p-4">
            {loggedIn ? (
              <>
                <p className="text-xs text-stone-500">{S.viewOnlyTip}</p>
                <Link
                  href={ROUTES.PROFILE}
                  className="mt-3 flex h-10 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-primary-from to-primary-to px-4 text-sm font-semibold text-white hover:brightness-110"
                >
                  <Crown className="h-4 w-4" />
                  {S.goUpgrade}
                </Link>
              </>
            ) : (
              <>
                <p className="text-xs text-stone-500">{S.posterGuestTip}</p>
                <Link
                  href={loginHref}
                  className="mt-3 flex h-10 items-center justify-center rounded-lg bg-gradient-to-r from-primary-from to-primary-to px-4 text-sm font-semibold text-white hover:brightness-110"
                >
                  {S.posterGuestCta}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

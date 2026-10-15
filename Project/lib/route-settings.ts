import { BUSINESS } from '@/config/business';
import { INTERCITY_MODE, LODGING_TYPE } from '@/config/enums';
import { MESSAGES } from '@/config/messages';
import type { IntercityMode, LodgingType } from '@/types';

/**
 * 出行设置（U05 新建 / U08 编辑 / A06 只读）共用的入参校验。
 * 客户端与服务端都调用同一份规则，避免两边枚举、数值各写一套。
 * 返回的字段名与 supabase/migrations/013_p0_modules.sql 的 routes 列一一对应。
 */
export interface TripSettingsColumns {
  origin_city: string;
  intercity_mode: IntercityMode | null;
  lodging_type: LodgingType | null;
  lodging_area: string | null;
  lodging_name: string | null;
  lodging_nights: number | null;
}

export type TripSettingsParse =
  | { ok: true; value: TripSettingsColumns }
  | { ok: false; message: string };

const INTERCITY_VALUES: readonly string[] = Object.values(INTERCITY_MODE);
const LODGING_VALUES: readonly string[] = Object.values(LODGING_TYPE);

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** 空串一律落库为 null，避免 UI 里出现空字符串与 null 两种「未填写」。 */
function nullableText(value: unknown): string | null {
  const t = text(value);
  return t.length > 0 ? t : null;
}

export function parseTripSettings(body: {
  originCity?: unknown;
  intercityMode?: unknown;
  lodgingType?: unknown;
  lodgingArea?: unknown;
  lodgingName?: unknown;
  lodgingNights?: unknown;
}): TripSettingsParse {
  const originCity = text(body.originCity);
  if (!originCity) {
    return { ok: false, message: MESSAGES.ORIGIN_CITY_REQUIRED };
  }

  const intercityRaw = body.intercityMode;
  if (intercityRaw !== null && intercityRaw !== undefined && intercityRaw !== '') {
    if (typeof intercityRaw !== 'string' || !INTERCITY_VALUES.includes(intercityRaw)) {
      return { ok: false, message: MESSAGES.INVALID_PARAMS };
    }
  }
  const intercityMode = (
    typeof intercityRaw === 'string' && INTERCITY_VALUES.includes(intercityRaw) ? intercityRaw : null
  ) as IntercityMode | null;

  let lodgingType: LodgingType | null = null;
  if (body.lodgingType !== null && body.lodgingType !== undefined && body.lodgingType !== '') {
    if (typeof body.lodgingType !== 'string' || !LODGING_VALUES.includes(body.lodgingType)) {
      return { ok: false, message: MESSAGES.INVALID_PARAMS };
    }
    lodgingType = body.lodgingType as LodgingType;
  }

  // 未选住宿类型 = 暂不预订：住宿明细一律不落库
  if (lodgingType === null) {
    return {
      ok: true,
      value: {
        origin_city: originCity,
        intercity_mode: intercityMode,
        lodging_type: null,
        lodging_area: null,
        lodging_name: null,
        lodging_nights: null,
      },
    };
  }

  const nightsRaw = body.lodgingNights;
  const nights =
    typeof nightsRaw === 'number' && Number.isInteger(nightsRaw)
      ? nightsRaw
      : Number.parseInt(String(nightsRaw ?? ''), 10);
  if (
    !Number.isInteger(nights) ||
    nights < BUSINESS.MIN_LODGING_NIGHTS ||
    nights > BUSINESS.MAX_LODGING_NIGHTS
  ) {
    return { ok: false, message: MESSAGES.INVALID_PARAMS };
  }

  return {
    ok: true,
    value: {
      origin_city: originCity,
      intercity_mode: intercityMode,
      lodging_type: lodgingType,
      lodging_area: nullableText(body.lodgingArea),
      lodging_name: nullableText(body.lodgingName),
      lodging_nights: nights,
    },
  };
}

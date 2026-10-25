import { BUSINESS } from '@/config/business';
import { PLACE_TYPE } from '@/config/enums';
import { chatJson } from '@/lib/llm';
import type { PlaceType } from '@/types';

export interface ExtractedPlace {
  name: string;
  type: PlaceType;
  note?: string;
}

/** 提取结果：先给城市，再给地点（地点归属该城市） */
export interface ExtractResult {
  /** 文案里提到的城市名；识别不到时为空字符串 */
  city: string;
  places: ExtractedPlace[];
}

const SYSTEM_PROMPT = `你是旅行地点提取助手。用户会给你一段小红书/抖音的分享文案或链接。
请先从文案里判断"这次要去（或所在地）的城市"，再提取出所有景点和美食地点，只输出 JSON，格式如下：
{"city":"城市名称","places":[{"name":"地点名称","type":"attraction 或 food","note":"一句话说明，可空"}]}
规则：
1. city 只写城市本身（如"成都"），带"市"字要去掉，不要写省、区或商圈；文案里确实没有出现任何城市时返回空字符串 ""。
2. 若文案出现多个城市，取标题或第一句里的那个主要行程城市。
3. type 只能是 attraction（景点）或 food（美食）。
4. 地点名保持文案原文，不要翻译，不要补城市前缀。
5. 提取不到地点时 places 返回 []。
6. 最多返回 ${BUSINESS.MAX_AI_EXTRACT} 个地点。`;

function normalizePlaces(raw: unknown): ExtractedPlace[] {
  const list = (raw as { places?: unknown } | null)?.places;
  if (!Array.isArray(list)) return [];

  const validTypes: PlaceType[] = [PLACE_TYPE.ATTRACTION, PLACE_TYPE.FOOD];

  return list
    .flatMap((item) => {
      const name = String((item as { name?: unknown })?.name ?? '').trim();
      const type = (item as { type?: unknown })?.type;
      if (!name || !validTypes.includes(type as PlaceType)) return [];
      const note = String((item as { note?: unknown })?.note ?? '').trim();
      return [{ name, type: type as PlaceType, note: note || undefined }];
    })
    .slice(0, BUSINESS.MAX_AI_EXTRACT);
}

/** 城市名归一化：去掉「成都市」这类后缀，只留城市名本身 */
function normalizeCity(raw: unknown): string {
  const city = String((raw as { city?: unknown } | null)?.city ?? '').trim();
  return city.replace(/[市区县]$/, '').slice(0, 20);
}

/**
 * 调大模型提取「城市 + 地点」（技术方案 v1.1 §4.3）。
 * T-057：改走 lib/llm.ts chatJson（主模型 45s 超时，失败自动兜底备用模型一次）；
 * 对外签名不变，调用方（/api/ai/extract、/api/try/extract）无感知。
 */
export async function extractPlacesAndCity(text: string): Promise<ExtractResult> {
  const { data } = await chatJson<unknown>({ system: SYSTEM_PROMPT, user: text });
  return { city: normalizeCity(data), places: normalizePlaces(data) };
}

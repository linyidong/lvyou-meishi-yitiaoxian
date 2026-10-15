import { BUSINESS } from '@/config/business';
import { ENV } from '@/config/env';
import { PLACE_TYPE } from '@/config/enums';
import type { PlaceType } from '@/types';

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

export interface ExtractedPlace {
  name: string;
  type: PlaceType;
  note?: string;
}

const SYSTEM_PROMPT = `你是旅行地点提取助手。用户会给你一段小红书/抖音的分享文案或链接。
请从文案中提取出所有景点和美食地点，只输出 JSON，格式如下：
{"places":[{"name":"地点名称","type":"attraction 或 food","note":"一句话说明，可空"}]}
规则：
1. type 只能是 attraction（景点）或 food（美食）。
2. 地点名保持文案原文，不要翻译，不要补城市前缀。
3. 提取不到地点时返回 {"places":[]}。
4. 最多返回 ${BUSINESS.MAX_AI_EXTRACT} 个地点。`;

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

/** 调 DeepSeek 提取地点（技术方案 v1.1 §4.3） */
export async function extractPlaces(text: string): Promise<ExtractedPlace[]> {
  if (!ENV.DEEPSEEK_API_KEY) {
    throw new Error('缺少 DEEPSEEK_API_KEY，请在 .env.local 中配置');
  }

  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ENV.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`DeepSeek HTTP ${res.status}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content ?? '';

  try {
    return normalizePlaces(JSON.parse(content));
  } catch {
    throw new Error('AI 返回内容不是合法 JSON');
  }
}

import { EVENT_NAME } from '@/config/enums';

/** 埋点事件名（E12-E14） */
export type EventName = (typeof EVENT_NAME)[keyof typeof EVENT_NAME];

/** public.events 行 */
export interface EventRow {
  id: string;
  user_id: string;
  event_name: EventName;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

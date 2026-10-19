import { TryResultClient } from '@/components/try/TryResultClient';
import { createClient } from '@/lib/supabase/server';

/**
 * R23 游客试用 · 第 3 步：路线结果（免登录）。
 * 读 sessionStorage 草稿 → 调 /api/try/order 排序算分段 → 地图 + 列表。
 * 服务端判一次登录态：未登录「保存路线」跳登录；已登录「保存这条路线」调 /api/try/promote 落库。
 */
export default async function TryResultPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="pt-2 md:pt-6">
      <TryResultClient loggedIn={Boolean(user)} />
    </div>
  );
}

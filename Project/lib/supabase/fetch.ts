import { BUSINESS } from '@/config/business';

/**
 * 服务端 Supabase 客户端共用的 fetch：强制 cache: 'no-store' + 超时。
 *
 * 一、为什么必须 no-store：Next.js（App Router）会把 fetch 的 GET 请求写入 **Data Cache**，
 * 缓存键是请求 URL（不含查询数据的时刻）。supabase-js 的查询（如
 * `/rest/v1/amap_usage?select=...&day=gte.2026-10-01`）URL 长期不变，于是：
 *   ① 第二次查询起会命中缓存，拿到**永不过期的旧数据**，页面/统计数字直接冻结
 *      （实测：库里已 143124 次，无 no-store 的客户端仍返回 124 次）；
 *   ② 依赖「实时读取」的功能会静默失效 —— 例如高德用量读数偏高时的 95% 熔断降级、
 *      以及 amap_geocode_cache 的新写入在读取端永远看不到。
 *
 * 二、为什么必须加超时：supabase-js 默认没有超时。一旦 Supabase 服务端假死
 * （实测过：TCP 3ms 就能握手成功，但 HTTP 一个字节都不回），请求会**无限挂起**：
 * 登录一直转圈、查库页面一直白屏，且没有任何错误信息，排查时极易误判成
 * 「密码错了」或「前端坏了」。加超时后，同类故障会在 SUPABASE_TIMEOUT_MS 内抛错，
 * 走各调用方已有的错误分支（登录返回 503「服务不可达」），秒级定位。
 *
 * 仅服务端需要（浏览器没有 Next 的这套缓存，也不需要统一超时）。
 */
export function noStoreFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  // 手动用 AbortController 而不是 AbortSignal.timeout/any：middleware 跑在 Edge runtime，
  // 这里只用最基础的 AbortController + setTimeout，两个 runtime 都稳妥。
  const timer = setTimeout(() => {
    // 用与 AbortSignal.timeout 一致的 name/message，让上层现有的「timeout」判定继续生效
    controller.abort(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
  }, BUSINESS.SUPABASE_TIMEOUT_MS);

  // 调用方自带 signal 时叠加而不是覆盖，避免打断原有的取消逻辑
  const outer = init?.signal;
  const relayAbort = () => controller.abort(outer?.reason);
  if (outer) {
    if (outer.aborted) controller.abort(outer.reason);
    else outer.addEventListener('abort', relayAbort, { once: true });
  }

  return fetch(input, { ...init, cache: 'no-store', signal: controller.signal }).finally(() => {
    clearTimeout(timer);
    outer?.removeEventListener('abort', relayAbort);
  });
}

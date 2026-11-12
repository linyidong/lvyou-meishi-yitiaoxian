import { PRODUCT } from '@/config/product';

/**
 * T-092 全站页脚（合规用）
 *
 * 依据：工信部要求已备案网站在页面底部展示 ICP 备案号，并链接到
 * https://beian.miit.gov.cn/ 。备案号来自 `PRODUCT.ICP_NUMBER`（P06）。
 *
 * 说明：
 * - 用户端外壳原设计「无页脚」（见 `app/(user)/layout.tsx` 注释），
 *   这里是为合规新增的最小页脚，不承担导航职责，也不放营销入口。
 * - 备案号未配置（空串/全空白）时只渲染版权行，不渲染空链接，
 *   避免备案号还没下来时页面上出现一个指向工信部的空链接。
 */
export function SiteFooter({ icpNumber = PRODUCT.ICP_NUMBER }: { icpNumber?: string }) {
  const icp = icpNumber.trim();

  return (
    <footer className="border-t border-stone-200 bg-white py-5 text-center text-xs text-stone-500">
      <div className="mx-auto flex w-full max-w-[1536px] flex-col items-center gap-1 px-4 md:px-6">
        <p>
          © {new Date().getFullYear()} {PRODUCT.NAME}
        </p>
        {icp ? (
          <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center px-2 hover:text-stone-700 hover:underline"
          >
            {icp}
          </a>
        ) : null}
      </div>
    </footer>
  );
}

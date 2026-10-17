import { Fragment } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { FLOW_STEP_LABELS } from '@/config/messages';
import { ROUTES } from '@/config/routes';

/**
 * U04-U09 流程步骤条（原型六步：选城市 → 设置路线 → 导入地点 → 勾选地点 → 调整路线 → 查看结果）
 * current 为 1 基步序号；纯展示组件，可在服务端渲染。
 * 原型里该条位于 <main> 之外、通栏贴顶，因此需作为页面内容的第一个元素渲染
 * （组件用负外边距抵消 app/(user)/layout.tsx 里的 main 内边距）。
 * 已完成步骤跳回对应页面（第 1 / 2 步有稳定路由，其余步骤依赖具体路线 id，暂不跳转）。
 */
const STEP_HREFS: readonly (string | null)[] = [
  ROUTES.CITY,
  ROUTES.ROUTE_NEW,
  null,
  null,
  null,
  null,
];

export function FlowSteps({ current }: { current: number }) {
  return (
    <div className="-mx-4 -mt-6 border-b border-stone-200 bg-white md:-mx-6 md:-mt-10">
      <div className="overflow-x-auto px-4 py-3 [scrollbar-width:none] md:px-6 [&::-webkit-scrollbar]:hidden">
        <ol className="flex items-center gap-2 whitespace-nowrap text-xs md:text-sm">
          {FLOW_STEP_LABELS.map((label, index) => {
            const step = index + 1;
            const done = step < current;
            const active = step === current;
            const href = STEP_HREFS[index];

            const circle = done ? (
              <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-xs text-white">
                <Check className="h-3 w-3" />
              </span>
            ) : (
              <span
                className={
                  active
                    ? 'grid h-6 w-6 place-items-center rounded-full bg-gradient-to-r from-primary-from to-primary-to text-xs text-white'
                    : 'grid h-6 w-6 place-items-center rounded-full bg-stone-200 text-xs'
                }
              >
                {step}
              </span>
            );

            const body = (
              <>
                {circle}
                {label}
              </>
            );

            return (
              <Fragment key={label}>
                {done ? (
                  <li className="flex items-center gap-1.5 text-stone-400">
                    {href ? (
                      <Link href={href} className="flex items-center gap-1.5 text-stone-400">
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                ) : (
                  <li
                    className={
                      active
                        ? 'flex items-center gap-1.5 font-semibold text-primary'
                        : 'flex items-center gap-1.5 text-stone-400'
                    }
                  >
                    {body}
                  </li>
                )}
                {step < FLOW_STEP_LABELS.length ? (
                  <li className="h-px w-6 bg-stone-300 md:w-10" aria-hidden />
                ) : null}
              </Fragment>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

import {
  BrainCircuit,
  Database,
  Info,
  Map,
  Monitor,
  Rocket,
  Server,
  type LucideIcon,
} from 'lucide-react';
import { MESSAGES } from '@/config/messages';
import { ROUTES } from '@/config/routes';
import { AdminShell } from '@/components/layout/AdminShell';

/**
 * T-049 管理端「技术栈」页（骨架）：六组分类展示项目所用技术，
 * 条目名称取自项目文档既有事实，具体说明内容待产品提供截图后补充（顶部已注明）。
 * 访问保护：middleware.ts 的 ADMIN_ROUTES 已要求 role=admin。
 */

const M = MESSAGES.ADMIN_TECH_STACK;

const GROUPS: { title: string; Icon: LucideIcon; items: readonly string[] }[] = [
  { title: M.groupFrontend, Icon: Monitor, items: M.items.frontend },
  { title: M.groupBackend, Icon: Server, items: M.items.backend },
  { title: M.groupData, Icon: Database, items: M.items.data },
  { title: M.groupMap, Icon: Map, items: M.items.map },
  { title: M.groupAi, Icon: BrainCircuit, items: M.items.ai },
  { title: M.groupOps, Icon: Rocket, items: M.items.ops },
];

export default function AdminTechStackPage() {
  return (
    <AdminShell currentPath={ROUTES.ADMIN_TECH_STACK} title={M.title} badge={M.badge}>
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs text-sky-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{M.notice}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {GROUPS.map(({ title, Icon, items }) => (
          <section key={title} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Icon className="h-4 w-4 text-slate-500" />
                {title}
              </h2>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                {M.pending}
              </span>
            </div>
            <ul className="mt-3 space-y-2">
              {items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </AdminShell>
  );
}

> 状态：草稿（待 Harness 核对）

# 实施计划（阶段 6 · 任务卡）

> 口径：把 PRD §4.1 的 9 项拆成 11 张任务卡（T-001 起）。执行期 = 阶段 7，**本阶段不写代码**。每张卡 12 要素齐备。通用约束适用于所有卡：不改 `Project/.env.local`、不动生产数据、不删既有功能/校验/测试、文案进 `Project/config/messages.ts`、游客/普通两套实现各改各的（不合并）、改动后必须 `cd Project && npm run typecheck` 通过并在汇报区分「已通过/失败/未执行/未覆盖」。
> 排序依据：P0 转化/安全优先；T-001/T-003 无前置可并行先行；T-004 依赖 T-003 展示口径；T-010 依赖用户批准。

---

## T-001 A5 修复：删死接口 + landmarks 加登录校验（P0）

- **目标**：关闭两个匿名可刷的高德代理口，止住额度泄漏。
- **前置条件**：无（用户 2026-10-21 已拍板，Q-001/`docs/decisions.md` D-010）。
- **涉及模块/文件/符号**：删除 `Project/app/api/amap/search/route.ts`（整目录）；`Project/app/api/amap/landmarks/route.ts`（handler `:27` 前部）；参照模式 `Project/app/api/collected/route.ts:14` 的 `createClient()+getUser` 写法。
- **允许修改范围**：上述两个 route 文件；如 `docs/api-contract.md` 等文档同步。
- **明确禁止**：不改 `Project/lib/amap.ts` 的 `searchPlaces` 本体（服务端内部仍被 seed-demo/extract 使用）；不动 landmarks 的熔断判断与业务逻辑；不新增环境变量。
- **实施步骤**：① `grep -rn "api/amap/search" Project/app Project/components Project/lib` 复核零调用方（结果贴汇报）；② 删目录；③ landmarks 加 `getUser`，未登录返回 401 + `MESSAGES.LOGIN_FIRST`；④ typecheck；⑤ `curl` 匿名 POST 两接口取证。
- **验收标准**（PRD §4.1 修复-A5、§10 安全）：匿名 POST `/api/amap/landmarks` → 401；`/api/amap/search` → 404；登录用户周边知名地点懒加载功能不变。
- **自动化测试**：`npm run typecheck`（预期 exit 0）；`curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/amap/landmarks`（预期 401）。框架引入后补 vitest 401 断言（挂 T-010）。
- **人工验收**：登录态打开路线结果页 → 点「周边知名地点」→ 正常出列表；退出登录重复操作 → 不请求、无报错弹窗（入口本身仅登录后可见）。
- **失败恢复**：代码回滚 `git revert`；无配置/数据变更。
- **完成后更新**：`docs/api-contract.md`（两行改状态）、`docs/feature-status.md` F-50→已修、`docs/known-issues.md` A5 关闭、`docs/progress.md` 任务表。
- **风险等级**：低。**需用户批准**：否（已决策）。

## T-002 城市清单一致性验证（P2，工作量≈0，原卡已按 P6B 更正）

> 更正说明（2026-10-21 00:50）：原卡基于「`cities.ts` 104 城 vs 库内 92 城」的错误前提。经 TypeScript 编译求值，`CITIES` 真值 **92**、`CITY_PINYIN` **92**，与库内 `cities` 92 行、迁移 `011_seed_cities.sql` 92 条**完全一致**，不存在错位。原 104 系 `grep -c "name: "` 把 CityCard 的非城市名字段计入所致。**B9 已撤销**。

- **目标**：确认三处城市数据源一致，并留下可复现的计数方法，防止再次误判。
- **前置条件**：无。
- **涉及**：`Project/config/cities.ts`（`CITIES` / `CITY_PINYIN` / `CITY_CARDS` / `HOT_CITIES` 四个导出）；`Project/supabase/migrations/011_seed_cities.sql`；库内 `cities` 表（只读 SELECT）。
- **允许**：新增一个只读校验脚本（如 `Project/scripts/check-cities.mjs`）；修正 `cities.ts` 头部注释的表述（若确需）。
- **禁止**：不删除 `cities.ts` 任何条目；不改 `011` 迁移；不写库。
- **步骤**：① 用 TS 编译求值统计 `CITIES.length`；② 只读查库 `cities` 行数；③ 数 `011` seed 条数；④ 三者比对输出；⑤ 结果写入 `docs/data-model.md` 待确认节。
- **验收标准**：脚本输出「三处计数一致 = 92」；`/city` 页与出发城市搜索功能不变。
- **自动化**：`node Project/scripts/check-cities.mjs`（预期输出 92/92/92，exit 0）。
- **人工验收**：打开 `/city` 看城市数量与首页热门城市徽章正常。
- **失败恢复**：仅新增脚本，`git revert` 即可。
- **完成后更新**：`docs/known-issues.md`（B9 已关闭）、`docs/data-model.md`、`docs/progress.md`。
- **风险等级**：低。**需用户批准**：否。

## T-003 后台会员到期可见（P1）

- **目标**：用户列表按 `member_until` 显示「有效/已过期/永久」，过期禁用无效操作（PRD Q7、§6）。
- **前置**：无。
- **涉及**：`Project/components/admin/AdminUsersClient.tsx`（543 行，直读 `member` 处）；判定函数复用 `Project/lib/member-quota.ts:78` `isMemberActive`（客户端可用形态或本地同口径实现——**注意**：该函数在 lib，components 允许 import lib 纯函数，不违反分层）；`Project/app/api/admin/*` 返回字段若缺 `member_until` 则补 select 列。
- **允许**：AdminUsersClient 展示逻辑、相关 admin API 的 select 字段。
- **禁止**：不改 `users` 表数据；不改 `isMemberActive` 语义；不在前端写「强制改 member」的新操作。
- **步骤**：① 定位列表数据源与 `member` 直读点；② 增加到期判定列（徽章三态）；③ 过期行禁用「续期前无效」的操作按钮（如重复授予）；④ typecheck + 走查。
- **验收标准**（PRD §4.1 修复-3、§6 后台用户列表）：`member=true` 且 `member_until` 已过期的用户在后台显示「已过期」而非「会员」。
- **自动化**：typecheck；（T-010 后）vitest 对判定函数三态单测。
- **人工验收**：用户进 `/admin/users`，看测试账号（可临时把某测试号 `member_until` 改过去——属写操作需报备，或等 T-004 造数）显示「已过期」。
- **失败恢复**：`git revert`。
- **完成后更新**：`docs/feature-status.md`、progress.md。
- **风险等级**：低。**需用户批准**：否。

## T-004 F-51 会员到期定时任务（P1）

- **目标**：到期自动把 `users.member` 写回 false，不依赖用户访问（PRD Q7「要真定时任务」）。
- **前置**：① 只读验证 pg_cron 可用性（`SELECT name FROM pg_available_extensions WHERE name='pg_cron'`）→ 定 A/B 方案；② **写库操作报备**（AGENTS.md §5.1：影响范围=users 表 member 字段、备份=执行前 SELECT 快照、回滚=按快照 UPDATE）；③ 用户批准方案与精度（小时级）。
- **涉及**：方案 A：新增 `Project/supabase/migrations/026_member_expire_cron.sql`（`CREATE EXTENSION pg_cron` + `cron.schedule('member-expire', ...)` + 到期 UPDATE + `member_logs` 留痕）；方案 B：`Project/scripts/member-expire.mjs`（读 `.env.local` 的 service_role，POST `/pg/query`）+ Windows 计划任务注册说明（用户手工一次）。`Project/config/enums.ts` 可能新增 `member_logs.type='expire'` 枚举。
- **允许**：仅新增上述文件/迁移；users 表 member 字段的定时 UPDATE。
- **禁止**：不改 `member_until`；不碰 `auth.users`；不 DROP/TRUNCATE；不改 RLS 与触发器（写回有意以 null `auth.uid()` 放行，不新增绕过）；管理员（`member_until` IS NULL）不得被命中。
- **步骤**：① 验证扩展 → 选 A/B；② 写迁移/脚本 + 反向 SQL；③ 备份 users 全表快照（3 行）；④ 测试账号造一条已过期 member=true → 触发任务 → 核对写回与 member_logs；⑤ 恢复测试数据；⑥ 更新文档。
- **验收标准**（PRD §4.1 新增-F51、§7-4）：过期后**无任何用户访问**的情况下，`users.member` 在一个调度周期内变 false；永久会员与管理员不受影响；`isMemberActive` 读取侧行为不变（双保险）。
- **自动化**：typecheck；SQL 断言脚本（SELECT 核对行数前后差）；（T-010 后）E2E 可跳过——以 SQL 取证为准。
- **人工验收**：用户看 `/admin/users` 中测试号从「会员」变「已过期」（与 T-003 联动）。
- **失败恢复**：A：`SELECT cron.unschedule('member-expire')` + revert 迁移记录；B：注销计划任务 + 删脚本；数据：按备份快照 UPDATE 还原（成员仅 3 用户，可逐行还原）。
- **完成后更新**：`docs/data-model.md`（迁移链 +026）、`docs/architecture.md` 不动（现状文档）、`target-architecture.md` §3.2 标记已执行、progress.md 变更摘要（含完整命令与时间戳）。
- **风险等级**：高（库写 + 调度通道）。**需用户批准**：**是**（方案、精度、写库报备三件套）。

## T-005 F-50 一键复位 · 游客结果页（P0）

- **目标**：`/try/result` 手动调序后可一键还原系统初始顺序，零接口零额度（PRD Q5、§7-5）。
- **前置**：无。
- **涉及**：`Project/components/try/TryResultClient.tsx`（736 行；初始顺序来源 = `/api/try/order` 响应的 ordered 列表；既有回路 draftRef `:261/:269`、sessionStorage `saveTryDraft`、排序同步 `:436/:474`）。
- **允许**：该组件内新增初始快照 ref + 复位按钮 + 顺序还原逻辑；`messages.ts` 新增文案常量。
- **禁止**：不调任何 API；不合并两套结果页组件；不引入新 state 通道触发重排 effect（D-04 教训——复位走与手动调序相同的通道即可，不 `setDraft`）；不改 `/api/try/order`。
- **步骤**：① 首次 order 响应到达时存 `initialOrderRef`；② 当前顺序与快照不等时启用「一键复位」按钮；③ 点击 → 复用手动调序同一还原路径写回顺序 state + sessionStorage 草稿（与调序同语义）→ 地图重绘；④ typecheck + 走查。
- **验收标准**（PRD §4.1 新增-F50、§6）：调序后按钮出现且可点；点击后顺序 = 系统推荐顺序；Network 面板零请求；刷新后草稿保留复位结果；未调序时按钮禁用/隐藏。
- **自动化**：typecheck；人工核对 Network 零请求（截图证据）。
- **人工验收**：游客走三步 → 结果页拖 2 下 → 点复位 → 顺序回到初始；再保存转正后库内顺序 = 复位后顺序。
- **失败恢复**：`git revert`；无数据/配置影响。
- **完成后更新**：`docs/feature-status.md`、`docs/open-questions.md` Q-011（复位覆盖页面=两页，本卡+T-006 关闭）、progress.md。
- **风险等级**：低。**需用户批准**：否。

## T-006 F-50 一键复位 · 普通/会员结果页（P0）

- **目标**：`/route/[id]` 结果页同款复位能力（与 T-005 同口径，两套实现各做一遍——用户 Q6 保留双实现）。
- **前置**：T-005 交互定稿（按钮文案/位置/禁用态沿用同一 `MESSAGES` 常量）。
- **涉及**：`Project/components/route/RouteResultClient.tsx`（1930 行；初始顺序来源 = 路线加载时的 `route_places` 顺序或最近一次 `/api/amap/order` 响应，**取哪个为「系统初始」需在实现时按页面数据流定，倾向 = 页面挂载时的顺序快照**）。
- **允许**：该组件内本地快照 + 复位逻辑。
- **禁止**：复位动作本身不调 PUT（保存由用户显式触发，与现状一致）；不动 dnd-kit 既有排序逻辑。
- **步骤**：同 T-005（挂载快照 → 比较 → 还原 → 地图同步）。
- **验收标准**：同 T-005；另加「复位后不保存直接离开，库内顺序不变」。
- **自动化**：typecheck。
- **人工验收**：会员路线详情页调序 → 复位 → 不保存退出 → 重进显示原库顺序；保存后重进显示复位顺序。
- **失败恢复**：`git revert`。
- **完成后更新**：同 T-005。
- **风险等级**：低（但文件巨大，改动需精准定位）。**需用户批准**：否。

## T-007 F-52 分享分级（P0）

- **目标**：非会员/游客打开 `share/[token]` 只看路线图片+升级引导；会员看完整路线可导入（PRD Q10、§5-4、§6）。
- **前置**：**用户批准图片信息粒度**（`target-architecture.md` §3.3 决策点：推荐「图含地点名序列与路线形状，不含地址/坐标/分段里程/住宿」）。
- **涉及**：`Project/app/share/[token]/page.tsx`（8/:20/:54 service_role 直查处——保留直查形态，加分支）、`Project/lib/route-share.ts:69`（`buildRouteSnapshot` 增裁剪变体）、`Project/lib/route-poster.ts:99`（精简版渲染复用）、新增分享页两套渲染组件；`Project/config/messages.ts` 引导文案。
- **允许**：share 页身份判定与 payload 裁剪；新组件文件；poster 精简渲染参数。
- **禁止**：不改 `POST /api/shares/[token]/import` 的会员校验（已正确）；不把完整快照发给非会员浏览器（数据层付费墙，禁止「前端隐藏」实现）；不改 route_shares 表结构（若需存图另议——本计划不存图，客户端渲染）。
- **步骤**：① 页内 `getUser` 判身份；② 会员 → 现完整渲染不动；③ 非会员/游客 → 服务端只组装裁剪快照 → 客户端渲染精简海报图 + 「注册后可导入完整路线」按钮（`/login?redirect=/share/[token]`）与「会员可导入」升级说明（→ `/profile`）；④ 加载/无效链接/已撤销三态文案沿用现有并补分级态；⑤ typecheck + 三身份走查。
- **验收标准**（PRD §4.1 新增-F52、§11 差距表）：游客/普通用户打开链接看不到地址、坐标、分段里程（view-source 与 Network 均无完整 JSON）；会员功能不变；导入按钮仅会员可用。
- **自动化**：typecheck；`curl` 无 cookie 抓页面 HTML grep 地址字段应为空（取证贴汇报）；（T-010 后）Playwright 三身份用例。
- **人工验收**：用户用会员账号生成分享链接 → 无痕窗口打开只见图+引导 → 登录普通号同 → 会员打开完整+导入成功。
- **失败恢复**：`git revert`（无数据迁移，旧链接行为随代码回滚恢复）。
- **完成后更新**：`docs/api-contract.md`（share 页说明）、`feature-status.md` F-08 增补、progress.md。
- **风险等级**：中（转化主链路 + 数据裁剪正确性）。**需用户批准**：**是**（粒度决策）。

## T-008 转化链路打磨（P0）

- **目标**：看完路线即知如何付费——保存成功后的会员权益条、配额触顶引导、`/profile` 到期状态（PRD 痛点 5、§6）。
- **前置**：T-003（到期口径组件可复用）；无其他。
- **涉及**：`Project/components/route/RouteResultClient.tsx` 与 `Project/components/try/TryResultClient.tsx`（保存成功回调处挂同一新组件 `MemberUpsellBar`【新文件，允许】）；配额 403/429 文案消费点（`Project/config/messages.ts` 现常量 + 前端提示处）；`Project/components/profile/MemberCard.tsx`（补到期日/已过期显示）。
- **允许**：新组件文件、文案常量、三处挂载。
- **禁止**：不改配额数值（`limitsOf` 单点，known-issues A1）；不新增支付通道/接口；游客工具栏口径不动（铁律 1）。
- **步骤**：① 抽 `MemberUpsellBar`（按身份显示剩余额度/升级入口，会员不显示）；② 两结果页保存成功后挂载；③ 配额触顶提示统一跳 `/profile`；④ MemberCard 补三态（有效/到期日/已过期）；⑤ typecheck + 走查。
- **验收标准**（PRD §4.1 打磨-1、§5-3）：免费用户保存第 2 条路线当日再新建 → 触顶提示含升级入口；结果页保存后出现权益条；会员不出现。
- **自动化**：typecheck。
- **人工验收**：用户以免费号走一遍「试用→注册→保存→触顶→进收银台」，检查每步引导可见、链接可达。
- **失败恢复**：`git revert`；新组件独立文件易摘除。
- **完成后更新**：`feature-status.md`、progress.md。
- **风险等级**：低。**需用户批准**：否（文案上线前用户过目即可，不阻塞）。

## T-009 手机端体验打磨（P1）

- **目标**：按用户真机走查勾选的清单逐项修复手机端体验（PRD 痛点 4、§10 兼容性）。
- **前置**：**用户先完成一轮真机走查并勾选问题项**（候选：结果页地图高度、列表热区、收银台弹层滚动、底部导航安全区、导航唤起兜底提示时机）。
- **涉及**：勾选后确定（预计 `Project/components/map/AmapMap.tsx`、`components/route/*`、`components/layout/MobileNav.tsx`、`components/profile/MemberCard.tsx` 收银台弹层）。
- **允许**：勾选清单内的样式与交互小改。
- **禁止**：不做响应式大重构；不改桌面端布局（现状保持）；不引入新 UI 库。
- **步骤**：① 走查清单确认 → 拆子卡；② 每项独立 commit；③ 真机回归。
- **验收标准**：用户勾选的每一项在真机（iOS Safari + Android Chrome 各一）复验通过。
- **自动化**：typecheck；无（UI 项以截图为准）。
- **人工验收**：用户手机实测逐项勾选「已解决」。
- **失败恢复**：逐项 `git revert`。
- **完成后更新**：`feature-status.md`、progress.md。
- **风险等级**：中（范围未定）。**需用户批准**：**是**（清单确认后才开工）。

## T-010 核心链路自动化测试（P1）

- **目标**：登录 / 游客试用 / 保存路线三条链路建立可重复的自动化回归（PRD §4.1 工程、§12）。
- **前置**：**用户批准引入 vitest + @playwright/test**（改 `Project/package.json` devDependencies，Q-005；未批准前本卡不执行，默认验收仍走 typecheck+人工）。
- **涉及**：新增 `Project/vitest.config.ts`、`Project/tests/unit/*.test.ts`（`Project/lib/route-order.ts` 纯函数、`Project/lib/member-quota.ts` 判定、`Project/lib/guest-rate-limit.ts` 桶逻辑）、`Project/tests/e2e/*.spec.ts`（Playwright 三链路，指向本地 dev server）、`package.json` scripts 增 `test`/`test:e2e`。
- **允许**：仅新增测试目录/配置与 package.json devDeps+scripts。
- **禁止**：不改任何业务源码来「迁就测试」；不删既有校验；E2E 不连生产库（本地 Supabase 测试账号）；不在 CI 使用（本期无 CI）。
- **步骤**：① 批准后装依赖；② 单测先行（零环境依赖）；③ E2E 三链路脚本（游客三步含限流桶断言用持久 cookie 模式——历史教训：不带 cookie jar 的循环无效）；④ 跑通并写入 `docs/setup-and-run.md` 测试命令节。
- **验收标准**（PRD §12）：`npm run test` 绿；三条链路 E2E 各 1 条主路径用例 + 1 条失败路径用例可重复执行；后续任务卡可引用其作为回归门禁。
- **自动化**：本卡即自动化；执行证据 = 命令输出与用例清单。
- **人工验收**：用户本地跑一次 `npm run test` 看绿。
- **失败恢复**：`git revert` 依赖与配置提交（业务代码零改动，可干净摘除）。
- **完成后更新**：`docs/setup-and-run.md`、`docs/acceptance-test-plan.md` 状态列、progress.md。
- **风险等级**：中（新依赖与 macOS 沙箱兼容性，历史教训 Trae 3.4.2）。**需用户批准**：**是**（依赖引入）。

## T-011 幂等与并发审计（订单重复提交 / 保存路线）（P1）

- **目标**：关闭 PRD §7-6 `[待确认]`——核对订单重复提交与路线保存并发下的现状强度，输出结论并按需加固。
- **前置**：无（只读审计先行）。
- **涉及**：`Project/app/api/member/orders/route.ts:28`（待核销上限 `:66-71` 是否等价幂等）、`Project/app/api/routes/[id]/places/route.ts:26`（数量一致性校验为既有防线）、`Project/app/api/try/promote/route.ts`（重复转正是否产生双路线）、`Project/lib/guest-rate-limit.ts`（并发计数）。
- **允许**：审计文档回填；若确认缺陷，小改（如同用户同档位 pending 单去重条件）需另立子卡并报备。
- **禁止**：不在审计卡里直接改业务逻辑；不加分布式锁（内存 Map 边界内解决或不解决）。
- **步骤**：① 读三处代码列出现状行为矩阵；② 本地双开浏览器并发提交取证（curl 双发）；③ 结论写 `docs/decisions.md` 新条目或 `known-issues.md`；④ 需加固项单独拍板。
- **验收标准**（PRD §7-6）：三场景（重复下单/重复转正/并发保存顺序）各有「现状行为 + 是否可接受 + 处置」书面结论。
- **自动化**：curl 双发取证命令贴汇报。
- **人工验收**：用户读结论，决定是否立加固卡。
- **失败恢复**：纯文档，无。
- **完成后更新**：PRD §7-6 去 `[待确认]`、`docs/open-questions.md`。
- **风险等级**：低。**需用户批准**：否（审计）；加固子卡另议。

---

## 卡间依赖与执行顺序建议

```
T-001 ─┐
T-003 ─┼→ T-004（依赖 T-003 展示口径）
T-005 ─→ T-006（复用交互定稿）
T-007 ─→ T-008（引导组件可共用 MemberUpsellBar 思路）
T-002、T-009、T-010、T-011 独立
```
P0 优先：T-001 → T-005/T-006 → T-007 → T-008；P1：T-003 → T-004、T-002、T-010、T-011、T-009。

## 证据来源

- `docs/项目需求文档PRD.md` §0（Q3-Q10）、§4.1/4.2/4.3、§5、§6、§7、§12。
- `docs/target-architecture.md`（本阶段配套）、`docs/architecture.md` §6 技术债编号、`docs/feature-status.md` F-50/F-51/F-08、`docs/api-contract.md`（各 route 行号）、`docs/data-model.md` §4（触发器放行）、`docs/decisions.md` D-04/D-08/D-10/D-11。
- 源码行号内联于各卡「涉及」栏。
- 历史教训：curl 持久 cookie 验证限流、macOS 沙箱兼容、写库报备四件套（project_memory / AGENTS.md §5.1）。

## 待确认事项

1. T-002 方向（裁配置 vs 补库）与 T-004 方案（pg_cron vs 宿主任务）、T-007 图片粒度、T-009 清单、T-010 框架批准——共 5 处用户决策点，均已标「需用户批准」。
2. T-006「系统初始顺序」定义（页面挂载快照 vs 最近一次系统重排结果）在实现时按数据流确认，倾向前者。
3. T-010 Playwright 在当前 macOS/Trae 环境的可运行性未预验证；失败则回退「vitest 单测 + 手工 E2E 清单」。

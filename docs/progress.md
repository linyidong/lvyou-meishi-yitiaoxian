# 项目进度看板

> **唯一进度事实源**：阶段、门禁、任务、下一步、阻塞都以本文件为准。聊天记录、Trae 自述、交接摘要都不能替代它。
> 更新时机：每个阶段开始/结束、每个任务开始/验收后、出现阻塞或决策时。

## 1. 当前状态（一眼看懂）

- 当前阶段：阶段 7 逐任务开发
- 阶段状态：进行中（3 个任务完成，2 个待走查）
- 当前门禁：G1–G5 已通过；**G6 待首个任务验收**
- 当前任务：T-001 已完成（等用户终验）；T-005/T-006（两页一键复位）实施完成，等用户人工走查
- 任务状态：T-005/T-006 待验收（拖序→复位交互需真人浏览器走查，无 playwright）；T-001 登录态 200 需人工确认
- 下一步：用户走查 T-005/T-006 复位与 T-001 周边知名地点；通过后派下一卡（T-007 需先批分享图片粒度）
- 阻塞：无（`next build` 已完整通过：lint 修复 T-012 + 预渲染 RSC 传参修复 T-013）
- 最近更新：2026-10-21 23:50（本机）

**状态行**（每次汇报第一行）：

```text
【阶段 7 · G6 待终验 · 任务：T-007 待启动 · 下一步：定分享图片粒度 → 派 T-007】
```

## 2. 阶段进度

| 阶段 | 名称 | 状态 | 关键产出 | 最近更新 |
|---|---|---|---|---|
| 0 | 准备 | 已完成 | 备份、基线 tag、CodeGraph 索引、`AGENTS.md`、`docs/` 骨架 | 2026-10-20 22:16 |
| 1 | 接管与只读安全审计 | 已完成 | `existing-project-audit.md` | 2026-10-20 22:43 |
| 2 | CodeGraph 代码地图 | **已完成** | `module-map.md`（448 行） | 2026-10-20 23:24 |
| 3 | 深度理解现状 | **已完成** | `tech-stack.md`、`setup-and-run.md`、`known-issues.md`、`人工参数与环境配置.md`、`project-brief.md`（草稿）、`open-questions.md` | 2026-10-20 23:58 |
| 4 | 反向恢复项目文档 | **已完成** | 7 份文档（简报/架构/功能状态/数据模型/接口契约/决策/环境配置） | 2026-10-21 00:12 |
| 5 | 需求访谈与 PRD | **已完成** | `项目需求文档PRD.md`（10 问 + F-50/51/52） | 2026-10-21 00:40 |
| 6 | 目标架构与实施计划 | **已完成** | 三份计划 + P6B 只读理解（差异 D1–D5 已处理） | 2026-10-21 00:58 |
| 7 | 逐任务开发 | **进行中** | T-001 规范已写，等实施计划 | 2026-10-21 01:00 |
| 6 | 目标架构与实施计划 | 未开始 | `target-architecture.md`、`implementation-plan.md`、`acceptance-test-plan.md` | —— |
| 7 | 逐任务开发 | 未开始 | `tasks/T-00X.md`、commit | —— |
| 8 | 验收、部署与上线 | 未开始 | 验收结果、`deployment.md` | —— |
| 9 | 运营维护与下一轮 | 未开始 | `operations.md` | —— |
| 收尾 | 交接与项目总结 | 未开始 | `PROJECT_SUMMARY.md` | —— |

## 3. 门禁状态

| 门禁 | 位置 | 状态 | 证据/说明 |
|---|---|---|---|
| G1 | 阶段 1 → 2 | **通过** | 备份含 `.env.local`（315 文件）；基线 tag `baseline-before-takeover`；`git status` 干净（仅 1 个未跟踪残留）；阶段 1 四问齐全并经 Harness 独立复核 |
| G2 | 阶段 2 → 3 | **通过** | `module-map.md`：入口 55/55 逐文件核对、4 条调用链、影响面样例（MCP+CLI）、四类标记齐全；Harness 抽查 5 处符号行号与 2 组 callers 全部一致 |
| G3 | 阶段 3 → 4 | **通过** | 抽查 5 项全过：技术栈版本 vs lock、A5 无鉴权确认、limitsOf 14 调用方、tsc exit 0、无密钥泄漏；数据库侧由 Harness 直连只读补证（14 表 + RLS 实测） |
| G4 | 阶段 5 → 6 | **通过** | 用户 2026-10-21 确认 PRD 范围与成功标准 |
| G5 | 阶段 6 → 7 | 未通过 | 待用户批准架构/计划/验收计划 + Trae 只读理解报告 |
| G6 | 每个任务 → 下一个 | **部分通过** | T-001 diff/typecheck/401/404 全过；登录态 200 待用户人工验收 |
| G7 | 阶段 8 → 生产 | 未通过 | 待部署与回滚演练 |

## 4. 任务进度

| ID | 目标 | 状态 | 开始 | 完成 | commit | 验收证据 | 备注 |
|---|---|---|---|---|---|---|---|
| T-001 | A5 修复：删死接口 + landmarks 加登录 | **实施完成（待用户验收）** | 2026-10-21 01:00 | 2026-10-21（本机 00:58） | `ee0c4ea`（Harness 已提交） | typecheck exit 0；匿名 curl：landmarks→401、search→404（实测）；登录态 200 **未执行**（无测试账号，用户人工验收） | 风险低；改动=删 search 目录 + landmarks 加鉴权分支（+9 行）+ 4 份 docs 同步 |
| T-005 | F-50 一键复位 · 游客结果页 | **实施完成（待用户验收）** | 2026-10-21 01:04 | 2026-10-21（本机 01:10） | `5131d6c` | typecheck exit 0；`/try/result` dev 实测 200（编译无错误）；复位函数体 grep 无 fetch、diff 无新增 setDraft、`/api/try/order` 未动（实测）；拖序→复位真实交互与 Network 零请求 **未执行**（需真人浏览器，无 playwright，用户走查） | 风险低；改动=TryResultClient +45 行（快照 ref/派生 orderDirty/resetOrder/常驻禁用态按钮）+ messages 2 常量 + 3 docs |
| T-006 | F-50 一键复位 · 普通/会员结果页 | **实施完成（待用户验收）** | 2026-10-21 01:14 | 2026-10-21（本机 01:26） | 未 commit（待 Harness 验收后提交） | typecheck exit 0；`next build` webpack「Compiled successfully」（lint 失败点为既有 `ImportCollectClient:374`，非本次引入）；dev 实测 /login、/try/result 200，/route/[id] 307 登录墙符合预期；resetOrder 函数体 grep 零 fetch/syncRoute（实测）；登录态渲染与拖序→复位交互 **未执行**（无测试账号/playwright，用户走查） | 风险低；口径=方案 B（用户裁决：复位=界面还原+既有 saveOrder 落库一次，不耗高德额度）；改动=RouteResultClient +~50 行（快照 ref/写入点/orderDirty/resetOrder/常驻按钮），messages.ts 零改动（复用 TRY.RESULT），4 docs 同步 |
| T-012 | build lint 阻塞修复（useSample→applySample 重命名） | **已完成** | 2026-10-21 | 2026-10-21 | 未 commit（待 Harness 验收后提交） | lint exit 0（0 error / 3 既有 warning）；build 推进到预渲染阶段后死于 `/admin/orders` RSC 传参（新阻塞，按派单条款停手上报→催生 T-013） | 改动仅 ImportCollectClient.tsx 2 行 |
| T-013 | build 预渲染阻塞修复（AdminErrorState icon 改 ReactNode） | **已完成** | 2026-10-21 23:44 | 2026-10-21（本机 23:50） | 未 commit（待 Harness 验收后提交） | lint exit 0；`npm run build` **完整成功 exit 0**（Compiled successfully + 41/41 静态页 + 全 Route 表）；AdminErrorState 实际 7 处调用点（派单清单 5 处 + 漏掉的 admin/page:177、routes:39，不改则类型检查必失败）；AdminEmptyState 同型运行时隐患**未修**（不挡 build，已上报） | 改动=8 代码文件 +11/−10（AdminState.tsx + 7 页面） |

## 5. 阻塞与待确认

| 阻塞/问题 | 影响任务 | 需要谁处理 | 状态 |
|---|---|---|---|
| A5：两个高德代理 API 无鉴权 | 影响成本与阶段 8 上线 | **已决策**：删死接口 + landmarks 加鉴权 | 排入阶段 7 |
| `Project/public/750x750png` 无扩展名残留 | 无（不阻塞） | 用户决定 删/改名/保留 | 待确认 |
| 本地 11 笔提交未 push | 无（不阻塞） | 用户决定（Q-006） | 待确认 |
| 仓库无自动化测试框架 | 阶段 7–8 验收 | 用户决定是否引入（Q-005） | 待确认 |
| B9 城市清单 104 vs 库内 92 | 出发城市/导入匹配 | 用户（Q-009） | 待确认 |

> 需要产品决策的问题已写入 `open-questions.md`（Q-001…Q-008）。

## 6. 最近变更摘要

- 2026-10-21 23:50（本机）：T-013 实施完成——`AdminState.tsx` 的 `AdminErrorState` icon prop 由 `LucideIcon`（组件函数）改为 `ReactNode`，内部渲染 `<Icon/>` 改 `{icon}`；全部 7 处服务端调用点（orders/places/imports/users/online + 派单清单外的 admin/page、routes）改为传元素 `<DatabaseZap className="mx-auto h-12 w-12 text-red-400" />`（online 用 `Unplug`）；lint exit 0；**`npm run build` 完整成功 exit 0**（41/41 静态页 + 全 Route 表），build 阻塞链（T-012 lint → T-013 预渲染）全部解除；`AdminEmptyState`（admin/page:179 传 `BarChart3`）同型运行时隐患未修不扩大范围，待 Harness 决策
- 2026-10-21 01:26（本机）：T-006 实施完成（方案 B，用户裁决）——`RouteResultClient.tsx` 新增 `initialOrderRef` 快照（写入点=syncRoute 竞态守卫后且 reorder=true，覆盖 boot 与切出行方式两个系统重排入口，手动调序不更新）+ 渲染期派生 `orderDirty`（`orderKeyOf` 比对，不加 state）+ `resetOrder()`（还原 localDays/dayLegs/customStartIds/estimated → 调既有 `saveOrder()` 防抖 PUT 落库一次；函数体零 fetch、不调 syncRoute、不触发重排）+ 列表头常驻按钮（disabled=未偏离/navBusy/保存中/无快照）；文案复用 `MESSAGES.TRY.RESULT`（messages.ts 零改动）；typecheck exit 0；build 编译通过（lint 挡点为既有问题）；登录态渲染与真实交互待用户走查
- 2026-10-21 01:10（本机）：T-005 实施完成——`TryResultClient.tsx` 新增 `initialOrderRef` 系统推荐快照（仅 order 响应/重新生成时写入，手动调序不更新）+ 渲染期派生 `orderDirty` + `resetOrder()`（零请求：`setResult` 浅拷贝快照 + `draftRef`/`saveTryDraft` 同步草稿，不 setDraft，D-04）+ 列表头行常驻「一键复位」按钮（未偏离/reordering/无快照时 disabled）；`messages.ts` TRY.RESULT 新增 `resetBtn`/`resetDone`（未动 ROUTE_RESULT）；typecheck exit 0；dev 实测 `/try/result` 200；真实拖序交互待用户走查
- 2026-10-21 00:58（本机）：T-001 实施完成——删 `Project/app/api/amap/search/` 整目录；`landmarks/route.ts` 读 body 前加 `auth.getUser()`，未登录 401 + `MESSAGES.LOGIN_FIRST`（`message` 字段，同 collected 惯例）；typecheck exit 0；匿名 curl 实测 landmarks=401 / search=404；同步 api-contract/feature-status/known-issues（A5 关闭）/progress 四文档；登录态 200 未执行（无测试账号）
- 2026-10-20 22:12：建立盘外完整备份（含 `.env.local`）
- 2026-10-20 22:20：提交接管前遗留的 997 行试用流程修复（`17e646a`），打基线 tag `baseline-before-takeover` → `c6be7ca`
- 2026-10-20 22:25：装 CodeGraph 1.6.2 并建索引（145 文件 / 2,364 节点 / 5,220 边）
- 2026-10-20 22:36：网关授权切到本项目，派发阶段 1 只读审计（`tj_20261020-223621_bnsk`）
- 2026-10-20 22:43：阶段 1 通过，产出审计报告；独立复核抓到路由数 56→55
- 2026-10-20 23:05：流程手册升级 v2（进度看板 / 四类证据 / 文档改名），项目文档同步迁移
- 2026-10-20 23:11：CodeGraph MCP 打通（根因：GUI PATH 无 node + 工具名带 mcp_ 前缀），P0 自检通过
- 2026-10-20 23:12：派发 P2 建立代码地图
- 2026-10-20 23:38：用户授权连自建 Supabase（只读自由、写操作需报备+备份+回滚）；派 P3
- 2026-10-21 01:34：T-006 实施完成（方案 B：复位+落库一次），T-005/T-006 均待用户走查
- 2026-10-21 01:10：T-001 实施完成并自测通过（typecheck exit 0 / 匿名 landmarks 401 / search 404），待用户终验
- 2026-10-21 00:52：P6 交付三份计划（11 张任务卡）；P6B 只读理解通过并抓出 5 处差异；**撤销 B9 误报**（CITIES 真值 92=92=92）
- 2026-10-21 00:40：需求访谈 10 问完成，PRD 可评审版产出；新增 F-50（一键复位）/F-51（会员到期定时任务）/F-52（分享分级）
- 2026-10-21 00:12：P4 交付 7 份文档（692 行），核对通过；发现 B9 城市清单 104 vs 92；进入阶段 5
- 2026-10-21 00:05：用户决定 Q-001（删死接口 + landmarks 加鉴权，阶段 7 执行）；派 P4
- 2026-10-20 23:55：Harness 直连库补证（14 表 / 行数 / RLS 实测挡住匿名）+ 确认 A5 两个高德代理接口无鉴权；阶段 3 五份文档核对通过，G3 通过
- 2026-10-20 23:23：P2 交付 `docs/module-map.md`（448 行），G2 通过；发现 4 条最高优先风险（配额单点 14 调用方、限流被登录接口共用、Server Component 绕 RLS、游客页双实现）

## 7. 交接摘要索引

| 阶段 | 文件 | 状态 |
|---|---|---|
| 0 | `handover/阶段0-准备-交接摘要.md` | 已写（v1 口径，待补 v2 标记） |
| 1 | `handover/阶段1-接管审计-交接摘要.md` | 已写（v1 口径，待补 v2 标记） |
| 2 | `handover/阶段2-代码地图-交接摘要.md` | 已写 |
| 3 | `handover/阶段3-现状理解-交接摘要.md` | 已写 |
| 4 | `handover/阶段4-文档恢复-交接摘要.md` | 已写 |
| 5 | `handover/阶段5-PRD-交接摘要.md` | 已写 |
| 6 | `handover/阶段6-架构与计划-交接摘要.md` | 已写 |
| 7 | `handover/阶段7-编码-交接摘要.md` | 已写（T-001 追加） |
| 8 | `handover/阶段8-验收上线-交接摘要.md` | 未写 |
| 9 | `handover/阶段9-运营维护-交接摘要.md` | 未写 |
| 收尾 | `handover/收尾-项目总结-交接摘要.md` | 未写 |

## 8. 更新检查

- [x] 当前阶段与阶段进度表一致
- [x] 当前门禁与门禁表一致
- [x] 当前任务与任务表一致
- [x] 下一步是具体动作（接 MCP → 派 P2），不是「继续开发」
- [x] 阻塞写清了需要谁
- [x] 没有把「待验证」写成「已完成」

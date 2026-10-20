> 状态：草稿（待 Harness 核对）

# 目标架构（阶段 6 · 计划文档）

> 口径：**本文每条都是「计划」**（阶段 7 起执行）；现状一律看 `docs/architecture.md`，本文不重复描述已存在事实。每条含「为什么改 / 为什么保留」「迁移步骤」「兼容性影响」。用户已确认的硬性约束（PRD Q3/Q6）：**全部功能保留、不做大重构；保留游客/普通两套实现、3 页 service_role 直查、内存限流 Map、人工核销；本期不做生产部署/CI/CD/年卡/企微自建应用/事件队列**——本文所有计划均不触碰这些边界。

## 1. 目标技术栈与模块边界

| 项 | 计划 | 为什么保留 / 为什么需要改 | 迁移步骤 | 兼容性影响 |
|---|---|---|---|---|
| Next.js 14 App Router 单体 | **保留**，不拆分前后端 | 保留理由：55 个入口、30 API 全部在同一进程内闭环，页面-接口-组件三层边界当前清晰（`docs/architecture.md` §2）；拆分会违反「不做大重构」约束且无转化收益 | 无 | 无 |
| 自建 Supabase（Postgres/PostgREST/RLS） | **保留** | 保留理由：RLS+触发器已实测生效；迁移国内云是阶段 8 后的事，本期不动 | 无 | 无 |
| 数据库扩展 pg_cron | **计划启用（条件式）**：先验证自建镜像是否含 `pg_cron` 扩展；有则用于 F-51 到期写回，无则退回宿主 Windows 计划任务（见 §5-F-51 评估） | 需要改的理由：F-51 要求「不依赖用户访问」的真定时任务，应用内 setInterval 在 dev 频繁重启下不可靠 | ① 只读验证 `SELECT name, default_version FROM pg_available_extensions WHERE name='pg_cron'`；② 可用则新增迁移 `026_member_expire_cron.sql`（`CREATE EXTENSION` + `cron.schedule`）；③ 不可用则改宿主计划任务脚本（不进迁移） | 迁移 026 仅新增，不改既有表；`cron` schema 属新命名空间，与现有 25 份迁移零冲突 |
| 测试框架 vitest（单元）+ Playwright（E2E） | **计划引入——需用户批准**（改 `Project/package.json` devDependencies，PRD Q4/§12、Q-005） | 需要改的理由：核心链路 0 测试（known-issues B 级），阶段 7 起每次改动只能人工回归，转化链路打磨的迭代成本不可持续 | ① 用户批准后 `npm i -D vitest @vitejs/plugin-react`（纯函数层）与 `npm i -D @playwright/test`（E2E）；② 只新增 `Project/tests/` 目录与 `vitest.config.ts`，不改任何业务源码；③ `package.json` 只加 `test`/`test:e2e` 两个 script | devDependencies 不影响生产 bundle；Playwright 若与 macOS 沙箱兼容问题（历史教训 Trae 3.4.2）则降级为「手工用例 + 用户批准前不引入」 |
| 游客/普通页两套组件（TryPickClient/TryResultClient vs RoutePlacesClient/RouteResultClient） | **保留，不合并**（用户 Q6 明确） | 保留理由：合并属大重构，回归面两个完整流程；分叉风险以「改动必须双端同步」的维护规则控制（写入 `docs/decisions.md` 后续条目） | 无 | F-50 等新增功能须在两套组件各实现一次（见 T-005/T-006） |
| 3 个 Server Component service_role 直查（admin/orders、(user)/city、share/[token]） | **保留，不改为 API 中转**（用户 Q6 明确） | 保留理由：三处均为只读查询、入参可控（token/城市名），越权面已被 Harness 复核接受；改中转无转化收益 | 无 | F-52 的裁剪逻辑将**加在 share 页直查处**（服务端按身份裁剪返回字段），不改变「直查」形态 |
| 内存 Map 游客限流 | **保留，不引入 Redis**（用户 Q6 明确；known-issues A2） | 保留理由：单实例部署下语义正确；重启清零的后果是「游客当天额度重置」，业务可接受 | 无 | F-51/A5 均不触碰该模块 |
| 会员订单人工核销 | **保留，不做自动回调**（用户 Q6 明确；个人收款码无回调 API 是硬约束） | 保留理由：同左 | 无 | 无 |

## 2. 前后端 / 服务端 / 数据库 / 第三方关系（目标态）

与现状（`docs/architecture.md` §1）一致，仅三处计划增量：

1. **计划**：`Project/app/share/[token]/page.tsx` 的 service_role 直查处增加**身份分支**——服务端先 `getUser`（无 cookie 则为游客），会员返回完整快照、非会员/游客仅返回裁剪快照（地点名序列+城市+封面图数据，**不含**坐标/地址/分段里程/住宿信息）。迁移步骤：读身份 → 分支构造 payload → 页面组件按 payload 渲染两套 UI。兼容性：会员侧行为不变；非会员侧从「看完整」变为「看图」是 PRD Q10 要求的有意破坏。
2. **计划**：数据库侧新增**定时写回通道**（pg_cron 或宿主计划任务，二选一，见 §1 表），对 `users.member` 做过期落库；应用侧读取判定仍走 `isMemberActive` 不变（双保险：定时写回失败时惰性判定仍正确）。
3. **计划**：`/api/amap/landmarks` 增加 `getUser`（未登录 401）；`/api/amap/search` 目录整体删除。第三方（高德/DeepSeek/企微）接线关系不变。

## 3. 核心数据流、关键 API、权限与安全策略（计划变更点）

### 3.1 F-50 一键复位（计划，P0）
- **数据流**：结果页组件挂载时把「系统推荐顺序」存入组件级 ref（初始快照）→ 用户手动调序只改本地 state → 点「复位」从 ref 恢复顺序并同步地图覆盖物。**全程零 API 调用、零高德消耗**（PRD §7-5）。
- **涉及**：`Project/components/try/TryResultClient.tsx`（注意与 draftRef/sessionStorage 的既有回路——复位**不写** sessionStorage 草稿以外的状态通道，避免触发重排 effect，同 `docs/decisions.md` D-04 模式）与 `Project/components/route/RouteResultClient.tsx`（复位后与「保存地点顺序」PUT 的关系：复位仅改本地，是否落库由用户再点保存决定）。
- **权限**：无新增；沿用两页现有鉴权。
- **兼容性**：按钮仅在「当前顺序 ≠ 初始快照」时启用；未调序用户无感知。

### 3.2 F-51 会员到期定时任务（计划，P1）
- **实现方式评估（三选一）**：
  | 方案 | 优点 | 缺点 | 结论 |
  |---|---|---|---|
  | A. pg_cron（库内调度） | 不依赖应用进程与宿主机计划任务；随 Docker 数据卷持久；SQL 单点可审计 | 需确认自建镜像含扩展；`cron` 任务在 Postgres 内以超级用户执行，绕过应用层日志 | **推荐**（若扩展可用） |
  | B. Windows 计划任务 + 脚本调 `/pg/query`（service_role） | 不依赖扩展；通道已被迁移 025 验证可用 | 依赖宿主机开机与任务注册（用户手工操作一次）；脚本含密钥路径需防误提交 | 回退方案（A 不可用时） |
  | C. 应用内调度（Next.js 进程 setInterval） | 零外部依赖 | dev 频繁重启、无单实例保证、进程非常驻——「不依赖用户访问」的目标落空 | **不采用** |
- **写回 SQL（两方案共用）**：`UPDATE users SET member=false WHERE member=true AND member_until IS NOT NULL AND member_until < now()`；`member_until` 为 null（永久/管理员）天然不命中；管理员由 `sync_admin_member` 触发器双保险。执行身份为 service_role/超级用户（`auth.uid()` null 触发器放行，`docs/data-model.md` §4 口径），**有意绕过** `prevent_member_self_grant`（该触发器只防用户侧）。每小时一次即可（到期精度要求为小时级，`[待确认]` 用户是否接受）。
- **审计**：每次写回向 `member_logs` 插 `type='expire'` 行（计划字段口径；若 pg_cron 内不便写日志表则至少 `RAISE NOTICE` + 后台列表可判）。
- **配套**：`Project/components/admin/AdminUsersClient.tsx` 改按 `member_until` 计算显示「有效/已过期」（T-003），使「后台看不出过期」痛点在写回前后都可见正确状态。

### 3.3 F-52 分享分级（计划，P0）
- **数据流**：接收方打开 `/share/[token]` → 服务端读身份（`getUser`，无会话=游客）→ 会员：完整快照 + 「导入我的路线」按钮（走既有 `POST /api/shares/[token]/import`，会员校验已在 API 层，`route.ts:28`）；非会员/游客：**仅路线图片** + 「注册/升级会员可导入完整路线」引导（跳 `/login?redirect=…` 与 `/profile` 收银台）。
- **图片生成方案（计划取小方案）**：不引入 Supabase Storage 新依赖；非会员 payload 携带裁剪快照（地点名序列+城市+顺序），由客户端用既有 `renderRoutePoster`（`Project/lib/route-poster.ts:99`）的绘制能力渲染**精简版海报图**（不含地址/坐标/分段里程/住宿）。完整数据不出服务端 = 硬付费墙在数据层成立，而非前端隐藏。
- **决策点（需用户批准）**：图片上是否保留地点名称（本计划保留名称与顺序、去掉地址与里程；若用户要求「只有一张图连名称都不给」则改为纯地图形状，工作量上升）。
- **兼容性**：已生成的旧分享链接立即按新分级生效（无数据迁移）；会员导入链路 API 不变。

### 3.4 A5 修复（计划，P0）
- 删除 `Project/app/api/amap/search/`（零调用方，Q-001 实测）；`Project/app/api/amap/landmarks/route.ts` 头部加 `createClient()+auth.getUser()`，未登录 401（复用项目通用模式）。
- **前置核查**：删除前再跑一次 `grep -rn "api/amap/search" Project/app Project/components Project/lib` 确认零引用（防动态拼接漏检）。
- 兼容性：`searchPlaces` 前端消费方（若有）改走 `landmarks` 或库内搜索；实测调用方为零则无影响。

### 3.5 B9 城市清单对齐（计划，P1）
- **口径决策（需用户批准）**：以库内 92 为准裁剪 `Project/config/cities.ts`（104→92），或以迁移补库到 104。推荐前者（改配置文件零数据操作、与 seed 迁移 011 一致）。
- 迁移步骤：diff 两份清单 → 用户确认差集 12 城去留 → 改 `Project/config/cities.ts`（或新增迁移 026 补城）→ 核对 `/city` 页与 `Project/app/api/try/city-places` 的城市名匹配不受影响。
- 兼容性：若前端曾展示 104 城而库内仅 92，游客态徽章逻辑（「暂无数据」置灰）会自动收敛，无破坏。

### 3.6 转化链路打磨（计划，P0）
- 触点（PRD 痛点 5「看完路线不知道怎么付费」）：① 结果页保存成功后展示「会员权益条」（当日剩余路线数/单日地点上限 + 升级入口）；② 非会员触发配额上限（429/403 文案处）统一引导到 `/profile` 收银台；③ `/profile` 权益卡补「到期日/已过期」状态（F-51 配套，PRD §6）。
- 实现约束：文案一律进 `Project/config/messages.ts` 常量（铁律 4）；不新增 API；两套结果页各挂同一组件（新组件允许，两套页面合并禁止）。

### 3.7 手机端体验打磨（计划，P1）
- 本期范围（PRD Q9 痛点 4，具体项**需用户走查列举**）：候选项=结果页地图容器高度、地点列表触达热区、收银台弹层在小屏的滚动、底部导航与安全区（后台移动端底部工具栏已有先例）。计划先做一轮真机走查清单（见 `docs/acceptance-test-plan.md` E2E 用例），按用户勾选结果立小卡执行。

### 3.8 权限与安全策略（目标态汇总）
- 计划新增：landmarks 登录校验（A5）；share 页服务端按身份裁剪（F-52）；定时写回仅由库内/宿主通道执行（密钥不出宿主机）。
- 明确不变：middleware 只管页面、API handler 自校验的双层结构；RLS+4 触发器；五桶限流；`limitsOf` 单点。

## 4. 环境变量、部署参数、外部依赖、缺失配置

- **环境变量**：本期**零新增变量**。F-51 若走方案 B（宿主计划任务），脚本读取 `Project/.env.local` 既有 `SUPABASE_SERVICE_ROLE_KEY`，脚本本体放 `Project/scripts/` 并加入 gitignore 检查清单（不得含明文密钥）。
- **缺失配置（维持现状，本期不补）**：`.env.local` 缺 9 个（企微 4、高德私钥 3、Web Key 槽 3、JS Key 槽 2，`docs/人工参数与环境配置.md` §6）——均对应「本期不做」项，不阻塞 §4.1 九项需求。
- **部署参数**：本期无部署任务（PRD §4.2）；所有验证在本地 `npm run dev`（3000 端口）+ Windows 宿主机 Supabase 环境执行。
- **外部依赖**：高德/DeepSeek/企微接线不变；pg_cron 为唯一潜在新依赖（数据库扩展级，条件启用）。

## 5. 测试方式、数据库迁移、部署依赖、回滚策略

- **测试方式**：见 `docs/acceptance-test-plan.md`。分层：纯函数单测（vitest，需批准）→ API 集成（vitest + 本地 dev server，需批准）→ E2E（Playwright，需批准）→ 人工走查（无依赖，立即可用）。**批准前的默认验收手段 = typecheck + 人工走查 + `curl -b jar` 类命令取证**。
- **数据库迁移**：仅两处可能新增——026（F-51 pg_cron 版）与 026/027（B9 补城版，若用户选补库而非裁配置）。原则：只增列/只增扩展/不 DROP；经 Supabase SQL Editor 或 `/pg/query` 应用（工程约定）；应用前备份受影响行（AGENTS.md §5.1 报备流程）。
- **部署依赖**：无（本期不部署）。
- **回滚策略**：每张任务卡独立 commit（阶段 7 门禁 G6 要求）；代码回滚 = `git revert <sha>`；迁移回滚 = 预写反向 SQL（026 回滚：`SELECT cron.unschedule(...)` + `DROP EXTENSION` 或仅停任务）；数据写回类（F-51 首轮执行前对 `users` 全表 3 行做备份快照，回滚 = 按备份 UPDATE 还原）。

## 6. 保留 / 调整清单（逐条理由）

**值得保留（不动）**：Next.js 单体形态、自建 Supabase+RLS、五桶限流、`limitsOf` 配额单点、Key 池+30 天缓存省额度体系、两套结果页组件、3 页 service_role 直查、人工核销闭环、sessionStorage 草稿机制、`MESSAGES` 文案总线。理由：均为用户确认边界或经实测正确的机制，改动无转化收益且违反「不做大重构」。

**确实需要调整（全部对应 PRD §4.1）**：① landmarks/search 鉴权（A5，成本安全）；② 城市清单一致性（B9，数据正确性）；③ 会员到期写回+后台可见（F-51/Q7，运营正确性）；④ 结果页复位（F-50，体验）；⑤ 分享硬付费墙（F-52，转化）；⑥ 付费引导触点（打磨，转化）；⑦ 手机端（打磨，转化）；⑧ 测试基建（工程）。每项均已展开于 §3 与 `docs/implementation-plan.md`。

## 7. 证据来源

- `docs/项目需求文档PRD.md`（§0 访谈 Q3/Q5/Q6/Q7/Q9/Q10、§4.1/4.2/4.3、§5-§8、§11/§12）。
- `docs/architecture.md`（现状结构，本文增量基线）、`docs/module-map.md` §3/§4（调用链与影响面）、`docs/data-model.md` §4（触发器放行口径）、`docs/api-contract.md`（landmarks/search/import 现状）、`docs/feature-status.md` F-08/F-50/F-51、`docs/decisions.md` D-04/D-05/D-08/D-10/D-11。
- `docs/known-issues.md`（A1-A5、B1-B9、C1-C3，含 2026-10-21 Harness 复核增补）、`docs/open-questions.md`（Q-005/Q-009/Q-010/Q-011）。
- 源码行号内联：`Project/lib/route-poster.ts:99`、`Project/app/api/shares/[token]/import/route.ts:28`、`Project/app/api/amap/landmarks/route.ts:27`、`Project/app/api/amap/search/route.ts:9`、`Project/components/try/TryResultClient.tsx`、`Project/components/route/RouteResultClient.tsx`、`Project/components/admin/AdminUsersClient.tsx`、`Project/config/cities.ts`、`Project/lib/member-quota.ts:78/90`。

## 8. 待确认事项

1. pg_cron 在自建镜像的可用性（只读验证一条 SQL 即可关闭）→ 决定 F-51 走 A 还是 B。
2. F-52 图片信息粒度（保留地点名 or 纯形状）→ 用户拍板。
3. B9 对齐方向（裁配置 92 or 补库 104）→ 用户拍板（Q-009）。
4. F-51 到期写回的小时级精度是否可接受；`member_logs` 是否要 `type='expire'` 新枚举值（涉及 `Project/config/enums.ts` 增值）。
5. PRD §7-6 幂等性 `[待确认]`：订单重复提交与路线保存并发的现状强度，阶段 7 执行 T-011 时核对后回填本文。
6. 手机端打磨的具体项清单（需用户真机走查勾选）。

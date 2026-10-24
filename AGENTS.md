# 项目协作规则

> 本文件是本项目的长期协作规则，对所有 AI 编程工具生效。
> Trae 的 Rules 只需写一句「本项目的协作规则以根目录 `AGENTS.md` 为准」，不要维护第二份。
> 本项目的接手流程依据：`/Volumes/Programming/Project-File/DeepSeek-harness/半流程代码开发/半流程开发-流程文档说明.md`（阶段 0–9 + 7 道门禁）。

## 0. 项目速览

- **项目名称**：AI-lvcingyitiaoxian（产品名：旅行美食一条线）
- **项目根目录**：`/Volumes/Programming/Project-File/AI-lvcingyitiaoxian`（Git 仓库在这层）
- **代码根**：`Project/`（Next.js 应用）；正式文档 `docs/`；`File-PRD/` 是历史文档，**只读参考，不改不删**
- **项目用途**：选城市 → 设置行程 → 挑地点 → 自动排路线 → 看地图与分段里程 → 保存为个人路线。支持游客免登录试用、会员分层配额、路线分享
- **目标用户**：自助旅行者（游客试用 → 注册 → 会员付费）
- **技术栈**：Next.js 14.2.15（App Router）+ React 18.3.1 + TypeScript（strict）+ TailwindCSS；自建 Supabase（Postgres / Auth / PostgREST）；高德地图（JS API + Web 服务）；DeepSeek（文案提取）；企业微信 Webhook（订单提醒）
- **启动命令**：`cd Project && npm run dev`（端口 3000，依赖 `Project/.env.local`）
- **类型检查**：`cd Project && npm run typecheck`
- **构建命令**：`cd Project && npm run build`
- **Lint**：`cd Project && npm run lint`
- **测试命令**：`cd Project && npm run test:run`（vitest 单测，41 条）；`npm run test:e2e`（Playwright 8 条，需 dev server 3000 在跑 + `Project/.env.test.local` 凭据，缺失时鉴权用例自动 skip）；`npm run audit:mobile`（真机尺寸移动端审计）；`npm run check:env`（环境 / Supabase / dev 探活）；`npm run check:cities`（城市数据三处一致性）；`npm run typecheck`（tsc --noEmit）。改动至少跑 `typecheck` + 相关测试；运行时行为仍需人工走一遍，并在汇报里写「未覆盖」而不是「通过」
- **数据库 / 外部服务**：自建 Supabase（地址见 `Project/.env.local`）、高德 Web 服务 Key 池（两个 Key）、高德 JS API、DeepSeek API、企业微信 Webhook
- **禁止触碰**：`Project/.env.local`（密钥）、生产 Supabase 数据、`File-PRD/`（历史文档）、`node_modules/`、`.next/`、`Project/public/pay-qr.*`（含经营信息的收款码原图）
- **当前进度与主文档**：**`docs/progress.md` 是唯一进度事实源**（阶段 / 门禁 / 任务 / 下一步 / 阻塞都看它）；审计报告 `docs/existing-project-audit.md`

### 本机分工（与手册 §1.1 的差异，已按实际能力调整）

| 角色 | 负责 |
|---|---|
| DeepSeek Harness | 流程与门禁、任务卡、文档、**技术验收（本机实跑命令与读 diff）**、风险分析 |
| Trae（Mac-Trae / Win-Trae） | 在 `Project/` 内读代码、调用 CodeGraph、实施改动、跑测试、汇报真实 diff |
| 用户 | 需求决策、范围批准、**最终验收（功能正确性 / 实用性 / 满意度）**、生产操作授权 |

> 本机为 DSH 直连会话，Harness 可以读文件、跑只读命令做独立核对；这不改变「用户拥有最终验收权」这一条。

## 1. 项目理解

- 修改任何功能前，先读取相关项目文档和源码。
- 开工前先读 `docs/progress.md`（唯一进度事实源）；再读 `docs/项目需求文档PRD.md`、`docs/architecture.md`、`docs/implementation-plan.md`、`docs/known-issues.md`（含从 `File-PRD/项目进展与问题汇总-*.md` 迁来的 L 系列教训）。文档不存在时以源码为准，不要假设功能不存在。
- 如果 CodeGraph 可用，优先利用代码图谱查询符号、调用链、依赖关系及修改影响范围。
  **MCP 通道（1.6.2）只有一个工具 `codegraph_explore`**（自然语言或符号名 → 带行号的源码 + 调用路径 + 影响面），优先用它；
  **`callers` / `callees` / `impact` / `affected` 是 CLI 子命令**，需要精确单点查询时在终端执行（`codegraph callers <符号>`），并在汇报里注明是 CLI 取证。
- **Trae 里的 MCP 工具名带前缀**：实际可调用名是 `mcp_codegraph_codegraph_explore`，用裸名 `codegraph_explore` 搜索会返回 0 个工具（2026-10-20 实测踩过两次）。
- **本机 MCP 配置必须是绝对路径**（GUI 进程的 PATH 不含 node 安装目录）：
  `command` = `/Volumes/Programming/Applications/nodejs/bin/node`，
  `args` = `["/Volumes/Programming/Applications/nodejs/lib/node_modules/@colbymchenry/codegraph/npm-shim.js", "serve", "--mcp", "--path", "/Volumes/Programming/Project-File/AI-lvcingyitiaoxian"]`。
  写成 `codegraph` 会 spawn 失败；写成 `.../bin/codegraph` 会报 `env: node: No such file or directory`。改完必须 ⌘Q 完全退出 Trae 再打开。
- CodeGraph 不可用时，明确说明原因，改用 `rg` 与源码阅读，**不得伪造图谱结果**。
- 不得因为文档缺失就假设对应功能不存在。

## 2. 修改原则

- 优先在现有架构中做最小必要修改。
- 未经批准，不得删除现有模块、业务功能、必要校验或测试。
- 不得擅自更换公共接口、数据结构或配置格式。
- 不得将无关重构、格式化、依赖升级混入当前任务。
- 不得执行数据库迁移、重置数据或影响生产环境的操作（除非任务明确批准）。
- 保留原有代码风格与注释；新增模块用简洁中文注释说明职责。

### 2.1 本项目特有铁律（违反过、已写进教训 L44–L49）

1. **游客能力口径不可擅自改**：游客**能用**「新建路线」的完整功能（选城市 → 设置路线 → 导入/勾选地点 → 调顺序 → 看地图与分段里程），**唯一差别是最后「保存路线」需要登录**；游客**不能用**顶部工具栏任何功能（含 logo，全部置灰）。改动此口径前必须先问用户。
2. **免登录限流必须按接口成本分桶**：花钱桶（`import` DeepSeek+高德、`order` 距离矩阵）3 次/日；只读桶 `city-places` 100 次/日；同一批数据的手动重排 `reorder` 60 次/日。**新增免登录接口前先定桶，不得默认套 3 次/日**。
3. **地图要能操作必须显式传 `interactive`**：`<AmapMap>` 默认 `interactive=false`，漏传就是「地图不能拖不能缩放」。
4. **不要复制一份新页面改样式**：游客页与普通用户页共用组件（如 `TripSettingsFields` 的 `sections` 裁剪参数）与 `MESSAGES` 常量；两套独立实现必然分叉。
5. **派生状态与 effect 的回路**：调顺序、改草稿时不要 `setDraft`，用 `ref` + sessionStorage，否则会触发依赖 `draft` 的 effect 把用户刚调的顺序冲掉。
6. **一个 state 不要驱动两个语义字段**：出现「改 A 结果 B 也变了」时，正确修法是拆字段，不是加判断屏蔽联动。

## 3. 计划优先

- 每项任务必须明确：目标、修改范围、验收标准、测试方案、回滚方式。
- 涉及架构、数据库、认证、公共接口或生产部署的高风险操作，必须先提交方案并等待批准。
- **计划未获批准前，不得修改任何文件。**

## 4. 验证要求

- 修改后检查 `git diff`，运行相关测试和必要的构建检查。
- 优先跑 `npm run test:run` 与 `npm run test:e2e`（命令见 §0）；自动化测试通过后，仍须区分「已通过 / 失败 / 未执行 / 未覆盖」四态汇报。
- 必须区分四种状态：**已通过 / 失败 / 未执行 / 未覆盖**。
- 没有证据不得声称任务已经完整验证；不得用「应该没问题」代替运行结果。
- 禁止通过删除测试、跳过测试、吞掉异常或移除必要校验来让结果变绿。

## 5. 文档同步

- 重要架构、接口、配置或业务流程变更后，同步更新对应文档和 `docs/progress.md`（进度看板必须同步，它是唯一事实源）。
- 不得将推测当成事实，不得将计划当成已实现功能。
- 每个阶段/任务结束时更新 `docs/handover/` 下的交接摘要。

## 5.1 自建 Supabase 的访问权限（2026-10-20 用户授权）

- **允许**：连接自建 Supabase 做只读查询（`SELECT`、看表结构、看 RLS 策略、看迁移状态）。
- **允许但必须先报备**：任何写操作（`INSERT` / `UPDATE` / `DELETE` / `ALTER` / `DROP` / 迁移）。
  报备内容固定四项：影响范围（哪些表/多少行）、备份方式、回滚步骤、只碰测试数据的说明。
- **绝对禁止**：整表 `DELETE`/`TRUNCATE`、`DROP TABLE`、改 RLS 策略、动 `auth.users`、把真实用户数据带进文档或聊天。
- 执行写操作时保留完整命令与时间戳，写进 `docs/progress.md` 的变更摘要。

## 6. 敏感信息

- 不输出或提交真实密钥、密码、证书、用户隐私和生产数据。
- 涉及敏感配置时，只说明变量名和安全配置位置。
- 发现密钥可能泄露时，立即停止操作并报告，不要自行「清理历史」。

## 7. 交付汇报（每个任务固定格式）

```markdown
## 任务 T-00X 交付汇报

1. 目标与完成情况
2. 修改文件与变更摘要
3. 原有功能、接口、数据的保留情况
4. 运行的命令与真实结果（通过/失败/未执行/未覆盖）
5. 未解决问题与风险
6. 回滚方式
7. 文档与进度更新情况
```


### 7.1 测试数据卫生（2026-10-23 补充）

- 任何角色（Trae / Harness）为验证而创建的账号、路线、订单，**必须在汇报中说明是否已清理**。
- 优先用可识别前缀（如 `e2e-`、`t0xx-verify-`），便于事后批量清理。
- 不得在真实用户账号（含管理员）下长期遗留测试路线；确需临时创建时，标题必须带任务号（如 `T-027 实测`），验证后立即删除。
- Harness 在验收时会抽查 `users` / `routes` / `member_orders` 行数，发现遗留即清理并记录。

> 规则冲突时：用户当次明确指令 > 本文件 > AI 工具默认行为。任何冲突先报告，不要自行取舍。

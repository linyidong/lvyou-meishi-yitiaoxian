\# 旅行美食一条线 · 数据库与 API 对接说明

\## 0. 使用说明

\- 本文档供 Trae 生成数据库迁移、API Route、前端调用代码。

\- 所有表启用 RLS。

\- 所有 API 返回 JSON。

\- 错误统一格式：`{ error: string, code?: string }`。

\---

\## 1. 数据库表

\### 1.1 users

| 字段 | 类型 | 约束 | 说明 |

|---|---|---|---|

| id | uuid | PK, 引用 auth.users | |

| email | text | unique | |

| username | text | nullable | |

| role | text | default 'user' | user/admin |

| last\_seen\_at | timestamptz | nullable | 最后活跃 |

| current\_path | text | nullable | 当前页面 |

| created\_at | timestamptz | default now() | |

**RLS**：

\- 用户可 select/update 自己。

\- 管理员可 select 全部。

**触发器**：

\- 新用户注册时，从 auth.users 同步 email，role 默认 user。

\---

\### 1.2 cities

| 字段 | 类型 | 约束 | 说明 |

|---|---|---|---|

| id | uuid | PK | |

| name | text | not null | |

| adcode | text | not null | 高德城市编码 |

| created\_at | timestamptz | default now() | |

**RLS**：所有人可 select。

**初始化数据**：常见国内城市，至少 50 个。

\---

\### 1.3 places

| 字段 | 类型 | 约束 | 说明 |

|---|---|---|---|

| id | uuid | PK | |

| user\_id | uuid | FK users | |

| city\_id | uuid | FK cities | |

| name | text | not null | |

| address | text | nullable | |

| type | text | not null | attraction / food |

| note | text | nullable | |

| image\_url | text | nullable | |

| open\_hours | text | nullable | |

| rating | numeric | nullable | |

| lat | numeric | nullable | |

| lng | numeric | nullable | |

| source\_url | text | nullable | |

| created\_at | timestamptz | default now() | |

**RLS**：

\- 用户可 select/insert/update/delete 自己的。

\- 管理员可 select 全部。

\---

\### 1.4 routes

| 字段 | 类型 | 约束 | 说明 |

|---|---|---|---|

| id | uuid | PK | |

| user\_id | uuid | FK users | |

| city\_id | uuid | FK cities | |

| title | text | not null | |

| days | int | not null | |

| transport | text | not null | walk/bike |

| is\_public | boolean | default false | |

| created\_at | timestamptz | default now() | |

**RLS**：同 places。

\---

\### 1.5 route\_places

| 字段 | 类型 | 约束 | 说明 |

|---|---|---|---|

| id | uuid | PK | |

| route\_id | uuid | FK routes | |

| place\_id | uuid | FK places | |

| day\_index | int | not null | |

| order\_index | int | not null | |

| created\_at | timestamptz | default now() | |

**RLS**：通过 route 的 user\_id 判断。

\---

\### 1.6 imports

| 字段 | 类型 | 约束 | 说明 |

|---|---|---|---|

| id | uuid | PK | |

| user\_id | uuid | FK users | |

| raw\_text | text | not null | |

| source | text | not null | xiaohongshu/douyin/manual |

| status | text | not null | success/failed |

| created\_at | timestamptz | default now() | |

**RLS**：同 places。

\---

\### 1.7 events

| 字段 | 类型 | 约束 | 说明 |

|---|---|---|---|

| id | uuid | PK | |

| user\_id | uuid | FK users | |

| event\_name | text | not null | add\_place/generate\_route/click\_upgrade |

| metadata | jsonb | nullable | |

| created\_at | timestamptz | default now() | |

**RLS**：用户可 insert 自己的；管理员可 select 全部。

\---

\## 2. API 对接

\### 2.1 POST /api/ai/extract

**用途**：从文案提取地点。

**请求**：

\`\`\`json

{

  "text": "分享文案...",

  "city": "厦门"

}

\`\`\`

**响应**：

\`\`\`json

{

  "places": [

    { "name": "鼓浪屿", "type": "attraction", "note": "" },

    { "name": "张三疯奶茶", "type": "food", "note": "" }

  ]

}

\`\`\`

**错误**：

\`\`\`json

{ "error": "AI 提取失败", "code": "AI\_FAILED" }

\`\`\`

**实现**：

\- 调用 DeepSeek chat completions。

\- system prompt 要求只返回 JSON。

\- 限制 20 个地点。

\---

\### 2.2 POST /api/amap/search

**用途**：地点名搜索地址和经纬度。

**请求**：

\`\`\`json

{

  "keywords": "鼓浪屿",

  "city": "厦门"

}

\`\`\`

**响应**：

\`\`\`json

{

  "results": [

    {

      "name": "鼓浪屿",

      "address": "福建省厦门市思明区",

      "lat": 24.447,

      "lng": 118.067

    }

  ]

}

\`\`\`

**错误**：

\`\`\`json

{ "error": "高德搜索失败", "code": "AMAP\_FAILED" }

\`\`\`

**实现**：

\- 调用高德 Web 服务 `/v3/place/text`。

\- 取第一条或前五条。

\---

\### 2.3 POST /api/amap/route

**用途**：路线规划。

**请求**：

\`\`\`json

{

  "mode": "walk",

  "origin": { "lat": 24.447, "lng": 118.067 },

  "destination": { "lat": 24.450, "lng": 118.070 },

  "waypoints": [

    { "lat": 24.448, "lng": 118.068 }

  ]

}

\`\`\`

**响应**：

\`\`\`json

{

  "ordered": [

    { "lat": 24.447, "lng": 118.067 },

    { "lat": 24.448, "lng": 118.068 },

    { "lat": 24.450, "lng": 118.070 }

  ],

  "distance": 1200,

  "duration": 900

}

\`\`\`

**错误**：

\`\`\`json

{ "error": "路线规划失败", "code": "ROUTE\_FAILED" }

\`\`\`

**实现**：

\- walk：`/v3/direction/walking`

\- bike：`/v4/direction/bicycling`

\- 限制单日最多 10 个点。

\---

\### 2.4 POST /api/heartbeat

**用途**：更新用户在线状态。

**请求**：

\`\`\`json

{

  "current\_path": "/routes"

}

\`\`\`

**响应**：

\`\`\`json

{ "ok": true }

\`\`\`

**实现**：

\- 从 session 取 user\_id。

\- 更新 users.last\_seen\_at、current\_path。

\---

\## 3. 前端直接调用 Supabase

以下操作前端直接调 Supabase，不走 API Route：

| 操作 | 表 | 方法 |

|---|---|---|

| 读取我的路线 | routes | select |

| 读取路线点 | route\_places | select |

| 读取我的地点 | places | select |

| 插入地点 | places | insert |

| 插入路线 | routes | insert |

| 插入路线点 | route\_places | insert |

| 更新路线 | routes | update |

| 删除路线 | routes | delete |

| 读取城市 | cities | select |

| 写入事件 | events | insert |

| 读取用户信息 | users | select |

**注意**：

\- 所有操作依赖 RLS。

\- 前端用 `lib/supabase/client.ts`。

\- 服务端组件用 `lib/supabase/server.ts`。

\---

\## 4. 管理员查询

管理员页面通过服务端组件 + `lib/supabase/admin.ts`（service role）查询，或通过 RLS 允许管理员读全部。

**推荐**：用 RLS，不用 service role，降低泄露风险。

**管理员查询**：

\- 用户列表：`select * from users order by created_at desc`

\- 在线用户：`select * from users where last_seen_at > now() - interval '5 minutes'`

\- 地点列表：`select * from places order by created_at desc`

\- 路线列表：`select * from routes order by created_at desc`

\- 导入记录：`select * from imports order by created_at desc`

**分页**：每页 20 条。

\---

\## 5. 在线心跳

**前端**：

\`\`\`ts

useEffect(() =&gt; {

  if (!user) return;

  const send = () =&gt; {

    if (document.visibilityState === 'visible') {

      fetch('/api/heartbeat', {

        method: 'POST',

        body: JSON.stringify({ current\_path: location.pathname })

      });

    }

  };

  send();

  const timer = setInterval(send, 60000);

  return () =&gt; clearInterval(timer);

}, [user]);

\`\`\`

**后端**：

\- 更新 `users.last_seen_at = now()`。

\- 更新 `users.current_path`。

**在线判断**：

\`\`\`sql

last\_seen\_at &gt; now() - interval '5 minutes'

\`\`\`

\---

\## 6. 错误码

| code | 说明 |

|---|---|

| AI\_FAILED | AI 提取失败 |

| AMAP\_FAILED | 高德搜索失败 |

| ROUTE\_FAILED | 路线规划失败 |

| UNAUTHORIZED | 未登录 |

| FORBIDDEN | 无权限 |

| NOT\_FOUND | 资源不存在 |

| VALIDATION\_ERROR | 参数错误 |

\---

\## 7. 环境变量

\`\`\`text

NEXT\_PUBLIC\_SUPABASE\_URL=

NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY=

SUPABASE\_SERVICE\_ROLE\_KEY=

NEXT\_PUBLIC\_AMAP\_KEY=

AMAP\_WEB\_SERVICE\_KEY=

DEEPSEEK\_API\_KEY=

\`\`\`

\---

\## 8. 数据库迁移顺序

1\. 创建 users、cities

2\. 创建 places、routes、route\_places

3\. 创建 imports、events

4\. 启用 RLS

5\. 编写策略

6\. 创建触发器

7\. 插入城市初始化数据

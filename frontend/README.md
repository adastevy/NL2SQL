# NL2SQL Agent · Frontend

基于 **React 19 + Vite + TypeScript + Ant Design 5 + ECharts + Zustand** 的智能数据分析前端。

三栏布局：左栏会话列表，中栏聊天（SSE 流式），右栏图表 + 数据字典抽屉。

---

## 运行环境

- Node.js **20+**（建议 20 LTS）
- npm 10+

---

## 首次安装 & 启动

```powershell
cd frontend
npm install
# 可选：复制环境变量示例
Copy-Item .env.example .env.local
npm run dev -- --host localhost
```

然后访问 <http://localhost:5173>。

> **注意**：Vite 默认绑 IPv6 的 `[::1]`，用 `localhost` 或 `http://localhost:5173` 访问比 `127.0.0.1` 稳。

---

## Mock ↔ Real 一键切换

前端有两套数据源实现，**通过环境变量切换**，不需改任何源码：

| `VITE_USE_MOCK` | 行为 | 何时用 |
| :--- | :--- | :--- |
| `true` | 完全走 `src/mocks/*`，不碰后端 | 无 Key / 纯 UI 演示 / CI 冒烟 |
| `false`（默认） | 走 `src/api/*` → Vite 代理 → `/api/*` → FastAPI | 正常联调和上线 |

实现位置：所有 store / 组件只 `import * as api from '../api'`，`src/api/index.ts` 是分发
器，根据 `import.meta.env.VITE_USE_MOCK` 决定绑定到 mock 还是 real。

页面顶部会实时展示当前模式（"Mock 模式 / 真实模式"）。

```powershell
# 临时一次性（推荐）
$env:VITE_USE_MOCK='true'; npm run dev
# 或写到 .env.local
echo 'VITE_USE_MOCK=true' >> .env.local
```

---

## 代理 & 后端地址

`vite.config.ts` 把 `/api/**` 代理到 `VITE_BACKEND_URL`（默认 `http://127.0.0.1:8000`）。
代理会强制去掉上游 SSE 缓冲（`X-Accel-Buffering: no`），保证 `/api/chat` 事件逐条下发。

如果后端跑在远程机器或别的端口：

```powershell
# .env.local
VITE_BACKEND_URL=http://192.168.1.100:8000
```

---

## 目录结构

```
frontend/src/
├── api/                  # ★ 真实后端客户端（Phase 4）
│   ├── client.ts         # axios 实例 + ping
│   ├── sessions.ts       # REST: CRUD + 历史消息（含后端 → 前端适配）
│   ├── schema.ts         # REST: 数据字典
│   ├── chat.ts           # SSE: runChat（@microsoft/fetch-event-source）
│   └── index.ts          # ★ mock↔real 分发层（VITE_USE_MOCK 开关）
├── mocks/                # 离线演示实现（Phase 2 沉淀，不删）
│   ├── mockApi.ts
│   ├── mockData.ts
│   └── mockSSE.ts
├── store/                # Zustand
│   ├── useSessionStore.ts
│   ├── useChatStore.ts   # ★ 消费 SSE 事件的核心状态机
│   └── useChartStore.ts
├── components/
│   ├── SessionList/      # 左栏：会话 CRUD
│   ├── ChatPanel/        # 中栏：消息 + 建议问法 + Composer
│   └── ChartPanel/       # 右栏：ECharts + Schema 抽屉
├── types.ts              # ★ 与后端 DTO 严格对齐（camelCase）
├── App.tsx
└── main.tsx
```

---

## SSE 事件模型（对前端的硬约束）

消费 `/api/chat` 时 `useChatStore.applyEvent` 遵循：

| 事件 | 累加 or 覆盖 | 何处呈现 |
| :--- | :--- | :--- |
| `thought` | **增量拼接** | 思考气泡（灰色小字） |
| `sql` | **覆盖**（最终 SQL 一次到位） | SQL 代码块 |
| `data` | **覆盖** | 数据表 / ECharts 数据源 |
| `chart` | **覆盖** | 右栏 ECharts 图表 |
| `final` | **一次性完整覆盖**（不拼接！） | 最终回答文本 |
| `done` | 结束 | 关闭 loading |
| `error` | 结束 + 报错 | Alert |

> 为什么 `final` 是覆盖而不是拼接？后端为了防 Qwen3 的 ReAct 把"中间思考 SQL"误当成答
> 案流出来（会造成"答案闪烁"），会缓冲到 agent 全部跑完再一次性 flush。`final` 全程只
> 触发一次。

详细契约参见 [`.cursor/plans/...plan.md` §3.5](../.cursor/plans/)。

---

## 构建

```powershell
npm run build     # tsc -b && vite build → dist/
npm run preview   # 本地预览产物
npm run lint      # ESLint（CI 必过）
```

---

## 常见问题

- **控制台报 `[antd: compatible] ...React 19`**：Ant Design v5 官方对 React 19 标"软兼
  容"，功能不受影响，等 AntD v6 完全适配即可关闭。
- **网络面板看到 `/api/chat` 一直在 pending 却没事件**：八成是代理层缓冲了 SSE。确认
  `vite.config.ts` 里 `X-Accel-Buffering=no` 没丢；生产部署 Nginx 的话也要配同名头。
- **切换到真实模式后会话消失**：因为 mock 模式的会话存在 localStorage，真实模式存后端
  数据库。两套互不干扰，切回去数据还在。

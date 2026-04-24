# NL2SQL 智能数据分析系统

> **FastAPI + LangChain SQL Agent + 阿里云百炼 Qwen3** × **React 19 + Ant Design 5 + ECharts + Zustand**  
> 自然语言问 → SSE 流式返回「思考 / SQL / 数据 / 图表配置 / 最终回答」→ 前端实时渲染柱/折/饼/表。

![status](https://img.shields.io/badge/phase-4%20联调完成-brightgreen) ![backend](https://img.shields.io/badge/backend-FastAPI%20%2B%20LangChain%20v1-blue) ![frontend](https://img.shields.io/badge/frontend-React%2019%20%2B%20Vite-61dafb) ![llm](https://img.shields.io/badge/LLM-Qwen3--max-ff6a00)

---

## 当前进度

- [x] **Phase 1：基础框架**（后端 `/api/ping` + 前端三栏骨架 + 双端启动）
- [x] **Phase 2：前端 UI**（Mock 驱动，三栏 UI + 流式气泡 + ECharts + 数据字典）
- [x] **Phase 3：后端接口**（LangChain v1 `create_agent` + Qwen3 + 7 事件 SSE + 应用库）
- [x] **Phase 4：前后端联调**（`VITE_USE_MOCK` 一键开关 + E2E 全绿 + CORS/SSE 跨端验证）

完整计划与契约：[`.cursor/plans/...plan.md`](./.cursor/plans/)（尤其是 **§3.5 前端对接契约**）。

---

## 架构一览

```
┌─────────────────────────┐        HTTP/SSE        ┌──────────────────────────────┐
│  浏览器 (localhost:5173)  │  ───────────────────►  │  FastAPI  (127.0.0.1:8000)   │
│ React 19 + AntD + ECharts │                        │                              │
│                           │   POST /api/chat       │  ┌────────────────────────┐  │
│  Zustand 3 stores         │   (text/event-stream)  │  │  chat_service          │  │
│   ├─ useSessionStore      │                        │  │  (astream_events v2)   │  │
│   ├─ useChatStore ◄──┐    │                        │  │  └─► SQL Agent         │  │
│   └─ useChartStore   │    │                        │  │      (create_agent)    │  │
│                      │    │                        │  │  └─► Chart Chain       │  │
│  applyEvent(thought/ │    │                        │  │      (LCEL+JsonParser) │  │
│   sql/data/chart/    │◄─┼─  thought / sql / data  │  │                        │  │
│   final/done/error)  │    │   chart / final / done │  └────────────────────────┘  │
│                           │                        │             │                │
│  api/index.ts 分发层       │   REST CRUD /sessions  │  SQLAlchemy │                │
│  ├─ VITE_USE_MOCK=true   │  ◄────────────────────  │  aiosqlite  ▼                │
│  │    → src/mocks/*       │                        │  ┌──────────────────────┐    │
│  └─ false（默认）         │   GET /api/schema       │  │ SQLite: app.db       │    │
│       → src/api/*         │  ◄────────────────────  │  │  · sessions (应用)    │    │
│                           │                        │  │  · messages (应用)    │    │
│                           │                        │  │  · Chinook 11 张业务表 │    │
└─────────────────────────┘                         │  └──────────────────────┘    │
                                                    │                               │
                                                    │  LLM: Qwen3-max (阿里云百炼)   │
                                                    │  OpenAI 兼容 /compatible-mode │
                                                    └──────────────────────────────┘
```

- **数据源**：SQLite 单文件 `backend/app.db`，首启动脚本自动灌入 Chinook 经典示例库（艺术家/专辑/发票/客户 等 11 张表）。
- **LLM**：阿里云百炼 Qwen3 系列，走 OpenAI 兼容端点；SQL Agent 用 `qwen3-max`，Chart/Title 可降配。
- **鉴权**：无登录，全部会话按 `sessionId` 持久化在后端 SQLite。
- **流式协议**：SSE（`text/event-stream`，7 种事件类型，`final` 一次性覆盖，`thought` 增量拼接）。

---

## 目录

```
NL2SQLAGENT/
├── backend/                   # FastAPI + LangChain 服务（见 backend/README.md）
│   ├── app/                   # api / services / agent / memory / llm / db
│   ├── scripts/               # smoke_chat / probe_contract / e2e_fullflow（gitignore）
│   ├── .env.example
│   └── requirements.txt
├── frontend/                  # React 19 + Vite + TS（见 frontend/README.md）
│   ├── src/
│   │   ├── api/               # 真实后端客户端（Phase 4 启用）
│   │   ├── mocks/             # 离线演示实现（保留）
│   │   ├── store/             # Zustand
│   │   └── components/        # SessionList / ChatPanel / ChartPanel
│   └── .env.example
├── .cursor/plans/             # 完整方案 & §3.5 前后端契约矩阵
├── dev.ps1                    # Windows 一键启动（开两个 PS 窗口）
└── README.md                  # 本文件
```

---

## 环境要求

| 组件 | 版本 |
| :--- | :--- |
| Python | 3.10+（推荐 3.11） |
| Node.js | 20+ LTS |
| npm | 10+ |
| API Key | 阿里云百炼 [bailian.console.aliyun.com](https://bailian.console.aliyun.com/) |

---

## 快速启动

### ① 拉代码 + 填 Key

```powershell
git clone <this-repo> NL2SQLAGENT
cd NL2SQLAGENT

# 后端 .env
Copy-Item backend\.env.example backend\.env
notepad backend\.env        # 填入 DASHSCOPE_API_KEY=sk-...

# 前端 .env.local（可选，默认即可）
Copy-Item frontend\.env.example frontend\.env.local
```

### ② 一键启动（推荐）

在**项目根目录**运行：

```powershell
.\dev.ps1                # 前端 + 后端（真实模式）
.\dev.ps1 -UseMock       # 前端 + 后端，前端走 Mock（无需 Key 即可演示 UI）
.\dev.ps1 -Backend       # 仅启动后端
.\dev.ps1 -Frontend      # 仅启动前端
```

脚本会在两个新窗口分别起 `uvicorn`（8000）和 `vite`（5173）；首次会自动建 venv、装依赖。

### ③ 手动启动（等价）

```powershell
# 终端 A：后端
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# 终端 B：前端
cd frontend
npm run dev -- --host localhost
```

### ④ 验证

- 后端健康：<http://127.0.0.1:8000/api/ping> → `{"status":"ok"}`
- 后端 Swagger：<http://127.0.0.1:8000/docs>
- 前端入口：<http://localhost:5173>
  - 顶栏应显示 `Phase 4 · 真实后端（Qwen3 + LangChain）` + 绿色「真实模式」Tag
  - 右上角 `后端已连接 ✓`
- 试着问："**销售额 Top10 的艺人是谁？**" — 中栏会流式出 SQL → 数据 → 最终回答，右栏同步出柱状图。

---

## 端到端自检

项目内置一个不依赖浏览器的 E2E 脚本：

```powershell
cd backend
.\.venv\Scripts\python.exe scripts\e2e_fullflow.py
```

会依次验证：CORS 预检 → Schema 字段 → 新建会话 → 两轮 SSE 问答（含上下文追问）
→ 历史回放（`meta.sql/data/chart/final/status` 完整）→ 删除会话 → list 同步更新。
正常打印 **`ALL GREEN · 耗时 ~70s`**（会实际调用 Qwen，消耗少量 tokens）。

---

## Mock ↔ Real 一键切换

离线 UI 演示保留在 `frontend/src/mocks/`（Phase 2 沉淀不删），通过 `VITE_USE_MOCK` 环境变量切换：

```powershell
# frontend/.env.local
VITE_USE_MOCK=true       # 不启后端也能跑完 UI（3 组预设问答）
# VITE_USE_MOCK=false    # 默认，走真实后端
```

实现位置：`frontend/src/api/index.ts` 的分发层。页面顶栏会实时显示当前模式。

---

## 技术栈

- **后端**：Python 3.11 / FastAPI 0.115 / **LangChain 1.x** (`create_agent`) / `langchain-openai` / SQLAlchemy / aiosqlite / sse-starlette / pydantic-settings
- **LLM**：阿里云百炼 **Qwen3-max / qwen-turbo**（OpenAI 兼容端点）
- **前端**：**React 19** / Vite 8 / TypeScript 5 / Ant Design 5 / ECharts 5 / Zustand 5 / `@microsoft/fetch-event-source` / dayjs

---

## 常见问题

- **前端顶栏「✗ 后端未连接」**：先确认 `backend` 窗口没报错；再检查 `backend/.env` 的 `CORS_ORIGINS` 是否包含 `http://localhost:5173`。
- **`401 Incorrect API key`**：`backend/.env` 的 `DASHSCOPE_API_KEY` 没填 / 粘错（留意末尾空格和换行），改完必须重启 uvicorn。
- **端口 8000 被占**：`Get-NetTCPConnection -LocalPort 8000` → `Stop-Process -Id <pid> -Force`。
- **SSE 一直 pending 不出事件**：生产部署需确保反代不缓冲，Nginx 请加 `proxy_buffering off;` + `X-Accel-Buffering: no`。
- **想用自己的业务库**：改 `backend/.env` 里 `DB_PATH`，并用 `SQL_INCLUDE_TABLES=t1,t2` 限制 Agent 可见表。

---

## 进一步阅读

- 详细实现方案 / 数据契约 / SSE 协议 / Qwen3 字段规范：
  [`.cursor/plans/nl2sql_智能数据分析系统规划_3605e329.plan.md`](./.cursor/plans/)
- 后端子模块详细说明：[`backend/README.md`](./backend/README.md)
- 前端子模块详细说明：[`frontend/README.md`](./frontend/README.md)

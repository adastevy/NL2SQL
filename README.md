# NL2SQL 智能数据分析系统

> FastAPI + LangChain SQL Agent + 阿里云百炼 Qwen3 × React + ECharts 三栏式前端，通过 SSE 流式返回「思考 / SQL / 数据 / 图表配置」，实现自然语言查询 SQLite 并实时渲染可视化图表。

---

## 当前进度

- [x] **Phase 1：基础框架**（后端 `/api/ping` + 前端三栏骨架 + 双端启动）
- [x] **Phase 2：前端 UI**（Mock 驱动，三栏 UI + 流式气泡 + ECharts + 数据字典）
- [ ] Phase 3：后端接口（LangChain SQL Agent + SSE）
- [ ] Phase 4：前后端联调

### Phase 2 亮点

- `mocks/mockApi.ts` + `mocks/mockSSE.ts` 完整复刻 Phase 3 的 REST + SSE 契约，3 条预设问答（TOP10 艺人柱图 / 月度销售折线 / 流派占比饼图），逐字流式 + 五类事件推送。
- Zustand 三仓：`useSessionStore` / `useChatStore` / `useChartStore`，会话切换与图表联动仅靠 store 消息流串起来。
- 左栏 `SessionList`：搜索、新建、重命名、删除、激活高亮。
- 中栏 `ChatPanel`：用户/助手气泡，助手气泡时间线式展示「思考过程（可折叠）/ SQL（高亮 + 复制）/ 数据预览（≤10 行）/ 最终回答」，支持「停止生成」。
- 右栏 `ChartPanel`：`图表 / 数据表 / SQL` 三 Tab，顶部「数据字典」抽屉展示 Chinook Schema 与样本行。

完整计划见 [`.cursor/plans/nl2sql_智能数据分析系统规划_3605e329.plan.md`](./.cursor/plans/nl2sql_%E6%99%BA%E8%83%BD%E6%95%B0%E6%8D%AE%E5%88%86%E6%9E%90%E7%B3%BB%E7%BB%9F%E8%A7%84%E5%88%92_3605e329.plan.md)。

---

## 仓库结构

```
NL2SQLAGENT/
├── backend/       # FastAPI 服务
├── frontend/      # React + Vite + AntD 单页
├── dev.ps1        # Windows 一键并行启动（开两个终端）
└── README.md
```

## 环境要求

| 组件 | 版本 |
|---|---|
| Python | 3.10+（推荐 3.11） |
| Node.js | 18+（推荐 20+） |
| npm | 9+ |

## 快速启动（Phase 1）

### 1. 安装后端依赖

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

### 2. 安装前端依赖

```powershell
cd ../frontend
npm install
```

### 3. 一键启动（推荐）

根目录执行（会在两个新窗口分别启动前后端）：

```powershell
./dev.ps1
```

### 4. 手动启动

两个终端：

```powershell
# 终端 A
cd backend
.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000

# 终端 B
cd frontend
npm run dev
```

### 5. 验证

- 后端健康检查：<http://localhost:8000/api/ping>
- Swagger：<http://localhost:8000/docs>
- 前端：<http://localhost:5173> - 顶部 Header 应显示绿色「后端已连接 ✓」

---

## 技术栈

- **后端**：Python 3.11 / FastAPI / LangChain / `langchain-openai` / SQLAlchemy / sse-starlette / aiosqlite
- **LLM**：阿里云百炼 Qwen3（OpenAI 兼容端点）
- **前端**：React 18 / Vite / TypeScript / Ant Design 5 / ECharts / Zustand / `@microsoft/fetch-event-source`

---

## 常见问题

- **前端 Header 红色「✗」**：检查后端是否启动在 `http://localhost:8000`，以及 `.env` 中 `CORS_ORIGINS` 是否包含 `http://localhost:5173`。
- **后端端口占用**：改 `.env` 的 `APP_PORT`，并同步改 `frontend/vite.config.ts` 的 `target`。

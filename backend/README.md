# NL2SQL Agent · Backend

基于 **FastAPI + LangChain v1 + Qwen3（阿里云百炼）** 的 NL2SQL 服务。

对外提供：

| 路径 | 方法 | 用途 |
| :--- | :---: | :--- |
| `/api/ping` | GET | 健康检查 |
| `/api/sessions` | GET / POST | 会话列表 / 新建 |
| `/api/sessions/{id}` | PATCH / DELETE | 重命名 / 删除 |
| `/api/sessions/{id}/messages` | GET | 按会话回放历史消息 |
| `/api/schema` | GET | 反射业务表结构 + 采样行（前端数据字典） |
| `/api/chat` | POST | **SSE 流式**：thought / sql / data / chart / final / done |

所有 DTO 走 camelCase（Pydantic `alias_generator=to_camel`），与 `frontend/src/types.ts`
一一对齐，详见 [`plan.md §3.5 前端对接契约`](../.cursor/plans/)。

---

## 运行环境

- **Python 3.10+**（推荐 3.11）
- 磁盘 ~50 MB（Chinook 示例库首次启动时自动下载）
- 需要一个 [阿里云百炼](https://bailian.console.aliyun.com/) 的 API Key

---

## 首次安装

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # Windows PowerShell
# source .venv/bin/activate             # macOS / Linux

python -m pip install --upgrade pip
pip install -r requirements.txt

Copy-Item .env.example .env             # Windows
# cp .env.example .env                   # macOS / Linux
```

编辑 `.env`，**至少填入** `DASHSCOPE_API_KEY`。

---

## 启动

```powershell
# 在 backend/ 目录下（激活 venv 后）
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

首次启动会自动：

1. 从 `CHINOOK_URL` 下载 `Chinook.db` 到本地
2. `ATTACH DATABASE` 把 11 张业务表复制进 `./app.db`
3. 创建应用表 `sessions`、`messages`

启动成功后访问：

- 健康检查：<http://127.0.0.1:8000/api/ping>
- Swagger：<http://127.0.0.1:8000/docs>
- Schema：<http://127.0.0.1:8000/api/schema>

---

## 配置说明

完整项详见 [`.env.example`](./.env.example)，关键项：

| 变量 | 默认 | 说明 |
| :--- | :--- | :--- |
| `DASHSCOPE_API_KEY` | — | **必填**，百炼 Key |
| `QWEN_MODEL` | `qwen3-max` | SQL Agent 主模型 |
| `QWEN_MODEL_CHART` | `qwen3-max` | Chart Chain（也可降配） |
| `QWEN_MODEL_TITLE` | `qwen-turbo` | 自动命名轻量模型 |
| `DB_PATH` | `./app.db` | SQLite 文件，业务表 + 应用表同库 |
| `CHINOOK_URL` | GitHub 官方 | 首次种子数据源 |
| `SQL_TOP_K` | `20` | LLM 生成 SELECT 默认 LIMIT |
| `SQL_MAX_PREVIEW_ROWS` | `1000` | 流给前端的行上限，超了会 `truncated=true` |
| `SQL_INCLUDE_TABLES` | 空 | 限制 Agent 可见的表（逗号分隔） |
| `CORS_ORIGINS` | 5173 白名单 | 允许的前端源，英文逗号分隔 |

---

## 目录结构

```
backend/
├── app/
│   ├── main.py               # FastAPI 入口（lifespan 里 seed_chinook）
│   ├── config.py             # pydantic-settings
│   ├── schemas.py            # Pydantic DTO（camelCase）
│   ├── api/
│   │   ├── sessions.py       # REST: CRUD + 历史消息
│   │   ├── schema.py         # REST: 数据字典（缓存）
│   │   └── chat.py           # SSE: /api/chat
│   ├── services/
│   │   ├── session_service.py  # 会话业务逻辑 + 自动命名
│   │   └── chat_service.py     # 核心编排：astream_events(v2) → SSE
│   ├── agent/
│   │   ├── prompts.py        # 系统提示
│   │   ├── sql_agent.py      # create_agent + SafeQuerySQLDatabaseTool
│   │   └── chart_chain.py    # LCEL chain（JsonOutputParser）
│   ├── memory/
│   │   └── sqlite_history.py # 按 sessionId 持久化到 messages 表
│   ├── llm/
│   │   └── qwen.py           # ChatOpenAI 工厂（stream_usage=True）
│   └── db/
│       ├── engine.py         # SQLAlchemy engine/Session
│       ├── models.py         # SessionORM / MessageORM
│       └── seed_chinook.py   # 幂等种子
├── scripts/                  # 本地测试脚本（gitignore 排除）
│   ├── smoke_chat.py         # SSE 单轮冒烟
│   ├── probe_contract.py     # 全端点字段契约 dump
│   └── e2e_fullflow.py       # Phase 4 端到端自检
├── .env.example
├── requirements.txt
└── README.md
```

---

## 本地测试脚本

在 `scripts/` 下（已 `.gitignore`，不入库）：

```powershell
# 启动 uvicorn 后，另开一个终端：
.\.venv\Scripts\python.exe scripts\e2e_fullflow.py
```

`e2e_fullflow.py` 会：

1. 校验 CORS 预检（`OPTIONS /api/chat` 的 `Access-Control-Allow-Origin`）
2. 校验 `/api/chat` 的 `Content-Type=text/event-stream` + `Transfer-Encoding=chunked` +
   `X-Accel-Buffering=no`
3. 新建会话 → 连续两轮 SSE 问答（第 2 轮验证上下文记忆）
4. 回放历史消息 → 校验 `assistant.meta` 的 `sql / data / chart / final / status` 完整
5. 删除会话 → 校验 list 不再包含

正常应打印 `ALL GREEN · 耗时 ~70s`，耗费少量 Qwen 调用。

---

## 常见问题

- **端口 8000 被占**：`Get-NetTCPConnection -LocalPort 8000 | Select OwningProcess` →
  `Stop-Process -Id <pid> -Force`。
- **`401 Incorrect API key`**：检查 `backend\.env` 里 `DASHSCOPE_API_KEY` 是否粘贴完整（没有额外空格/换行），重启服务生效。
- **Chinook 下载失败**：代理 / 防火墙问题。可手动把 `Chinook_Sqlite.sqlite` 放到 `backend/Chinook.db`，再启动。
- **想只让 Agent 看部分表**：`SQL_INCLUDE_TABLES=Artist,Album,InvoiceLine`。

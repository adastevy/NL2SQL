# NL2SQL Agent - Backend

基于 FastAPI 的后端服务，Phase 1 只包含最小可跑骨架 + `/api/ping` 健康检查。

## 运行环境

- Python 3.10+（推荐 3.11）
- Windows / macOS / Linux

## 首次安装

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1           # Windows PowerShell
# source .venv/bin/activate           # macOS / Linux

python -m pip install --upgrade pip
pip install -r requirements.txt

copy .env.example .env                # Windows
# cp .env.example .env                # macOS / Linux
```

填入真实的 `DASHSCOPE_API_KEY`（Phase 1 暂不使用，但后续阶段必需）。

## 启动

```powershell
# 在 backend/ 目录下
uvicorn app.main:app --reload --port 8000
```

访问：

- 健康检查：<http://localhost:8000/api/ping>
- Swagger：<http://localhost:8000/docs>

## 目录结构（Phase 1）

```
backend/
├── app/
│   ├── __init__.py
│   ├── config.py        # pydantic-settings 配置
│   └── main.py          # FastAPI 入口 + CORS + /api/ping
├── .env.example
├── .gitignore
├── requirements.txt
└── README.md
```

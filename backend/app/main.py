"""FastAPI 应用入口（Phase 3：三路由 + Chinook seed）。"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import chat as chat_api
from app.api import schema as schema_api
from app.api import sessions as sessions_api
from app.config import get_settings
from app.db.seed_chinook import seed

logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.basicConfig(
        level=settings.log_level.upper(),
        format="%(asctime)s %(levelname)s %(name)s | %(message)s",
    )
    logger.info("Starting NL2SQL Agent API（Phase 3）")
    try:
        seed()
    except Exception:  # noqa: BLE001
        logger.exception("seed_chinook 执行失败；数据库可能不完整")
    yield
    logger.info("Shutting down NL2SQL Agent API")


app = FastAPI(
    title="NL2SQL Agent API",
    description="基于 FastAPI + LangChain + 阿里云百炼 Qwen3 的自然语言数据分析后端",
    version="0.3.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/ping", tags=["health"], summary="健康检查")
async def ping() -> dict:
    return {
        "pong": True,
        "time": datetime.now(timezone.utc).isoformat(),
        "service": "nl2sql-agent",
        "version": app.version,
    }


@app.get("/", include_in_schema=False)
async def root() -> dict:
    return {
        "name": app.title,
        "version": app.version,
        "docs": "/docs",
        "ping": "/api/ping",
    }


app.include_router(sessions_api.router)
app.include_router(schema_api.router)
app.include_router(chat_api.router)

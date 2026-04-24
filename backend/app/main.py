"""FastAPI 应用入口（Phase 1：仅含健康检查）。"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings

settings = get_settings()

app = FastAPI(
    title="NL2SQL Agent API",
    description="基于 FastAPI + LangChain + 阿里云百炼 Qwen3 的自然语言数据分析后端",
    version="0.1.0",
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

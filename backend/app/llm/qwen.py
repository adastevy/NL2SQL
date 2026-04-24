"""Qwen3 @ 阿里云百炼 · LangChain 适配层。

严格遵守 `nl2sql_智能数据分析系统规划_3605e329.plan.md` §3.4.1 约束：
- 以 OpenAI 兼容端点接入 Qwen3
- `stream_usage=True` 为强制项（否则流式下拿不到 token 用量）
- Agent 与 chart_chain 使用独立实例（温度 / 模型可不同）

字段契约（响应）请同时对照 §3.4.2 ~ §3.4.5；若升级依赖后字段有变，
必须先重跑 `backend/scripts/test_qwen_integration.py` 再合并代码。
"""
from __future__ import annotations

from functools import lru_cache

from langchain_openai import ChatOpenAI

from app.config import get_settings


def _build(*, model: str, temperature: float) -> ChatOpenAI:
    settings = get_settings()
    return ChatOpenAI(
        model=model,
        base_url=settings.qwen_base_url,
        api_key=settings.dashscope_api_key,
        temperature=temperature,
        timeout=settings.llm_timeout,
        max_retries=settings.llm_max_retries,
        stream_usage=True,
    )


@lru_cache(maxsize=8)
def get_agent_llm(temperature: float = 0.0) -> ChatOpenAI:
    """SQL Agent 主模型：温度 0，保证 SQL 稳定可复现。"""
    settings = get_settings()
    return _build(model=settings.qwen_model, temperature=temperature)


@lru_cache(maxsize=8)
def get_chart_llm(temperature: float = 0.2) -> ChatOpenAI:
    """图表生成模型：温度 0.2，允许一点表达自由度。"""
    settings = get_settings()
    return _build(model=settings.qwen_model_chart, temperature=temperature)


@lru_cache(maxsize=8)
def get_title_llm(temperature: float = 0.3) -> ChatOpenAI:
    """会话标题生成：短文本，温度略高避免呆板。"""
    settings = get_settings()
    return _build(model=settings.qwen_model, temperature=temperature)

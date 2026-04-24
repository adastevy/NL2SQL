"""流式问答服务：把 LangChain `astream_events(v2)` 映射为前端 SSE 事件。

事件协议（与 `frontend/src/types.ts` 严格对齐）：
    {"type": "thought", "delta": "..."}
    {"type": "sql",     "sql": "..."}
    {"type": "data",    "data": {columns, rows, rowCount, truncated}}
    {"type": "chart",   "chart": {chartType, echartsOption, insight}}
    {"type": "final",   "delta": "..."}
    {"type": "done"}
    {"type": "error",   "message": "..."}

映射规则（规划 §3.4.6）：
    on_chat_model_stream →  非空 content → `thought` 增量（任何轮次）
    on_chat_model_end    →  若无 tool_calls → 覆盖 final_text（最后一次为准）
    on_tool_start         →  name == sql_db_query → `sql`
    on_tool_end           →  name == sql_db_query & 非错误 → `data`
    Agent 全部结束后       →  依次一次性发 `sql`(确认)/`chart`/`final` → `done`

之所以不在流式阶段发 final：Qwen3 的 ReAct 常在第一轮把候选 SQL 作为纯文本输出
（tool_calls 为空），若把它当成 final 推给前端，之后调用工具并产出真正答案时
前端会被二次覆盖，UX 上出现"答案闪烁"。统一在 Agent 结束后发一次 final 更稳。
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Dict, List, Optional

from langchain_core.messages import AIMessage, HumanMessage

from app.agent.chart_chain import generate_chart
from app.agent.sql_agent import get_sql_agent
from app.db.models import SessionORM
from app.memory.sqlite_history import SqliteChatMessageHistory
from app.services.session_service import auto_title, update_preview_and_title

logger = logging.getLogger(__name__)


async def stream_chat(
    db,
    *,
    session_id: str,
    question: str,
) -> AsyncIterator[Dict[str, Any]]:
    """核心异步生成器。调用方（FastAPI）把每个 dict 包成 SSE event。"""
    session = db.get(SessionORM, session_id)
    if not session:
        yield {"type": "error", "message": "会话不存在"}
        yield {"type": "done"}
        return

    history = SqliteChatMessageHistory(db, session_id)
    prior: List[Any] = history.messages  # 已经是 BaseMessage 列表（仅顶层问答）

    # 落库 user + 判断是否首问（用于异步刷新标题）
    is_first_turn = not prior
    history.add_user(question)

    # 执行内部状态
    started_at = datetime.now(timezone.utc)
    thought_buffer: List[str] = []
    final_text: str = ""
    last_sql: Optional[str] = None
    last_data: Optional[Dict[str, Any]] = None
    usage_meta: Optional[Dict[str, Any]] = None
    finish_reason: Optional[str] = None
    agent_error: Optional[str] = None

    try:
        agent = get_sql_agent()
        input_messages = list(prior) + [HumanMessage(content=question)]
        async for event in agent.astream_events(
            {"messages": input_messages}, version="v2"
        ):
            et = event.get("event")
            name = event.get("name")
            data = event.get("data") or {}

            if et == "on_chat_model_stream":
                chunk = data.get("chunk")
                delta = _chunk_text(chunk)
                if delta:
                    thought_buffer.append(delta)
                    yield {"type": "thought", "delta": delta}

            elif et == "on_chat_model_end":
                output = data.get("output")
                if output is None:
                    continue
                # 聚合 usage / finish_reason（最后一次覆盖）
                usage_meta = getattr(output, "usage_metadata", None) or usage_meta
                meta = getattr(output, "response_metadata", None) or {}
                fr = meta.get("finish_reason") if isinstance(meta, dict) else None
                if fr:
                    finish_reason = fr
                tool_calls = getattr(output, "tool_calls", None) or []
                if not tool_calls:
                    # 无工具调用轮：覆盖 final_text，但不立即推送，等 Agent 全部结束后再发一次
                    content = _msg_text(output)
                    if content:
                        final_text = content

            elif et == "on_tool_start" and name == "sql_db_query":
                tool_input = data.get("input") or {}
                query = _extract_query(tool_input)
                if query:
                    last_sql = query
                    yield {"type": "sql", "sql": query}

            elif et == "on_tool_end" and name == "sql_db_query":
                output = data.get("output")
                parsed = _parse_tool_output(output)
                if parsed is not None:
                    last_data = parsed
                    yield {"type": "data", "data": parsed}

        # Agent 流正常结束 → 可视化
        if last_data and last_data.get("rows"):
            chart = await generate_chart(
                question=question,
                sql=last_sql or "",
                columns=list(last_data.get("columns") or []),
                rows=list(last_data.get("rows") or []),
            )
            yield {"type": "chart", "chart": chart.model_dump(by_alias=True)}
        else:
            chart = None

        # 最终一次性推送 final（覆盖前端中间态）
        if final_text:
            yield {"type": "final", "delta": final_text}

    except Exception as exc:  # noqa: BLE001
        logger.exception("stream_chat 运行异常")
        agent_error = f"{type(exc).__name__}: {exc}"
        yield {"type": "error", "message": agent_error}
        chart = None

    finished_at = datetime.now(timezone.utc)
    status = "error" if agent_error else "done"

    # 落库 assistant meta
    meta_payload = {
        "thought": "".join(thought_buffer),
        "sql": last_sql,
        "data": last_data,
        "chart": (chart.model_dump(by_alias=True) if chart else None),
        "final": final_text,
        "status": status,
        "error": agent_error,
        "usage": usage_meta,
        "finish_reason": finish_reason,
        "started_at": started_at.isoformat(),
        "finished_at": finished_at.isoformat(),
    }
    try:
        history.add_assistant(content=final_text or "", meta=meta_payload)
    except Exception:  # noqa: BLE001
        logger.exception("assistant 消息落库失败")

    # 首问后异步生成标题
    if is_first_turn:
        try:
            title = await auto_title(question)
        except Exception:  # noqa: BLE001
            title = None
        update_preview_and_title(db, session_id, question=question, new_title=title)
    else:
        update_preview_and_title(db, session_id, question=question)

    yield {"type": "done"}


# ============ 内部工具 ============

def _chunk_text(chunk: Any) -> str:
    """AIMessageChunk.content 可能是 str 或 list[ContentBlock]。"""
    if chunk is None:
        return ""
    content = getattr(chunk, "content", chunk)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and item.get("type") == "text":
                parts.append(str(item.get("text", "")))
        return "".join(parts)
    return ""


def _msg_text(msg: Any) -> str:
    if isinstance(msg, AIMessage):
        if isinstance(msg.content, str):
            return msg.content
    return _chunk_text(msg)


def _extract_query(tool_input: Any) -> Optional[str]:
    """on_tool_start 的 data.input 可能是 {'query': ...} / dict / str。"""
    if isinstance(tool_input, dict):
        q = tool_input.get("query") or tool_input.get("input")
        if isinstance(q, str):
            return q
    if isinstance(tool_input, str):
        return tool_input
    return None


def _parse_tool_output(output: Any) -> Optional[Dict[str, Any]]:
    """`SafeQuerySQLDatabaseTool` 的返回值是 JSON 字符串（或错误前缀）。"""
    if output is None:
        return None
    # 可能是 ToolMessage
    text = getattr(output, "content", output)
    if not isinstance(text, str):
        return None
    if text.startswith(("SECURITY_ERROR", "SQL_ERROR")):
        return None
    try:
        payload = json.loads(text)
    except (TypeError, ValueError):
        return None
    if not isinstance(payload, dict):
        return None
    # 归一字段
    return {
        "columns": list(payload.get("columns") or []),
        "rows": list(payload.get("rows") or []),
        "rowCount": int(payload.get("rowCount") or len(payload.get("rows") or [])),
        "truncated": bool(payload.get("truncated") or False),
    }

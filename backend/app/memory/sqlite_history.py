"""会话历史持久化（基于 `messages` 表）。

规划对齐（§3.4.7）：
- role ∈ {user, assistant, tool}
- assistant 的 `meta_json` 持久化本轮的完整上下文：
    {
      "run_id": str,              # AIMessage.id
      "sql": str | None,          # 最后一次 sql_db_query 的 query
      "columns": list[str],
      "rows": list[list],         # 已截断到 SQL_MAX_PREVIEW_ROWS
      "truncated": bool,
      "chart": {chartType, echartsOption, insight} | None,
      "thought": str,
      "final": str,
      "status": "done|error|aborted",
      "error": str | None,
      "usage": {input_tokens, output_tokens, cache_read} | None,
      "finish_reason": str | None,
      "started_at": iso,
      "finished_at": iso
    }

只回放用户问题与助手最终答案（不包含工具轮），让下一轮 Agent 拿到语义上下文，
但不会被过往工具调用结构干扰。
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, List, Optional

from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from sqlalchemy import select
from sqlalchemy.orm import Session as SASession

from app.db.models import MessageORM

logger = logging.getLogger(__name__)


class SqliteChatMessageHistory(BaseChatMessageHistory):
    """每个会话一个实例。构造时注入 SQLAlchemy Session 与 session_id。"""

    def __init__(self, db: SASession, session_id: str):
        self._db = db
        self._session_id = session_id

    # ------------ BaseChatMessageHistory 协议 ------------

    @property
    def messages(self) -> List[BaseMessage]:  # type: ignore[override]
        """仅返回顶层问答对（user/assistant content），供下一轮 Agent 消费。"""
        stmt = (
            select(MessageORM)
            .where(MessageORM.session_id == self._session_id)
            .where(MessageORM.role.in_(("user", "assistant")))
            .order_by(MessageORM.created_at)
        )
        rows = self._db.execute(stmt).scalars().all()
        out: List[BaseMessage] = []
        for m in rows:
            if m.role == "user":
                out.append(HumanMessage(content=m.content or ""))
            else:
                # assistant: 优先用 meta.final，否则用 content
                final = _meta_get(m.meta_json, "final")
                out.append(AIMessage(content=final or m.content or ""))
        return out

    def add_message(self, message: BaseMessage) -> None:  # type: ignore[override]
        """兼容 LangChain 默认接口；本项目一般用下方的具体方法。"""
        role = "assistant" if isinstance(message, AIMessage) else "user"
        self.add_plain(role=role, content=str(message.content))

    def clear(self) -> None:  # type: ignore[override]
        self._db.query(MessageORM).filter(MessageORM.session_id == self._session_id).delete()
        self._db.commit()

    # ------------ 项目专用便捷方法 ------------

    def add_user(self, content: str) -> MessageORM:
        row = MessageORM(session_id=self._session_id, role="user", content=content, meta_json=None)
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row

    def add_assistant(
        self,
        *,
        content: str,
        meta: Optional[dict[str, Any]] = None,
    ) -> MessageORM:
        row = MessageORM(
            session_id=self._session_id,
            role="assistant",
            content=content,
            meta_json=_dumps(meta) if meta else None,
        )
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row


# ============ 工具函数 ============

def _dumps(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, default=_default)


def _default(o: Any) -> Any:
    if isinstance(o, datetime):
        if o.tzinfo is None:
            o = o.replace(tzinfo=timezone.utc)
        return o.isoformat()
    raise TypeError(f"Object of type {type(o).__name__} is not JSON serializable")


def _meta_get(meta_json: Optional[str], key: str) -> Any:
    if not meta_json:
        return None
    try:
        return json.loads(meta_json).get(key)
    except (TypeError, ValueError):
        return None

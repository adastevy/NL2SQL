"""会话管理服务层：CRUD + 消息回放 + 首问自动生成标题。"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException
from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.prompts import TITLE_SYSTEM_PROMPT
from app.db.models import MessageORM, SessionORM
from app.llm.qwen import get_title_llm
from app.schemas import AssistantMeta, MessageOut, SessionOut

logger = logging.getLogger(__name__)


def _to_session_out(row: SessionORM) -> SessionOut:
    return SessionOut(
        id=row.id,
        title=row.title,
        preview=row.preview,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def list_sessions(db: Session) -> List[SessionOut]:
    stmt = select(SessionORM).order_by(SessionORM.updated_at.desc())
    rows = db.execute(stmt).scalars().all()
    return [_to_session_out(r) for r in rows]


def create_session(db: Session, *, title: Optional[str] = None) -> SessionOut:
    row = SessionORM(title=title or "新会话")
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_session_out(row)


def rename_session(db: Session, session_id: str, *, title: str) -> SessionOut:
    row = db.get(SessionORM, session_id)
    if not row:
        raise HTTPException(status_code=404, detail="会话不存在")
    row.title = title.strip() or row.title
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return _to_session_out(row)


def delete_session(db: Session, session_id: str) -> None:
    row = db.get(SessionORM, session_id)
    if not row:
        raise HTTPException(status_code=404, detail="会话不存在")
    db.delete(row)
    db.commit()


def list_messages(db: Session, session_id: str) -> List[MessageOut]:
    session = db.get(SessionORM, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    stmt = (
        select(MessageORM)
        .where(MessageORM.session_id == session_id)
        .where(MessageORM.role.in_(("user", "assistant")))
        .order_by(MessageORM.created_at)
    )
    rows = db.execute(stmt).scalars().all()
    out: List[MessageOut] = []
    for m in rows:
        if m.role == "user":
            out.append(
                MessageOut(
                    id=m.id,
                    role="user",
                    session_id=m.session_id,
                    created_at=m.created_at,
                    content=m.content,
                )
            )
        else:
            out.append(
                MessageOut(
                    id=m.id,
                    role="assistant",
                    session_id=m.session_id,
                    created_at=m.created_at,
                    meta=_meta_from_json(m.meta_json, fallback=m.content, created_at=m.created_at),
                )
            )
    return out


def _meta_from_json(
    meta_json: Optional[str], *, fallback: str, created_at: datetime
) -> AssistantMeta:
    """把落库的 meta_json 还原为前端消费的 AssistantMeta。"""
    data: dict = {}
    if meta_json:
        try:
            data = json.loads(meta_json) or {}
        except (TypeError, ValueError):
            logger.warning("meta_json 解析失败，回退为纯文本")

    started_at = _parse_dt(data.get("started_at"), default=created_at)
    finished_at = _parse_dt(data.get("finished_at"), default=None)

    return AssistantMeta(
        thought=data.get("thought"),
        sql=data.get("sql"),
        data=data.get("data"),  # 已是 QueryResult dict 结构，Pydantic 会自动转
        chart=data.get("chart"),
        final=data.get("final") or fallback or None,
        status=data.get("status", "done"),
        error=data.get("error"),
        started_at=started_at,
        finished_at=finished_at,
    )


def _parse_dt(v, *, default):
    if not v:
        return default
    try:
        return datetime.fromisoformat(v)
    except (TypeError, ValueError):
        return default


async def auto_title(question: str) -> str:
    """首问时用 Qwen3 生成一个精炼标题（≤12 字）。失败回退为 question 首 12 字。"""
    fallback = (question or "新会话").strip().replace("\n", " ")[:12] or "新会话"
    try:
        llm = get_title_llm()
        resp = await llm.ainvoke(
            [
                SystemMessage(content=TITLE_SYSTEM_PROMPT),
                HumanMessage(content=question),
            ]
        )
        title = (resp.content or "").strip().splitlines()[0][:24] if resp else ""
        return title or fallback
    except Exception as exc:  # noqa: BLE001
        logger.warning("auto_title 失败，回退截断：%s", exc)
        return fallback


def update_preview_and_title(
    db: Session,
    session_id: str,
    *,
    question: str,
    new_title: Optional[str] = None,
) -> None:
    """首问后刷新会话列表显示：preview + 可选的 title。"""
    row = db.get(SessionORM, session_id)
    if not row:
        return
    preview = (question or "").strip().replace("\n", " ")[:80]
    row.preview = preview
    if new_title:
        row.title = new_title
    row.updated_at = datetime.now(timezone.utc)
    db.commit()

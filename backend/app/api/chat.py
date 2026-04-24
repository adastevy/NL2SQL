"""REST · POST /api/chat · Server-Sent Events 流式问答。"""
from __future__ import annotations

import json
import logging
from typing import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from app.db.engine import get_db
from app.schemas import ChatRequest
from app.services.chat_service import stream_chat

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


def _dump(ev: dict) -> str:
    return json.dumps(ev, ensure_ascii=False, default=str)


@router.post("")
async def chat(payload: ChatRequest, db: Session = Depends(get_db)):
    if not payload.question or not payload.question.strip():
        raise HTTPException(status_code=400, detail="question 不能为空")
    if not payload.session_id:
        raise HTTPException(status_code=400, detail="sessionId 必填")

    async def event_source() -> AsyncIterator[dict]:
        try:
            async for ev in stream_chat(
                db,
                session_id=payload.session_id,
                question=payload.question,
            ):
                # sse-starlette 的标准格式：{"data": "...", "event": "message"?}
                yield {"data": _dump(ev)}
        except Exception as exc:  # noqa: BLE001 —— 双保险
            logger.exception("/api/chat 未捕获异常")
            yield {"data": _dump({"type": "error", "message": f"{type(exc).__name__}: {exc}"})}
            yield {"data": _dump({"type": "done"})}

    return EventSourceResponse(event_source(), media_type="text/event-stream")

"""REST · /api/sessions 会话增删改查 + 历史消息。"""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.engine import get_db
from app.schemas import MessageOut, SessionCreate, SessionOut, SessionUpdate
from app.services import session_service

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.get("", response_model=List[SessionOut], response_model_by_alias=True)
def list_sessions(db: Session = Depends(get_db)):
    return session_service.list_sessions(db)


@router.post("", response_model=SessionOut, response_model_by_alias=True)
def create_session(payload: SessionCreate | None = None, db: Session = Depends(get_db)):
    title = payload.title if payload else None
    return session_service.create_session(db, title=title)


@router.patch("/{session_id}", response_model=SessionOut, response_model_by_alias=True)
def rename_session(session_id: str, payload: SessionUpdate, db: Session = Depends(get_db)):
    return session_service.rename_session(db, session_id, title=payload.title)


@router.delete("/{session_id}", status_code=204)
def delete_session(session_id: str, db: Session = Depends(get_db)):
    session_service.delete_session(db, session_id)
    return None


@router.get(
    "/{session_id}/messages",
    response_model=List[MessageOut],
    response_model_by_alias=True,
)
def list_messages(session_id: str, db: Session = Depends(get_db)):
    return session_service.list_messages(db, session_id)

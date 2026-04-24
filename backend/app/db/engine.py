"""SQLAlchemy 引擎 + Session 工厂。

NL2SQL 项目只有一个 SQLite 文件（`app.db`），同时承载：
- 业务域：Chinook 数据表（Album / Artist / Customer / ...），由 `seed_chinook` 初始化
- 应用域：`sessions` / `messages`（会话与消息），由 ORM 负责

Agent 侧通过 `SQLDatabase.from_uri(... include_tables=[...])` 白名单
只能看到业务域表，天然不会被自由查询到应用域表。
"""
from __future__ import annotations

from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings

settings = get_settings()

# check_same_thread=False：FastAPI 同步依赖项跨线程要求
_engine = create_engine(
    settings.sqlalchemy_url,
    connect_args={"check_same_thread": False},
    future=True,
    echo=False,
)

SessionLocal = sessionmaker(bind=_engine, autocommit=False, autoflush=False, expire_on_commit=False)


def get_engine():
    """供 seed_chinook / 测试脚本直接取引擎。"""
    return _engine


def get_db() -> Iterator[Session]:
    """FastAPI 依赖：请求级同步 Session。"""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()

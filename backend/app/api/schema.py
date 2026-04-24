"""REST · /api/schema 数据字典（业务表结构 + 样本行）。"""
from __future__ import annotations

import logging
from functools import lru_cache

from fastapi import APIRouter
from sqlalchemy import inspect, text

from app.config import get_settings
from app.db.engine import get_engine
from app.schemas import SchemaColumn, SchemaOut, SchemaTable

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/schema", tags=["schema"])


def _fetch_sample_rows(engine, table_name: str, limit: int = 3):
    with engine.connect() as conn:
        rs = conn.execute(text(f'SELECT * FROM "{table_name}" LIMIT :n'), {"n": limit})
        cols = list(rs.keys())
        rows = [list(r) for r in rs.fetchall()]
    return cols, rows


@lru_cache(maxsize=1)
def _cached_schema() -> SchemaOut:
    """启动后首次请求时反射一次；Chinook 结构不会变，缓存到进程结束。"""
    settings = get_settings()
    engine = get_engine()
    inspector = inspect(engine)

    whitelist = settings.include_tables_list
    tables = []
    for table_name in inspector.get_table_names():
        if table_name not in whitelist:
            continue
        try:
            columns_meta = inspector.get_columns(table_name)
        except Exception as exc:  # noqa: BLE001
            logger.warning("反射表 %s 失败：%s", table_name, exc)
            continue

        columns = [
            SchemaColumn(
                name=c["name"],
                type=str(c.get("type", "")),
                nullable=c.get("nullable"),
                comment=c.get("comment"),
            )
            for c in columns_meta
        ]

        try:
            _, sample_rows = _fetch_sample_rows(engine, table_name)
        except Exception as exc:  # noqa: BLE001
            logger.warning("采样表 %s 失败：%s", table_name, exc)
            sample_rows = []

        tables.append(
            SchemaTable(
                name=table_name,
                columns=columns,
                sample_rows=sample_rows,
            )
        )
    # 按白名单顺序排序，保持前端列表视觉稳定
    order = {name: i for i, name in enumerate(whitelist)}
    tables.sort(key=lambda t: order.get(t.name, 999))
    return SchemaOut(tables=tables)


@router.get("", response_model=SchemaOut, response_model_by_alias=True)
def get_schema() -> SchemaOut:
    return _cached_schema()

"""首次启动：下载 Chinook 示例库 + 建应用表。

策略（幂等）：
1. 若 `app.db` 不存在 → 下载 Chinook.db 作为 app.db。
2. 若 `app.db` 存在但缺业务表 Artist（Phase 1/2 残留） → 下载 Chinook.db 到缓存，
   通过 SQLite ATTACH + CREATE TABLE AS SELECT 把 11 张业务表复制过来。
3. 无论如何，最后 `Base.metadata.create_all()` 保证 sessions/messages 存在。
"""
from __future__ import annotations

import logging
import sqlite3
from pathlib import Path

import requests

from app.config import get_settings
from app.db.engine import get_engine
from app.db.models import Base

logger = logging.getLogger(__name__)

# Chinook 11 张业务表
CHINOOK_TABLES = [
    "Album",
    "Artist",
    "Customer",
    "Employee",
    "Genre",
    "Invoice",
    "InvoiceLine",
    "MediaType",
    "Playlist",
    "PlaylistTrack",
    "Track",
]


def _download_chinook(cache_path: Path, url: str) -> None:
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    logger.info("下载 Chinook 示例库: %s -> %s", url, cache_path)
    resp = requests.get(url, timeout=60)
    resp.raise_for_status()
    cache_path.write_bytes(resp.content)
    logger.info("Chinook 下载完成（%d 字节）", len(resp.content))


def _has_business_tables(db_path: Path) -> bool:
    if not db_path.exists():
        return False
    conn = sqlite3.connect(db_path.as_posix())
    try:
        cur = conn.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='Artist'"
        )
        return cur.fetchone()[0] > 0
    finally:
        conn.close()


def _copy_chinook_into(db_path: Path, chinook_path: Path) -> None:
    """用 ATTACH 将 Chinook 的 11 张业务表 + 索引 复制到 db_path。"""
    logger.info("将 Chinook 业务表复制到 %s", db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path.as_posix())
    try:
        conn.execute(f"ATTACH DATABASE '{chinook_path.as_posix()}' AS src")
        # 按依赖顺序复制（父表先于子表）
        for table in CHINOOK_TABLES:
            conn.execute(f"DROP TABLE IF EXISTS \"{table}\"")
            conn.execute(f'CREATE TABLE "{table}" AS SELECT * FROM src."{table}"')
        conn.execute("DETACH DATABASE src")
        conn.commit()
        logger.info("Chinook 业务表复制完成：%s", ", ".join(CHINOOK_TABLES))
    finally:
        conn.close()


def seed() -> None:
    settings = get_settings()
    db_path = settings.db_path_resolved
    logger.info("应用数据库路径: %s", db_path)

    if not db_path.exists():
        # 直接下载 Chinook 作为 app.db 的初始内容
        _download_chinook(db_path, settings.chinook_url)
    elif not _has_business_tables(db_path):
        # 已有 app.db 但缺业务表（常见于 Phase 1/2 残留）——下载到缓存再 ATTACH
        cache = db_path.parent / ".cache" / "Chinook.db"
        if not cache.exists():
            _download_chinook(cache, settings.chinook_url)
        _copy_chinook_into(db_path, cache)
    else:
        logger.info("app.db 已包含业务表，跳过 Chinook seed")

    # 不论以上哪种情况，都确保应用表存在
    engine = get_engine()
    Base.metadata.create_all(engine)
    logger.info("应用表（sessions / messages）已就绪")

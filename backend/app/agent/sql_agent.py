"""SQL Agent · LangChain v1 (`create_agent`) 实现。

契约：
- 数据层：`SQLDatabase.from_uri(uri, include_tables=[...], sample_rows_in_table_info=3)`
- 工具层：`SQLDatabaseToolkit(db, llm).get_tools()` → 返回
    - `sql_db_list_tables`
    - `sql_db_schema`
    - `sql_db_query_checker`
    - `sql_db_query`   ← **替换为 SafeQuerySQLDatabaseTool 拦截 DML/DDL +
                         返回结构化 JSON**
- 应用层：`langchain.agents.create_agent(model, tools, system_prompt=...)`

对应规划文档 §3.2 / §3.4.6。
"""
from __future__ import annotations

import json
import logging
import re
from functools import lru_cache
from typing import Any

from langchain.agents import create_agent
from langchain_community.agent_toolkits import SQLDatabaseToolkit
from langchain_community.tools.sql_database.tool import QuerySQLDatabaseTool
from langchain_community.utilities import SQLDatabase
from sqlalchemy import text

from app.agent.prompts import SQL_AGENT_SYSTEM_PROMPT
from app.config import get_settings
from app.llm.qwen import get_agent_llm

logger = logging.getLogger(__name__)


# 禁用的 SQL 关键字（即便用户绕过系统提示词，工具层也会拦截）
_FORBIDDEN_SQL = re.compile(
    r"(?i)\b(?:insert|update|delete|drop|alter|truncate|replace|create|grant|revoke|attach|detach|pragma)\b"
)


def _execute_query(db: SQLDatabase, query: str, max_rows: int) -> dict:
    """直接走 SQLAlchemy 引擎执行，返回 {columns, rows, rowCount, truncated}。"""
    engine = db._engine  # 通过官方公开 attr 拿 engine
    with engine.connect() as conn:
        rs = conn.execute(text(query))
        columns = list(rs.keys())
        fetched = rs.fetchmany(max_rows + 1)
    truncated = len(fetched) > max_rows
    rows = [list(r) for r in fetched[:max_rows]]
    return {
        "columns": columns,
        "rows": rows,
        "rowCount": len(rows),
        "truncated": truncated,
    }


class SafeQuerySQLDatabaseTool(QuerySQLDatabaseTool):
    """只读 SQL 执行工具：拦截 DML/DDL + 返回结构化 JSON。

    返回字符串是合法 JSON：
        {"columns": [...], "rows": [[...], ...], "rowCount": int, "truncated": bool}
    Agent 消费 JSON 比 tuple 字符串更稳定，chat_service 也能直接 `json.loads` 构造 SSE data 事件。
    """

    def _run(self, query: str, run_manager: Any = None) -> str:  # type: ignore[override]
        if not query or not query.strip():
            return "SECURITY_ERROR: 空查询被拒绝。"
        if _FORBIDDEN_SQL.search(query):
            logger.warning("拦截到非只读 SQL: %s", query)
            return (
                "SECURITY_ERROR: 本系统仅允许只读 SELECT 查询；"
                "检测到 DML/DDL 关键字，请重写为 SELECT。"
            )
        settings = get_settings()
        try:
            payload = _execute_query(self.db, query, settings.sql_max_preview_rows)
        except Exception as exc:  # noqa: BLE001
            return f"SQL_ERROR: {type(exc).__name__}: {exc}"
        return json.dumps(payload, ensure_ascii=False, default=str)

    async def _arun(self, query: str, run_manager: Any = None) -> str:  # type: ignore[override]
        # SQLite 无真正异步驱动层受益（aiosqlite 有但 SQLDatabase 默认同步 engine），
        # 故直接复用同步实现，保证事件循环中不阻塞过久即可。
        return self._run(query, run_manager=run_manager)


def build_sqldatabase() -> SQLDatabase:
    """包装 SQLAlchemy → LangChain SQLDatabase。"""
    settings = get_settings()
    return SQLDatabase.from_uri(
        settings.sqlalchemy_url,
        include_tables=settings.include_tables_list,
        sample_rows_in_table_info=settings.sql_sample_rows_in_table_info,
    )


def _build_tools(db: SQLDatabase, llm: Any) -> list:
    """沿用官方 Toolkit 的 4 个工具，把 `sql_db_query` 换成安全子类。"""
    toolkit = SQLDatabaseToolkit(db=db, llm=llm)
    tools = []
    for t in toolkit.get_tools():
        if t.name == "sql_db_query":
            tools.append(SafeQuerySQLDatabaseTool(db=db))
        else:
            tools.append(t)
    return tools


@lru_cache(maxsize=1)
def get_sql_agent() -> Any:
    """构造 Agent 单例。

    `create_agent` 在 LangChain v1 中返回一个 LangGraph 编译后的 Runnable，
    支持：
        - `.invoke({"messages": [...]})`
        - `.stream(..., stream_mode="values")`
        - `.astream_events({"messages": [...]}, version="v2")`
    """
    settings = get_settings()
    db = build_sqldatabase()
    llm = get_agent_llm()
    tools = _build_tools(db, llm)
    system_prompt = SQL_AGENT_SYSTEM_PROMPT.format(
        dialect=db.dialect,
        top_k=settings.sql_top_k,
    )
    logger.info(
        "构造 SQL Agent：dialect=%s, include_tables=%s, tools=%s",
        db.dialect,
        settings.include_tables_list,
        [t.name for t in tools],
    )
    return create_agent(llm, tools, system_prompt=system_prompt)

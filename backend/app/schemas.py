"""Pydantic DTO：REST / SSE 出入参类型。

与前端 `frontend/src/types.ts` 严格对齐：
- 字段名在 Python 侧用 snake_case
- 通过 `alias_generator=to_camel` 使 JSON 输出为 camelCase
- `populate_by_name=True` 允许前端以 camelCase 入参、内部仍然以 snake_case 取值
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


# ============ 公共基类 ============

class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


Primitive = Union[str, int, float, bool, None]


# ============ 会话 ============

class SessionOut(CamelModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    preview: Optional[str] = None


class SessionCreate(CamelModel):
    title: Optional[str] = None


class SessionUpdate(CamelModel):
    title: str


# ============ 消息 ============

class QueryResult(CamelModel):
    columns: List[str] = Field(default_factory=list)
    rows: List[List[Primitive]] = Field(default_factory=list)
    row_count: int = 0
    truncated: bool = False


ChartType = Literal["bar", "line", "pie", "table"]


class ChartPayload(CamelModel):
    chart_type: ChartType = "table"
    echarts_option: dict[str, Any] = Field(default_factory=dict)
    insight: Optional[str] = None


AssistantStatus = Literal["streaming", "done", "error", "aborted"]


class AssistantMeta(CamelModel):
    thought: Optional[str] = None
    sql: Optional[str] = None
    data: Optional[QueryResult] = None
    chart: Optional[ChartPayload] = None
    final: Optional[str] = None
    status: AssistantStatus = "done"
    error: Optional[str] = None
    started_at: datetime
    finished_at: Optional[datetime] = None


class MessageOut(CamelModel):
    """历史消息回放 DTO。user 消息用 content；assistant 消息用 meta。"""

    id: str
    role: Literal["user", "assistant"]
    session_id: str
    created_at: datetime
    content: Optional[str] = None
    meta: Optional[AssistantMeta] = None


# ============ Chat / SSE ============

class ChatRequest(CamelModel):
    session_id: str
    question: str


# ============ Schema（数据字典） ============

class SchemaColumn(CamelModel):
    name: str
    type: str
    nullable: Optional[bool] = None
    comment: Optional[str] = None


class SchemaTable(CamelModel):
    name: str
    comment: Optional[str] = None
    columns: List[SchemaColumn] = Field(default_factory=list)
    sample_rows: List[List[Primitive]] = Field(default_factory=list)


class SchemaOut(CamelModel):
    tables: List[SchemaTable] = Field(default_factory=list)

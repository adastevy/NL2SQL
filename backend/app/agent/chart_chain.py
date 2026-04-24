"""图表生成链。

输入：{question, sql, columns, rows}
输出：ChartPayload（chartType / echartsOption / insight）

实现：LCEL 最小链：ChatPromptTemplate → chart_llm → JsonOutputParser（带修复）
任一环节失败 → 回退为 `chartType="table"` 的空 option，前端可直接展示数据表。
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List

from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate

from app.agent.prompts import CHART_SYSTEM_PROMPT
from app.llm.qwen import get_chart_llm
from app.schemas import ChartPayload

logger = logging.getLogger(__name__)


def _rows_preview(rows: List[List[Any]], limit: int = 20) -> str:
    preview = rows[:limit]
    return json.dumps(preview, ensure_ascii=False, default=str)


async def generate_chart(
    *,
    question: str,
    sql: str,
    columns: List[str],
    rows: List[List[Any]],
) -> ChartPayload:
    """调用 Qwen3 产出 ECharts 配置。任何失败都回退到表格。"""
    if not columns or not rows:
        return ChartPayload(chart_type="table", echarts_option={}, insight="查询无结果")

    prompt = ChatPromptTemplate.from_messages([("system", CHART_SYSTEM_PROMPT)])
    chain = prompt | get_chart_llm() | JsonOutputParser()

    try:
        raw: Dict[str, Any] = await chain.ainvoke(
            {
                "question": question,
                "sql": sql,
                "columns": json.dumps(columns, ensure_ascii=False),
                "rows_preview": _rows_preview(rows),
            }
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("chart_chain 解析失败，回退为 table：%s", exc)
        return ChartPayload(
            chart_type="table",
            echarts_option={},
            insight="图表生成失败，已降级为数据表展示",
        )

    chart_type = str(raw.get("chartType", "table")).lower()
    if chart_type not in {"bar", "line", "pie", "table"}:
        chart_type = "table"

    echarts_option = raw.get("echartsOption") or {}
    if not isinstance(echarts_option, dict):
        echarts_option = {}

    insight = raw.get("insight")
    if insight is not None and not isinstance(insight, str):
        insight = str(insight)

    return ChartPayload(
        chart_type=chart_type,  # type: ignore[arg-type]
        echarts_option=echarts_option,
        insight=insight,
    )

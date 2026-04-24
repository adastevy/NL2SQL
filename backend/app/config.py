"""应用配置：从 .env / 环境变量读取。"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ========== LLM ==========
    dashscope_api_key: str = Field(default="", description="阿里云百炼 API Key")
    qwen_model: str = Field(default="qwen3-max", description="Qwen3 Agent 主模型")
    qwen_model_chart: str = Field(
        default="qwen3-max", description="图表生成链使用的模型（默认同主模型）"
    )
    qwen_base_url: str = Field(
        default="https://dashscope.aliyuncs.com/compatible-mode/v1",
        description="百炼 OpenAI 兼容端点",
    )
    llm_timeout: int = Field(default=60, description="LLM 单次请求超时（秒）")
    llm_max_retries: int = Field(default=2, description="LLM 请求失败自动重试次数")

    # ========== SQL Agent ==========
    sql_top_k: int = Field(default=20, description="系统提示词中默认 LIMIT 行数")
    sql_max_preview_rows: int = Field(
        default=200, description="SSE data 事件返回给前端的最大预览行数"
    )
    sql_include_tables: str = Field(
        default=(
            "Album,Artist,Customer,Employee,Genre,Invoice,InvoiceLine,"
            "MediaType,Playlist,PlaylistTrack,Track"
        ),
        description="业务表白名单（英文逗号分隔）",
    )
    sql_sample_rows_in_table_info: int = Field(
        default=3, description="SQLDatabase 注入到 table_info 的样本行数"
    )

    # ========== 数据库 ==========
    db_path: str = Field(default="./app.db", description="SQLite 文件路径")
    chinook_url: str = Field(
        default="https://storage.googleapis.com/benchmarks-artifacts/chinook/Chinook.db",
        description="首次启动时下载的 Chinook 样例数据 URL",
    )

    # ========== CORS / Server ==========
    cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173",
        description="允许的前端来源（英文逗号分隔）",
    )
    app_host: str = Field(default="0.0.0.0")
    app_port: int = Field(default=8000)
    log_level: str = Field(default="info")

    @property
    def cors_origin_list(self) -> List[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]

    @property
    def include_tables_list(self) -> List[str]:
        return [x.strip() for x in self.sql_include_tables.split(",") if x.strip()]

    @property
    def db_path_resolved(self) -> Path:
        """把相对路径解析为 backend/ 下的绝对路径，避免 uvicorn 工作目录切换出错。"""
        p = Path(self.db_path)
        if not p.is_absolute():
            p = Path(__file__).resolve().parent.parent / p
        return p

    @property
    def sqlalchemy_url(self) -> str:
        return f"sqlite:///{self.db_path_resolved.as_posix()}"

    @property
    def sqlalchemy_async_url(self) -> str:
        return f"sqlite+aiosqlite:///{self.db_path_resolved.as_posix()}"


@lru_cache
def get_settings() -> Settings:
    """单例配置入口（模块级缓存）。"""
    return Settings()

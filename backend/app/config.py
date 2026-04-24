"""应用配置：从 .env / 环境变量读取。"""
from __future__ import annotations

from functools import lru_cache
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

    dashscope_api_key: str = Field(default="", description="阿里云百炼 API Key")
    qwen_model: str = Field(default="qwen3-max", description="Qwen3 模型名")
    qwen_base_url: str = Field(
        default="https://dashscope.aliyuncs.com/compatible-mode/v1",
        description="百炼 OpenAI 兼容端点",
    )

    db_path: str = Field(default="./app.db", description="SQLite 文件路径")

    # 以字符串形式从 .env 读取，避免 pydantic-settings 把 CSV 当作 JSON 解析
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


@lru_cache
def get_settings() -> Settings:
    """单例配置入口（模块级缓存）。"""
    return Settings()

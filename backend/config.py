"""Configuration settings for Life Dashboard."""
import os
from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Server
    port: int = 8081
    host: str = "0.0.0.0"
    debug: bool = False

    # Database
    database_url: str = "sqlite:///./data/life_dashboard.db"

    # Last.fm
    lastfm_api_key: str = ""
    lastfm_user: str = ""

    # WakaTime
    wakatime_api_key: str = ""

    # ActivityWatch
    activitywatch_host: str = "http://localhost:5600"

    # GitHub
    github_token: str = ""
    github_username: str = ""

    # Cache TTL (seconds)
    cache_ttl_seconds: int = 900  # 15 minutes
    nowplaying_cache_ttl: int = 30  # 30 seconds

    # Paths
    base_dir: Path = Path(__file__).parent.parent
    data_dir: Path = base_dir / "data"
    frontend_dir: Path = base_dir / "frontend"
    templates_dir: Path = frontend_dir / "templates"
    static_dir: Path = frontend_dir / "static"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()

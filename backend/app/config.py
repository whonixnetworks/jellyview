"""FastAPI application configuration using pydantic-settings."""
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Jellyfin connection
    jellyfin_url: str = "http://localhost:8096"
    jellyfin_api_key: Optional[str] = None

    # Database
    data_dir: str = "/app/data"
    db_url: str = "sqlite:////app/data/jellyview.db"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "INFO"

    # Data retention
    history_retention_days: int = 365

    # Timezone
    tz: str = "UTC"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


# Global settings instance
settings = Settings()

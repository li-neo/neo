from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache

PROJECT_ROOT = Path(__file__).resolve().parents[3]  # neo/


class Settings(BaseSettings):
    app_name: str = "neo"
    app_env: str = "development"
    debug: bool = True
    secret_key: str = "change-me"

    # MySQL
    mysql_host: str = "localhost"
    mysql_port: int = 3306
    mysql_user: str = "neo"
    mysql_password: str = "change-me"
    mysql_database: str = "neo"

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_prefix: str = "/api/v1"
    cors_origins: list[str] = ["http://localhost:3000"]

    # GitHub OAuth
    github_client_id: str = ""
    github_client_secret: str = ""
    github_redirect_uri: str = "http://localhost:8000/api/v1/auth/github/callback"

    # Hugging Face
    hf_token: str = ""
    hf_api_url: str = "https://huggingface.co/api"

    # JWT
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080  # 7 days

    # OpenClaw
    openclaw_api_url: str = ""
    openclaw_api_key: str = ""

    # MCP
    mcp_enabled: bool = False
    mcp_endpoint: str = ""

    @property
    def database_url(self) -> str:
        return (
            f"mysql+pymysql://{self.mysql_user}:{self.mysql_password}"
            f"@{self.mysql_host}:{self.mysql_port}/{self.mysql_database}"
            "?charset=utf8mb4"
        )

    model_config = {
        "env_file": [str(PROJECT_ROOT / ".env"), ".env"],
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    return Settings()

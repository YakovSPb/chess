from pathlib import Path

from pydantic_settings import BaseSettings


def _env_file_paths() -> tuple[str, ...]:
    """Ищет .env от apps/api/app вверх до корня monorepo (docker-compose.yml)."""
    paths: list[str] = []
    for parent in Path(__file__).resolve().parents:
        paths.append(str(parent / ".env"))
        if (parent / "docker-compose.yml").is_file():
            break
    paths.append(".env")
    return tuple(dict.fromkeys(paths))


class Settings(BaseSettings):
    database_url: str = "postgresql://chess:chess@localhost:15432/chess"
    jwt_secret: str = "dev-secret"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7
    admin_username: str = "admin"
    admin_password: str = "Porter777"
    openai_api_key: str = ""
    openai_api_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"
    cors_origins: str = "http://localhost:5173"
    # Personal token с https://lichess.org/account/oauth/token — для частых ходов в дебютах
    lichess_api_token: str = ""

    @property
    def llm_model(self) -> str:
        return self.openai_model.strip() or "gpt-4o-mini"

    class Config:
        env_file = _env_file_paths()
        extra = "ignore"


settings = Settings()

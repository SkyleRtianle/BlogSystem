from dataclasses import dataclass
import os


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "BlogSystem")
    app_env: str = os.getenv("APP_ENV", "development")
    api_prefix: str = os.getenv("API_PREFIX", "/api")
    cors_origins: list[str] = None

    def __post_init__(self) -> None:
        if self.cors_origins is None:
            origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
            object.__setattr__(self, "cors_origins", _split_csv(origins))


settings = Settings()

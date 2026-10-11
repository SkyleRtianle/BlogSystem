from dataclasses import dataclass
import os
from pathlib import Path

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[2]
# Cloud environment variables always take precedence over local development files.
if os.getenv("VERCEL_ENV") not in {"preview", "production"}:
    load_dotenv(BACKEND_DIR / ".env", override=False)


def _is_deployed() -> bool:
    return os.getenv("VERCEL_ENV") in {"preview", "production"} or os.getenv("APP_ENV") == "production"


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "BlogSystem")
    app_env: str = os.getenv("APP_ENV", "development")
    api_prefix: str = os.getenv("API_PREFIX", "/api")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./blogsystem.db")
    deployed: bool = _is_deployed()
    photo_storage: str = os.getenv("PHOTO_STORAGE", "r2" if _is_deployed() else "local")
    photo_upload_dir: Path = Path(os.getenv("PHOTO_UPLOAD_DIR", str(BACKEND_DIR / "uploads" / "photos")))
    photo_max_bytes: int = 20 * 1024 * 1024
    r2_account_id: str = os.getenv("R2_ACCOUNT_ID", "")
    r2_access_key_id: str = os.getenv("R2_ACCESS_KEY_ID", "")
    r2_secret_access_key: str = os.getenv("R2_SECRET_ACCESS_KEY", "")
    r2_bucket_name: str = os.getenv("R2_BUCKET_NAME", "")
    r2_public_base_url: str = os.getenv("R2_PUBLIC_BASE_URL", "").rstrip("/")
    cors_origins: list[str] = None

    def __post_init__(self) -> None:
        if self.cors_origins is None:
            origins = os.getenv(
                "CORS_ORIGINS",
                "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,http://localhost:3002,http://127.0.0.1:3002",
            )
            object.__setattr__(self, "cors_origins", _split_csv(origins))

    def validate_database(self) -> None:
        if self.deployed:
            if not self.database_url.startswith(("postgres://", "postgresql://", "postgresql+psycopg://")):
                raise RuntimeError("Production requires a Neon PostgreSQL DATABASE_URL; local SQLite is only for development")

    def validate_runtime(self) -> None:
        self.validate_database()
        if self.deployed:
            if self.photo_storage != "r2":
                raise RuntimeError("Production requires PHOTO_STORAGE=r2")
        if self.photo_storage not in {"local", "r2"}:
            raise RuntimeError("PHOTO_STORAGE must be local or r2")
        if self.photo_storage == "r2":
            required = {
                "R2_ACCOUNT_ID": self.r2_account_id,
                "R2_ACCESS_KEY_ID": self.r2_access_key_id,
                "R2_SECRET_ACCESS_KEY": self.r2_secret_access_key,
                "R2_BUCKET_NAME": self.r2_bucket_name,
            }
            missing = [name for name, value in required.items() if not value.strip()]
            if missing:
                raise RuntimeError(f"Missing R2 configuration: {', '.join(missing)}")
            if self.r2_public_base_url and not self.r2_public_base_url.startswith("https://"):
                raise RuntimeError("R2_PUBLIC_BASE_URL must use HTTPS")


settings = Settings()

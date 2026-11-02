from pydantic_settings import BaseSettings
from functools import lru_cache
import warnings


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "extra": "ignore"}

    APP_NAME: str = "InvoiceFlow"
    APP_ENV: str = "development"
    SECRET_KEY: str = "change-me-in-production"
    API_V1_PREFIX: str = "/api/v1"

    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres"
    DATABASE_URL_SYNC: str = "postgresql://postgres:postgres@localhost:5432/postgres"

    FRONTEND_URL: str = "http://localhost:5173"
    CORS_ORIGINS: str = ""

    # Storage bucket names
    STORAGE_BUCKET_ORIGINALS: str = "invoice-originals"
    STORAGE_BUCKET_APPROVED: str = "invoice-approved"

    # Invoice number prefix
    INVOICE_NUMBER_PREFIX: str = "INV"

    # Max upload size: 10MB
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024

    # HTTPS enforcement (set True in production)
    FORCE_HTTPS: bool = False


def get_settings() -> Settings:
    s = Settings()
    if s.APP_ENV == "production":
        if not s.CORS_ORIGINS:
            warnings.warn(
                "CORS_ORIGINS is empty in production — all origins will be blocked. "
                "Set CORS_ORIGINS env var to your frontend URL(s).",
                stacklevel=2,
            )
        if s.SECRET_KEY == "change-me-in-production":
            warnings.warn(
                "SECRET_KEY is the default value in production. "
                "Set a strong SECRET_KEY via environment variable.",
                stacklevel=2,
            )
    return s

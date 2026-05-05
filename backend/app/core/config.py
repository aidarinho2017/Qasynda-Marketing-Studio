import json
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        env_ignore_empty=True,
    )

    # App
    APP_NAME: str = "Qasynda Marketing Studio"
    ENVIRONMENT: str = "development"
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # Database
    DATABASE_URL: str
    # Direct connection for Alembic migrations (bypasses pgBouncer).
    # Format: postgresql+asyncpg://postgres:<password>@db.<projectref>.supabase.co:5432/postgres
    DIRECT_DATABASE_URL: str | None = None

    # JWT
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = 7

    # Google OAuth
    GOOGLE_CLIENT_ID: str

    # Supabase Storage (S3-compatible)
    SUPABASE_URL: str
    SUPABASE_S3_ENDPOINT: str
    SUPABASE_S3_REGION: str = "us-east-1"
    SUPABASE_S3_ACCESS_KEY_ID: str
    SUPABASE_S3_SECRET_ACCESS_KEY: str
    SUPABASE_BUCKET_UPLOADS: str = "uploads"
    SUPABASE_BUCKET_GENERATIONS: str = "generations"

    # Gemini
    GEMINI_API_KEY: str
    GEMINI_IMAGE_MODEL: str = "gemini-3-pro-image-preview"

    # OpenAI (used for product analysis in listing-pack pipeline)
    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_TIMEOUT: float = 45.0

    # Lead Search — free-channel API credentials. All optional: a missing key
    # disables that collector, others continue.
    REDDIT_CLIENT_ID: str | None = None
    REDDIT_CLIENT_SECRET: str | None = None
    REDDIT_USER_AGENT: str = "QasyndaMarketingStudio/0.1 (lead-search)"
    YOUTUBE_API_KEY: str | None = None
    LEAD_CLASSIFIER_MODEL: str = "gpt-4o-mini"
    LEAD_ENRICHER_MODEL: str = "gpt-4o-mini"

    # Admin — comma-separated or JSON array of emails that are auto-elevated to admin on login.
    ADMIN_EMAILS: list[str] = []

    @field_validator("ADMIN_EMAILS", mode="before")
    @classmethod
    def parse_admin_emails(cls, v: str | list) -> list[str]:
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                return json.loads(v)
            return [e.strip().lower() for e in v.split(",") if e.strip()]
        return [e.lower() for e in v]


settings = Settings()

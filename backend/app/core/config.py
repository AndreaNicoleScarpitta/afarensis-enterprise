"""
Afarensis Enterprise Configuration

Centralized configuration management using Pydantic settings.
Handles environment variables, secrets, and application configuration.
"""

from pydantic_settings import BaseSettings
from pydantic import Field, validator
from typing import List, Optional
from pathlib import Path


class Settings(BaseSettings):
    """Application settings with validation and type safety"""

    # Application
    APP_NAME: str = "Afarensis Enterprise"
    VERSION: str = "2.0.0"
    ENVIRONMENT: str = Field(default="development", env="ENV")
    DEBUG: bool = Field(default=False, env="DEBUG")

    # Server
    HOST: str = Field(default="0.0.0.0", env="HOST")
    PORT: int = Field(default=8000, env="PORT")

    # Security
    SECRET_KEY: str = Field(default="dev-secret-key-change-in-production", env="SECRET_KEY")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, env="ACCESS_TOKEN_EXPIRE_MINUTES")
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=30, env="REFRESH_TOKEN_EXPIRE_DAYS")
    ENCRYPTION_KEY: Optional[str] = Field(default=None, env="ENCRYPTION_KEY")

    # CORS
    ALLOWED_ORIGINS: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000,http://localhost:5174,http://127.0.0.1:5174",
        env="ALLOWED_ORIGINS"
    )
    ALLOWED_HOSTS: Optional[str] = Field(default=None, env="ALLOWED_HOSTS")

    @property
    def allowed_origins_list(self) -> List[str]:
        if not self.ALLOWED_ORIGINS or self.ALLOWED_ORIGINS.strip() == "":
            # Refuse to default to wildcard — require explicit configuration
            import logging
            logging.getLogger(__name__).warning(
                "ALLOWED_ORIGINS not set — defaulting to localhost only. "
                "Set ALLOWED_ORIGINS env var for production domains."
            )
            return ["http://localhost:3000", "http://localhost:5174"]
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def allowed_hosts_list(self) -> Optional[List[str]]:
        if not self.ALLOWED_HOSTS:
            return None
        return [h.strip() for h in self.ALLOWED_HOSTS.split(",") if h.strip()]

    # Database
    DATABASE_URL: str = Field(default="sqlite+aiosqlite:///./afarensis.db", env="DATABASE_URL")
    DATABASE_POOL_SIZE: int = Field(default=20, env="DATABASE_POOL_SIZE")
    DATABASE_MAX_OVERFLOW: int = Field(default=30, env="DATABASE_MAX_OVERFLOW")
    AUTO_CREATE_TABLES: bool = Field(default=True, env="AUTO_CREATE_TABLES")

    # Redis
    REDIS_URL: str = Field(default="redis://localhost:6379/0", env="REDIS_URL")
    REDIS_KEY_PREFIX: str = Field(default="afarensis:", env="REDIS_KEY_PREFIX")

    # AI/LLM Configuration
    ANTHROPIC_API_KEY: Optional[str] = Field(default=None, env="ANTHROPIC_API_KEY")
    ANTHROPIC_MODEL: str = Field(default="claude-3-5-sonnet-20241022", env="ANTHROPIC_MODEL")

    OPENAI_API_KEY: Optional[str] = Field(default=None, env="OPENAI_API_KEY")
    OPENAI_MODEL: str = Field(default="gpt-4-turbo-preview", env="OPENAI_MODEL")
    OPENAI_MAX_TOKENS: int = Field(default=4000, env="OPENAI_MAX_TOKENS")
    OPENAI_TEMPERATURE: float = Field(default=0.1, env="OPENAI_TEMPERATURE")

    GOOGLE_AI_API_KEY: Optional[str] = Field(default=None, env="GOOGLE_AI_API_KEY")
    GOOGLE_AI_MODEL: str = Field(default="gemini-pro", env="GOOGLE_AI_MODEL")

    HUGGINGFACE_API_KEY: Optional[str] = Field(default=None, env="HUGGINGFACE_API_KEY")

    # LLM Integration Settings
    LLM_TIMEOUT_SECONDS: int = Field(default=30, env="LLM_TIMEOUT_SECONDS")
    LLM_RETRY_ATTEMPTS: int = Field(default=3, env="LLM_RETRY_ATTEMPTS")
    LLM_FALLBACK_ENABLED: bool = Field(default=True, env="LLM_FALLBACK_ENABLED")
    LLM_RATE_LIMIT_PER_MINUTE: int = Field(default=60, env="LLM_RATE_LIMIT_PER_MINUTE")
    CLAUDE_MODEL: str = Field(default="claude-3-sonnet-20240229", env="CLAUDE_MODEL")

    # External APIs
    PUBMED_EMAIL: Optional[str] = Field(default=None, env="PUBMED_EMAIL")
    PUBMED_API_KEY: Optional[str] = Field(default=None, env="PUBMED_API_KEY")
    PUBMED_MAX_RESULTS: int = Field(default=100, env="PUBMED_MAX_RESULTS")
    PUBMED_RATE_LIMIT_PER_SECOND: int = Field(default=3, env="PUBMED_RATE_LIMIT_PER_SECOND")

    CLINICALTRIALS_API_BASE: str = Field(
        default="https://clinicaltrials.gov/api/v2",
        env="CLINICALTRIALS_API_BASE"
    )
    CLINICALTRIALS_MAX_RESULTS: int = Field(default=100, env="CLINICALTRIALS_MAX_RESULTS")
    CLINICALTRIALS_RATE_LIMIT_PER_SECOND: int = Field(default=2, env="CLINICALTRIALS_RATE_LIMIT_PER_SECOND")

    # FDA and EMA APIs
    FDA_GUIDANCE_URL: str = Field(
        default="https://www.fda.gov/regulatory-information/search-fda-guidance-documents",
        env="FDA_GUIDANCE_URL"
    )
    EMA_DOCUMENTS_URL: str = Field(
        default="https://www.ema.europa.eu/en/search/search",
        env="EMA_DOCUMENTS_URL"
    )

    # External API Settings
    EXTERNAL_API_TIMEOUT_SECONDS: int = Field(default=30, env="EXTERNAL_API_TIMEOUT_SECONDS")
    EXTERNAL_API_RETRY_ATTEMPTS: int = Field(default=3, env="EXTERNAL_API_RETRY_ATTEMPTS")
    EXTERNAL_API_USER_AGENT: str = Field(
        default="Afarensis-Enterprise-Research-Tool/2.0",
        env="EXTERNAL_API_USER_AGENT"
    )

    # Feature flags
    ENABLE_LLM_INTEGRATION: bool = Field(default=True, env="ENABLE_LLM_INTEGRATION")
    ENABLE_PUBMED_INTEGRATION: bool = Field(default=True, env="ENABLE_PUBMED_INTEGRATION")
    ENABLE_CLINICAL_TRIALS_INTEGRATION: bool = Field(default=True, env="ENABLE_CLINICAL_TRIALS_INTEGRATION")
    ENABLE_BIAS_ANALYSIS: bool = Field(default=True, env="ENABLE_BIAS_ANALYSIS")
    ENABLE_EVIDENCE_EXTRACTION: bool = Field(default=True, env="ENABLE_EVIDENCE_EXTRACTION")
    FALLBACK_TO_MOCK_DATA: bool = Field(default=True, env="FALLBACK_TO_MOCK_DATA")  # Overridden to False in production by validator

    # File Upload
    MAX_UPLOAD_SIZE: int = Field(default=100 * 1024 * 1024, env="MAX_UPLOAD_SIZE")  # 100MB
    UPLOAD_DIRECTORY: str = Field(default="./uploads", env="UPLOAD_DIRECTORY")
    ARTIFACT_DIRECTORY: str = Field(default="./artifacts", env="ARTIFACT_DIRECTORY")
    ALLOWED_FILE_TYPES: List[str] = Field(
        default=[".pdf", ".docx", ".doc", ".txt", ".md"],
        env="ALLOWED_FILE_TYPES"
    )

    # Cloud Storage (S3-compatible)
    STORAGE_BACKEND: str = Field(default="local", env="STORAGE_BACKEND")  # "local" or "s3"
    S3_BUCKET: Optional[str] = Field(default=None, env="S3_BUCKET")
    S3_REGION: str = Field(default="us-east-1", env="S3_REGION")
    S3_ACCESS_KEY: Optional[str] = Field(default=None, env="S3_ACCESS_KEY")
    S3_SECRET_KEY: Optional[str] = Field(default=None, env="S3_SECRET_KEY")
    S3_ENDPOINT_URL: Optional[str] = Field(default=None, env="S3_ENDPOINT_URL")  # For MinIO/R2

    # Logging
    LOG_LEVEL: str = Field(default="INFO", env="LOG_LEVEL")
    LOG_FORMAT: str = Field(default="json", env="LOG_FORMAT")  # json or text
    LOG_FILE: Optional[str] = Field(default=None, env="LOG_FILE")

    # Audit & Compliance
    ENABLE_AUDIT_LOG: bool = Field(default=True, env="ENABLE_AUDIT_LOG")
    AUDIT_LOG_RETENTION_DAYS: int = Field(default=2555, env="AUDIT_LOG_RETENTION_DAYS")  # 7 years
    ENABLE_DATA_ENCRYPTION: bool = Field(default=True, env="ENABLE_DATA_ENCRYPTION")

    # Email / SMTP (for password resets, notifications)
    SMTP_HOST: Optional[str] = Field(default=None, env="SMTP_HOST")
    SMTP_PORT: int = Field(default=587, env="SMTP_PORT")
    SMTP_USER: Optional[str] = Field(default=None, env="SMTP_USER")
    SMTP_PASSWORD: Optional[str] = Field(default=None, env="SMTP_PASSWORD")
    FROM_EMAIL: str = Field(default="noreply@afarensis.com", env="FROM_EMAIL")

    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = Field(default=100, env="RATE_LIMIT_PER_MINUTE")
    RATE_LIMIT_BURST: int = Field(default=200, env="RATE_LIMIT_BURST")

    # Evidence Processing
    MAX_PUBMED_RESULTS: int = Field(default=50, env="MAX_PUBMED_RESULTS")
    MAX_TRIALS_RESULTS: int = Field(default=50, env="MAX_TRIALS_RESULTS")
    EVIDENCE_CACHE_TTL: int = Field(default=3600, env="EVIDENCE_CACHE_TTL")  # 1 hour

    # Federated Network (Beta)
    FEDERATED_MODE: bool = Field(default=False, env="FEDERATED_MODE")
    FEDERATED_NODE_ID: Optional[str] = Field(default=None, env="FEDERATED_NODE_ID")
    FEDERATED_NODES: List[str] = Field(default=[], env="FEDERATED_NODES")
    FEDERATED_SHARED_SECRET: Optional[str] = Field(default=None, env="FEDERATED_SHARED_SECRET")

    # Monitoring & Observability
    ENABLE_METRICS: bool = Field(default=True, env="ENABLE_METRICS")
    METRICS_PORT: int = Field(default=9090, env="METRICS_PORT")
    ENABLE_TRACING: bool = Field(default=False, env="ENABLE_TRACING")
    JAEGER_ENDPOINT: Optional[str] = Field(default=None, env="JAEGER_ENDPOINT")

    # Sentry (error tracking)
    SENTRY_DSN: Optional[str] = Field(default=None, env="SENTRY_DSN")
    SENTRY_TRACES_SAMPLE_RATE: float = Field(default=0.1, env="SENTRY_TRACES_SAMPLE_RATE")
    SENTRY_ENVIRONMENT: Optional[str] = Field(default=None, env="SENTRY_ENVIRONMENT")

    # Background Tasks
    CELERY_BROKER_URL: Optional[str] = Field(default=None, env="CELERY_BROKER_URL")
    CELERY_RESULT_BACKEND: Optional[str] = Field(default=None, env="CELERY_RESULT_BACKEND")

    # ALLOWED_ORIGINS and ALLOWED_HOSTS are stored as comma-separated strings
    # and parsed via allowed_origins_list / allowed_hosts_list properties

    @validator("FEDERATED_NODES", pre=True)
    def parse_federated_nodes(cls, v):
        if isinstance(v, str):
            return [node.strip() for node in v.split(",") if node.strip()]
        return v

    @validator("ALLOWED_FILE_TYPES", pre=True)
    def parse_allowed_file_types(cls, v):
        if isinstance(v, str):
            return [ext.strip() for ext in v.split(",")]
        return v

    @property
    def is_production(self) -> bool:
        """Check if running in production environment"""
        return self.ENVIRONMENT.lower() == "production"

    @property
    def is_development(self) -> bool:
        """Check if running in development environment"""
        return self.ENVIRONMENT.lower() == "development"

    @property
    def is_sqlite(self) -> bool:
        """Check if using SQLite database"""
        return self.DATABASE_URL.startswith("sqlite")

    @property
    def database_config(self) -> dict:
        """Get database configuration for SQLAlchemy"""
        config = {
            "url": self.DATABASE_URL,
            "pool_pre_ping": True,
        }
        # SQLite does not support pool_size/max_overflow/pool_recycle
        if not self.is_sqlite:
            config["pool_size"] = self.DATABASE_POOL_SIZE
            config["max_overflow"] = self.DATABASE_MAX_OVERFLOW
            config["pool_recycle"] = 3600
        return config

    def get_upload_path(self) -> Path:
        """Get the upload directory path"""
        path = Path(self.UPLOAD_DIRECTORY)
        path.mkdir(parents=True, exist_ok=True)
        return path

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"


# Create global settings instance
settings = Settings()

# Auto-generate SECRET_KEY if still using the insecure default (dev convenience).
# In production the validator below will reject this, so this only helps local dev.
if settings.SECRET_KEY == "dev-secret-key-change-in-production" and settings.is_development:
    import secrets as _secrets
    _key_file = Path(".secret_key")
    if _key_file.exists():
        settings.SECRET_KEY = _key_file.read_text().strip()
    else:
        generated = _secrets.token_urlsafe(48)
        _key_file.write_text(generated)
        settings.SECRET_KEY = generated
    # .secret_key should be in .gitignore


# Validation functions
def validate_required_settings():
    """Validate that all required settings are provided"""
    required_in_production = [
        "SECRET_KEY",
        "DATABASE_URL",
    ]

    # At least one LLM API key should be provided
    llm_apis = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_AI_API_KEY"]

    if settings.is_production:
        missing = []
        for setting in required_in_production:
            value = getattr(settings, setting)
            if not value or (isinstance(value, str) and not value.strip()):
                missing.append(setting)
        # Reject the insecure default SECRET_KEY in production
        if settings.SECRET_KEY == "dev-secret-key-change-in-production":
            missing.append("SECRET_KEY (still using insecure default)")
        # Reject SQLite in production — require PostgreSQL
        if settings.is_sqlite:
            missing.append("DATABASE_URL (SQLite is not supported in production — use PostgreSQL)")

        if missing:
            raise ValueError(f"Missing required production settings: {', '.join(missing)}")

        # Force FALLBACK_TO_MOCK_DATA=false in production
        if settings.FALLBACK_TO_MOCK_DATA:
            import logging
            logging.getLogger(__name__).warning(
                "FALLBACK_TO_MOCK_DATA is True in production. Overriding to False. "
                "Set FALLBACK_TO_MOCK_DATA=false in .env to silence this warning."
            )
            settings.FALLBACK_TO_MOCK_DATA = False

        # Check that at least one LLM API key is configured
        llm_configured = any(getattr(settings, api_key) for api_key in llm_apis)
        if not llm_configured and settings.ENABLE_LLM_INTEGRATION:
            raise ValueError(f"At least one LLM API key must be configured: {', '.join(llm_apis)}")

    # Validate database URL format - accept PostgreSQL and SQLite
    valid_prefixes = ("postgresql://", "postgresql+asyncpg://", "sqlite://", "sqlite+aiosqlite://")
    if not settings.DATABASE_URL.startswith(valid_prefixes):
        raise ValueError("DATABASE_URL must be a PostgreSQL or SQLite connection string")


# Run validation on import
validate_required_settings()

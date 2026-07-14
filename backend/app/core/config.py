"""Environment-driven application settings."""
from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- app ---
    app_name: str = "WAAEM Alignment Intelligence API"
    app_version: str = "3.0.0"
    environment: str = Field(default="development")
    log_level: str = Field(default="INFO")
    cors_origins: List[str] = Field(default=["*"])

    # --- database ---
    # Local dev defaults to async SQLite; production sets DATABASE_URL to
    # postgresql+asyncpg://user:pass@host:5432/waaem
    database_url: str = Field(default="sqlite+aiosqlite:///./waaem.db")

    # --- uploads ---
    upload_dir: str = Field(default="./uploads")
    max_upload_mb: int = Field(default=25)
    allowed_extensions: List[str] = Field(default=["pdf", "docx"])

    # --- Knowledge Base / RAG ---
    kb_dir: str = Field(default="./knowledge_base")
    chroma_dir: str = Field(default="./knowledge_base/chroma")
    kb_collection: str = Field(default="saudi_regulations")
    # Managed vector store: when CHROMA_API_KEY is set, use hosted Chroma Cloud
    # instead of the local on-disk store (tenant + database from the Chroma Cloud
    # console). Leave empty to keep the local PersistentClient.
    chroma_api_key: str = Field(default="")
    chroma_tenant: str = Field(default="")
    chroma_database: str = Field(default="")
    # fastembed multilingual model (Arabic + English), CPU/ONNX, no torch.
    embed_model: str = Field(default="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
    embed_dim: int = Field(default=384)
    retrieval_top_k: int = Field(default=8)
    chunk_size: int = Field(default=1100)      # chars per semantic chunk
    chunk_overlap: int = Field(default=180)
    http_user_agent: str = Field(default="WAAEM-KB-Ingestor/1.0 (+governance-compliance)")
    ingest_timeout: int = Field(default=60)
    respect_robots: bool = Field(default=True)
    # Auto-build the KB on first startup when the vector store is empty.
    kb_auto_build: bool = Field(default=True)
    # Periodic auto-update (re-check official sources); 0 disables. e.g. 168 = weekly.
    kb_update_interval_hours: int = Field(default=0)

    # --- AI / Llama (Ollama) ---
    # Ollama HTTP endpoint. In prod set OLLAMA_HOST=http://ollama:11434
    ollama_host: str = Field(default="http://localhost:11434")
    llama_model: str = Field(default="llama3.1")
    llama_timeout: int = Field(default=120)
    llama_max_retries: int = Field(default=2)
    # If true and the model is unreachable/invalid, fall back to the curated
    # deterministic analysis so the product stays fully functional.
    ai_allow_fallback: bool = Field(default=True)
    # Optional llama.cpp OpenAI-compatible endpoint fallback.
    llamacpp_url: str = Field(default="")

    # --- Groq (hosted Llama, OpenAI-compatible) ---
    # When GROQ_API_KEY is set the compliance engine uses Groq's LPU-hosted Llama
    # instead of local CPU inference (sub-second responses, no timeouts). The
    # compliance verdict comes solely from Llama — there is no similarity-based
    # fallback score. Transient 429 rate-limits are retried with backoff.
    groq_api_key: str = Field(default="")
    groq_base_url: str = Field(default="https://api.groq.com/openai/v1")
    groq_model: str = Field(default="llama-3.3-70b-versatile")
    groq_timeout: int = Field(default=60)
    groq_max_retries: int = Field(default=5)  # backoff attempts on 429 rate-limit

    @property
    def use_groq(self) -> bool:
        return bool(self.groq_api_key.strip())

    @property
    def use_chroma_cloud(self) -> bool:
        return bool(self.chroma_api_key.strip())

    @field_validator("cors_origins", "allowed_extensions", mode="before")
    @classmethod
    def _split_csv(cls, v):
        if isinstance(v, str):
            return [x.strip() for x in v.split(",") if x.strip()]
        return v

    @field_validator("database_url", mode="before")
    @classmethod
    def _async_driver(cls, v):
        """Managed hosts (Render/Heroku) expose sync `postgres://` URLs.
        Normalise them to the asyncpg driver the app uses."""
        if isinstance(v, str):
            if v.startswith("postgres://"):
                v = v.replace("postgres://", "postgresql+asyncpg://", 1)
            elif v.startswith("postgresql://") and "+asyncpg" not in v:
                v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

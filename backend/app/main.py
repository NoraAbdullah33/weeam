"""WAAEM API application factory — RAG governance-compliance engine."""
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.db.base import init_db
from app.kb import vectorstore
from app.kb.updater import ensure_built, run_update_loop
from app.routers import analyze, kb, result, upload
from app.services.llama import llama_client

logger = get_logger("waaem.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    await init_db()
    logger.info("WAAEM API ready · env=%s · db=%s", settings.environment, "sqlite" if settings.is_sqlite else "postgres")
    # Auto-build the KB (non-blocking), warm the model, start the auto-update loop.
    asyncio.create_task(ensure_built())
    asyncio.create_task(llama_client.warmup())
    asyncio.create_task(run_update_loop())
    yield


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True,
        allow_methods=["*"], allow_headers=["*"],
    )
    register_exception_handlers(app)
    app.include_router(upload.router)
    app.include_router(analyze.router)
    app.include_router(result.router)
    app.include_router(kb.router)

    @app.get("/")
    async def root():
        return {"name": settings.app_name, "version": settings.app_version, "status": "ok",
                "engine": "RAG governance compliance"}

    @app.get("/api/health")
    async def health():
        return {"status": "healthy", "kb_chunks": vectorstore.count()}

    @app.get("/api/ai/status")
    async def ai_status():
        online = await llama_client.health()
        provider = "groq" if settings.use_groq else "ollama"
        model = settings.groq_model if settings.use_groq else settings.llama_model
        return {"engine": provider, "model": model, "online": online,
                "kb_chunks": vectorstore.count(), "embed_model": settings.embed_model}

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

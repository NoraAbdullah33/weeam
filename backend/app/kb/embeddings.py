"""Embedding provider — fastembed (multilingual ONNX, Arabic + English, CPU).

A production deployment can switch to Ollama embeddings by changing EMBED_MODEL
and this module's provider without changing callers.
"""
from __future__ import annotations

from functools import lru_cache

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("waaem.kb.embed")


@lru_cache
def _model():
    from fastembed import TextEmbedding

    logger.info("loading embedding model: %s", settings.embed_model)
    return TextEmbedding(model_name=settings.embed_model)


def embed_documents(texts: list[str]) -> list[list[float]]:
    return [v.tolist() for v in _model().embed(texts)]


def embed_query(text: str) -> list[float]:
    return next(iter(_model().embed([text]))).tolist()

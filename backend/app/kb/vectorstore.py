"""ChromaDB persistent vector store — the primary source of truth for retrieval.

Chunks carry full provenance metadata (authority, title, version, section,
paragraph, reference id, source URL) so every retrieved passage is citable.
"""
from __future__ import annotations

import os
from functools import lru_cache

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("waaem.kb.vector")


@lru_cache
def _collection():
    import chromadb

    if settings.use_chroma_cloud:
        # Managed Chroma Cloud — no local disk needed.
        client = chromadb.CloudClient(
            api_key=settings.chroma_api_key,
            tenant=settings.chroma_tenant,
            database=settings.chroma_database,
        )
        logger.info("vector store: Chroma Cloud (tenant=%s db=%s)",
                    settings.chroma_tenant, settings.chroma_database)
    else:
        # Local on-disk store.
        os.makedirs(settings.chroma_dir, exist_ok=True)
        client = chromadb.PersistentClient(path=settings.chroma_dir)
        logger.info("vector store: local PersistentClient (%s)", settings.chroma_dir)
    # We supply our own embeddings (fastembed multilingual).
    return client.get_or_create_collection(
        name=settings.kb_collection, metadata={"hnsw:space": "cosine"}
    )


def add_chunks(ids: list[str], embeddings: list[list[float]], documents: list[str], metadatas: list[dict]) -> None:
    _collection().upsert(ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas)


def delete_by_source(source_id: str) -> None:
    try:
        _collection().delete(where={"source_id": source_id})
    except Exception as e:  # noqa: BLE001
        logger.warning("delete_by_source(%s) failed: %s", source_id, e)


def count() -> int:
    try:
        return _collection().count()
    except Exception:  # noqa: BLE001
        return 0


def query(embedding: list[float], top_k: int, where: dict | None = None) -> list[dict]:
    res = _collection().query(
        query_embeddings=[embedding], n_results=top_k, where=where,
        include=["documents", "metadatas", "distances"],
    )
    out: list[dict] = []
    docs = (res.get("documents") or [[]])[0]
    metas = (res.get("metadatas") or [[]])[0]
    dists = (res.get("distances") or [[]])[0]
    for d, m, dist in zip(docs, metas, dists):
        out.append({"text": d, "meta": m, "score": round(1 - float(dist), 4)})
    return out


def authorities_summary() -> dict:
    """Per-authority chunk + document counts from stored metadata."""
    try:
        col = _collection()
        got = col.get(include=["metadatas"])
        metas = got.get("metadatas") or []
    except Exception:  # noqa: BLE001
        return {}
    by_auth: dict[str, dict] = {}
    for m in metas:
        a = m.get("authority", "?")
        entry = by_auth.setdefault(a, {"chunks": 0, "documents": set()})
        entry["chunks"] += 1
        entry["documents"].add(m.get("source_id"))
    return {a: {"chunks": v["chunks"], "documents": len(v["documents"])} for a, v in by_auth.items()}

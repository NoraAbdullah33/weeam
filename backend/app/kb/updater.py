"""Automatic knowledge-base update service.

Periodically re-checks official sources: downloads newer versions (by file hash),
supersedes old versions, re-indexes, regenerates embeddings, and preserves version
history — always keeping the newest indexed version as the retrieval target.
"""
from __future__ import annotations

import asyncio

from app.core.config import settings
from app.core.logging import get_logger
from app.kb import vectorstore
from app.kb.ingest import run_ingestion

logger = get_logger("waaem.kb.updater")


async def ensure_built() -> None:
    """Build the KB automatically on first run if the vector store is empty."""
    if not settings.kb_auto_build:
        return
    if vectorstore.count() > 0:
        logger.info("KB already populated (%d chunks)", vectorstore.count())
        return
    logger.info("KB empty — starting automatic ingestion of official sources…")
    try:
        rep = await run_ingestion(force=False)
        logger.info("KB auto-build done: %d indexed / %d failed / %d chunks",
                    rep["succeeded"], rep["failed"], rep["chunks_indexed"])
    except Exception as e:  # noqa: BLE001
        logger.exception("KB auto-build failed: %s", e)


async def run_update_loop() -> None:
    interval = settings.kb_update_interval_hours
    if interval <= 0:
        return
    logger.info("KB auto-update enabled: every %d hours", interval)
    while True:
        await asyncio.sleep(interval * 3600)
        try:
            logger.info("KB auto-update: re-checking official sources…")
            rep = await run_ingestion(force=False)
            logger.info("KB auto-update: %d updated / %d skipped / %d failed",
                        rep["succeeded"], rep["skipped"], rep["failed"])
        except Exception as e:  # noqa: BLE001
            logger.exception("KB auto-update run failed: %s", e)

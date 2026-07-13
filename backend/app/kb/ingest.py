"""Knowledge-base ingestion pipeline.

download → store raw → extract (+OCR) → clean → semantic chunk → embed →
store in Chroma (with full provenance) → record version history & honest report.
"""
from __future__ import annotations

import asyncio
import hashlib
import os
from datetime import datetime, timezone

from sqlalchemy import select, update

from app.core.config import settings
from app.core.logging import get_logger
from app.db.base import SessionLocal
from app.db.models import KBDocument, KBIngestionRun
from app.kb import embeddings, ocr, vectorstore
from app.kb.chunking import chunk_text
from app.kb.downloader import download
from app.kb.sources import SourceDoc, load_sources
from app.services import extraction

logger = get_logger("waaem.kb.ingest")


def _raw_dir() -> str:
    d = os.path.join(settings.kb_dir, "raw")
    os.makedirs(d, exist_ok=True)
    return d


async def _ingest_one(session, src: SourceDoc, force: bool) -> dict:
    entry = {"source_id": src.id, "authority": src.authority, "title": src.title_en,
             "url": src.url, "status": "failed", "reason": "", "detail": "", "chunks": 0}

    # 1) download
    res = await download(src.url)
    if not res.ok:
        entry.update(reason=res.reason, detail=res.detail)
        session.add(KBDocument(source_id=src.id, authority=src.authority, title_en=src.title_en,
                               title_ar=src.title_ar, version=src.version, published_date=src.published_date,
                               language=src.language, source_url=src.url, landing_url=src.landing_url,
                               status="failed", is_current=False, failure_reason=f"{res.reason}: {res.detail}"))
        logger.warning("KB download failed [%s]: %s (%s)", src.id, res.reason, res.detail)
        return entry

    data = res.data or b""
    file_hash = hashlib.sha256(data).hexdigest()

    # up-to-date check (skip unless forced)
    existing = (await session.execute(
        select(KBDocument).where(KBDocument.source_id == src.id, KBDocument.is_current == True))).scalar_one_or_none()  # noqa: E712
    if existing and existing.file_hash == file_hash and not force:
        entry.update(status="skipped", reason="up_to_date", detail="النسخة الحالية محدّثة (نفس البصمة).", chunks=existing.chunk_count)
        return entry

    # 2) store raw
    raw_path = os.path.join(_raw_dir(), f"{src.id}.pdf")
    with open(raw_path, "wb") as fh:
        fh.write(data)

    # 3) extract (+ OCR fallback)
    text, pages = await asyncio.to_thread(extraction.extract, f"{src.id}.pdf", "pdf", data)
    if len(text.strip()) < 400:
        if ocr.ocr_available():
            text = await asyncio.to_thread(ocr.ocr_pdf, data)
        else:
            entry.update(reason="needs_ocr", detail="لا توجد طبقة نصية والـ OCR غير متوفر على الخادم.")
            session.add(KBDocument(source_id=src.id, authority=src.authority, title_en=src.title_en,
                                   title_ar=src.title_ar, version=src.version, published_date=src.published_date,
                                   language=src.language, source_url=src.url, landing_url=src.landing_url,
                                   file_hash=file_hash, raw_path=raw_path, pages=pages, status="failed",
                                   is_current=False, failure_reason="needs_ocr"))
            return entry

    # 4) chunk
    chunks = chunk_text(text)
    if not chunks:
        entry.update(reason="no_chunks", detail="تعذّر استخراج مقاطع نصية صالحة.")
        return entry

    # 5) embed (CPU-bound → thread)
    vectors = await asyncio.to_thread(embeddings.embed_documents, [c.text for c in chunks])

    # 6) supersede old version + store new chunks (version history preserved)
    vectorstore.delete_by_source(src.id)
    await session.execute(update(KBDocument).where(KBDocument.source_id == src.id)
                          .values(is_current=False, status="superseded"))

    ids, metas, docs = [], [], []
    for i, (c, _) in enumerate(zip(chunks, vectors)):
        ref = f"{src.authority}:{src.id}:{i}"
        ids.append(ref)
        docs.append(c.text)
        metas.append({
            "authority": src.authority, "source_id": src.id,
            "title_en": src.title_en, "title_ar": src.title_ar,
            "version": src.version, "published_date": src.published_date,
            "section": c.section, "paragraph": c.paragraph,
            "reference_id": ref, "source_url": src.url, "landing_url": src.landing_url,
            "language": src.language,
        })
    await asyncio.to_thread(vectorstore.add_chunks, ids, vectors, docs, metas)

    session.add(KBDocument(source_id=src.id, authority=src.authority, title_en=src.title_en,
                           title_ar=src.title_ar, version=src.version, published_date=src.published_date,
                           language=src.language, source_url=src.url, landing_url=src.landing_url,
                           file_hash=file_hash, raw_path=raw_path, pages=pages, chunk_count=len(chunks),
                           status="indexed", is_current=True))
    entry.update(status="indexed", reason="", detail="", chunks=len(chunks))
    logger.info("KB indexed [%s]: %d chunks", src.id, len(chunks))
    return entry


async def run_ingestion(force: bool = False) -> dict:
    """Ingest all registered sources. Returns a full run report (honest failures)."""
    sources = load_sources()
    async with SessionLocal() as session:
        run = KBIngestionRun(total=len(sources))
        session.add(run)
        await session.flush()
        report = []
        for src in sources:
            try:
                report.append(await _ingest_one(session, src, force))
            except Exception as e:  # noqa: BLE001 — one doc must not break the run
                logger.exception("ingest error [%s]", src.id)
                report.append({"source_id": src.id, "authority": src.authority, "title": src.title_en,
                               "status": "failed", "reason": "internal_error", "detail": str(e)[:200], "chunks": 0})
        run.report = report
        run.succeeded = sum(1 for r in report if r["status"] == "indexed")
        run.failed = sum(1 for r in report if r["status"] == "failed")
        run.skipped = sum(1 for r in report if r["status"] == "skipped")
        run.finished_at = datetime.now(timezone.utc)
        await session.commit()
        return {"run_id": run.id, "total": run.total, "succeeded": run.succeeded,
                "failed": run.failed, "skipped": run.skipped, "chunks_indexed": vectorstore.count(),
                "report": report}

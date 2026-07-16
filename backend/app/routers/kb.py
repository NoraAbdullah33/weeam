"""Knowledge-base endpoints: status, indexed documents, and ingestion trigger."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_session
from app.kb import vectorstore
from app.kb.ingest import run_ingestion
from app.kb.sources import AUTHORITIES, load_sources
from app.repositories.kb_repo import KBRepository

router = APIRouter(prefix="/api/kb", tags=["knowledge-base"])


@router.get("/status")
async def kb_status(session: AsyncSession = Depends(get_session)):
    repo = KBRepository(session)
    docs = await repo.current_documents()
    failed = await repo.failed_documents()
    last = await repo.last_run()
    return {
        "chunks": vectorstore.count(),
        "authorities": vectorstore.authorities_summary(),
        "authority_names": AUTHORITIES,
        "registered_sources": len(load_sources()),
        "indexed_documents": [
            {
                "source_id": d.source_id, "authority": d.authority,
                "title_en": d.title_en, "title_ar": d.title_ar, "version": d.version,
                "published_date": d.published_date, "language": d.language,
                "source_url": d.source_url, "file_hash": d.file_hash,
                "pages": d.pages, "chunks": d.chunk_count,
                "indexed_at": d.indexed_at,
            }
            for d in docs
        ],
        "failures": [
            {"source_id": d.source_id, "authority": d.authority, "title_en": d.title_en,
             "source_url": d.source_url, "reason": d.failure_reason}
            for d in failed
        ],
        "last_run": None if not last else {
            "run_id": last.id, "started_at": last.started_at, "finished_at": last.finished_at,
            "total": last.total, "succeeded": last.succeeded, "failed": last.failed, "skipped": last.skipped,
            "report": last.report,
        },
    }


@router.post("/ingest")
async def kb_ingest(force: bool = False):
    """Run the ingestion pipeline against all official registered sources.

    Downloads, extracts, chunks, embeds and indexes real regulatory documents;
    returns an honest per-document report (successes and failures with reasons).
    """
    return await run_ingestion(force=force)

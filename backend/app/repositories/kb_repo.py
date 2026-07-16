"""Data access for knowledge-base documents and ingestion runs."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import KBDocument, KBIngestionRun


class KBRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def current_documents(self) -> list[KBDocument]:
        res = await self.session.execute(
            select(KBDocument).where(KBDocument.is_current == True).order_by(KBDocument.authority)  # noqa: E712
        )
        return list(res.scalars().all())

    async def failed_documents(self) -> list[KBDocument]:
        res = await self.session.execute(
            select(KBDocument).where(KBDocument.status == "failed").order_by(KBDocument.indexed_at.desc())
        )
        # de-duplicate by source_id keeping latest
        seen, out = set(), []
        for d in res.scalars().all():
            if d.source_id not in seen:
                seen.add(d.source_id)
                out.append(d)
        return out

    async def last_run(self) -> KBIngestionRun | None:
        res = await self.session.execute(
            select(KBIngestionRun).order_by(KBIngestionRun.started_at.desc()).limit(1)
        )
        return res.scalar_one_or_none()

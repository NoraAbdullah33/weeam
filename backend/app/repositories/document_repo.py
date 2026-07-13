"""Data access for documents."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Document


class DocumentRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, **kwargs) -> Document:
        doc = Document(**kwargs)
        self.session.add(doc)
        await self.session.flush()
        return doc

    async def get(self, doc_id: str) -> Document | None:
        return await self.session.get(Document, doc_id)

    async def get_many(self, ids: list[str]) -> list[Document]:
        if not ids:
            return []
        res = await self.session.execute(select(Document).where(Document.id.in_(ids)))
        return list(res.scalars().all())

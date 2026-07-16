"""Upload handling: validation, extraction, persistence."""
from __future__ import annotations

import asyncio
import os

from fastapi import UploadFile

from app.core.config import settings
from app.core.errors import EmptyUploadError, UnsupportedFileError
from app.core.logging import get_logger
from app.repositories.document_repo import DocumentRepository
from app.schemas.api import DocumentOut
from app.services import extraction

logger = get_logger("waaem.documents")


class DocumentService:
    def __init__(self, repo: DocumentRepository):
        self.repo = repo

    async def upload(self, files: list[UploadFile]) -> list[DocumentOut]:
        files = [f for f in (files or []) if f and f.filename]
        if not files:
            raise EmptyUploadError()

        os.makedirs(settings.upload_dir, exist_ok=True)
        max_bytes = settings.max_upload_mb * 1024 * 1024
        out: list[DocumentOut] = []

        for f in files:
            ext = (f.filename.rsplit(".", 1)[-1] if "." in f.filename else "").lower()
            if ext not in settings.allowed_extensions:
                raise UnsupportedFileError()
            data = await f.read()
            if not data:
                raise EmptyUploadError()
            if len(data) > max_bytes:
                raise UnsupportedFileError(f"حجم الملف يتجاوز {settings.max_upload_mb} ميجابايت.")

            # CPU-bound extraction off the event loop.
            text, pages = await asyncio.to_thread(extraction.extract, f.filename, ext, data)

            doc = await self.repo.create(
                filename=f.filename, ext=ext, content_type=f.content_type or "",
                size_bytes=len(data), pages=pages, char_count=len(text),
                extracted_text=text, status="extracted",
            )
            # Persist the raw file for auditing/reprocessing.
            path = os.path.join(settings.upload_dir, f"{doc.id}.{ext}")
            try:
                with open(path, "wb") as fh:
                    fh.write(data)
                doc.storage_path = path
            except OSError as e:  # non-fatal
                logger.warning("could not persist file %s: %s", doc.id, e)

            logger.info("extracted %s: %d pages, %d chars", f.filename, pages, len(text))
            out.append(DocumentOut(
                id=doc.id, filename=doc.filename, ext=doc.ext, pages=doc.pages,
                size_kb=max(1, doc.size_bytes // 1024), char_count=doc.char_count, status=doc.status,
            ))
        return out

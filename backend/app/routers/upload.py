"""POST /api/upload — receive, validate, extract and store documents."""
from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_session
from app.deps import get_document_service
from app.schemas.api import UploadResponse
from app.services.document_service import DocumentService

router = APIRouter(prefix="/api", tags=["upload"])


@router.post("/upload", response_model=UploadResponse)
async def upload_documents(
    files: list[UploadFile] = File(default=[]),
    service: DocumentService = Depends(get_document_service),
    session: AsyncSession = Depends(get_session),
):
    docs = await service.upload(files)
    await session.commit()
    return UploadResponse(document_ids=[d.id for d in docs], documents=docs)

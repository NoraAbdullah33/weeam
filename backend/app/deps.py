"""FastAPI dependency-injection wiring for repositories and services."""
from __future__ import annotations

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_session
from app.repositories.analysis_repo import AnalysisRepository
from app.repositories.document_repo import DocumentRepository
from app.services.analysis_service import AnalysisService
from app.services.document_service import DocumentService


def get_document_repo(session: AsyncSession = Depends(get_session)) -> DocumentRepository:
    return DocumentRepository(session)


def get_analysis_repo(session: AsyncSession = Depends(get_session)) -> AnalysisRepository:
    return AnalysisRepository(session)


def get_document_service(repo: DocumentRepository = Depends(get_document_repo)) -> DocumentService:
    return DocumentService(repo)


def get_analysis_service(
    analysis_repo: AnalysisRepository = Depends(get_analysis_repo),
    document_repo: DocumentRepository = Depends(get_document_repo),
) -> AnalysisService:
    return AnalysisService(analysis_repo, document_repo)

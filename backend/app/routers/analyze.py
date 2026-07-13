"""POST /api/analyze — run the governance analysis over uploaded documents."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ValidationAppError
from app.db.base import get_session
from app.deps import get_analysis_service
from app.schemas.api import AnalyzeRequest, AnalyzeResponse
from app.services.analysis_service import AnalysisService

router = APIRouter(prefix="/api", tags=["analyze"])


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    body: AnalyzeRequest,
    service: AnalysisService = Depends(get_analysis_service),
    session: AsyncSession = Depends(get_session),
):
    if not body.document_ids:
        raise ValidationAppError("الرجاء رفع وثيقة واحدة على الأقل قبل التحليل.")
    analysis = await service.run(body.document_ids)
    await session.commit()
    return AnalyzeResponse(analysis_id=analysis.id, status=analysis.status, source=analysis.source)

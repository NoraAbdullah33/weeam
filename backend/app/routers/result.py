"""GET /api/result/{id}, /api/report/{id}, /api/history."""
from fastapi import APIRouter, Depends

from app.core.errors import NotFoundError
from app.deps import get_analysis_repo
from app.repositories.analysis_repo import AnalysisRepository
from app.schemas.api import HistoryItem, HistoryResponse, ResultResponse

router = APIRouter(prefix="/api", tags=["result"])


@router.get("/result/{analysis_id}", response_model=ResultResponse)
async def get_result(analysis_id: str, repo: AnalysisRepository = Depends(get_analysis_repo)):
    a = await repo.get(analysis_id)
    if not a:
        raise NotFoundError("لم يتم العثور على التحليل المطلوب.")
    return ResultResponse(
        analysis_id=a.id, status=a.status, source=a.source, created_at=a.created_at, result=a.result or {},
    )


@router.get("/report/{analysis_id}")
async def get_report(analysis_id: str, repo: AnalysisRepository = Depends(get_analysis_repo)):
    """Executive report: scores, gaps and roadmap in a flat, export-friendly shape."""
    a = await repo.get(analysis_id)
    if not a:
        raise NotFoundError("لم يتم العثور على التحليل المطلوب.")
    r = a.result or {}
    summary = r.get("summary", {})
    return {
        "success": True,
        "analysis_id": a.id,
        "generated_at": a.completed_at or a.created_at,
        "organization_health": a.organization_health,
        "alignment_score": a.alignment_score,
        "governance_maturity": a.governance_maturity,
        "rating": summary.get("rating", ""),
        "documents": summary.get("documents", 0),
        "pages": summary.get("pages", 0),
        "governance_gaps": [
            {
                "title": g.title, "severity": g.severity, "description": g.description,
                "business_impact": g.business_impact, "recommendation": g.recommendation,
                "confidence": g.confidence,
            }
            for g in a.gaps
        ],
        "roadmap": [
            {
                "title": r_.title, "priority": r_.priority, "owner": r_.owner,
                "duration": r_.duration, "impact": r_.impact, "improvement": r_.improvement, "stage": r_.stage,
            }
            for r_ in a.recommendations
        ],
    }


@router.get("/history", response_model=HistoryResponse)
async def history(repo: AnalysisRepository = Depends(get_analysis_repo)):
    rows = await repo.list_recent(limit=25)
    items = [
        HistoryItem(
            analysis_id=a.id, status=a.status, source=a.source,
            organization_health=a.organization_health, alignment_score=a.alignment_score,
            documents=len(a.document_ids or []), created_at=a.created_at,
        )
        for a in rows
    ]
    return HistoryResponse(items=items)

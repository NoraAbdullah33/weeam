"""Data access for analysis sessions, gaps and recommendations."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import AnalysisSession, GovernanceGap, Recommendation


class AnalysisRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, **kwargs) -> AnalysisSession:
        obj = AnalysisSession(**kwargs)
        self.session.add(obj)
        await self.session.flush()
        return obj

    async def get(self, analysis_id: str) -> AnalysisSession | None:
        res = await self.session.execute(
            select(AnalysisSession)
            .where(AnalysisSession.id == analysis_id)
            .options(selectinload(AnalysisSession.gaps), selectinload(AnalysisSession.recommendations))
        )
        return res.scalar_one_or_none()

    async def list_recent(self, limit: int = 25) -> list[AnalysisSession]:
        res = await self.session.execute(
            select(AnalysisSession).order_by(AnalysisSession.created_at.desc()).limit(limit)
        )
        return list(res.scalars().all())

    async def complete(
        self, analysis: AnalysisSession, *, source: str, model: str, payload: dict,
        gaps: list[dict], recommendations: list[dict],
    ) -> AnalysisSession:
        summary = payload.get("summary", {})
        analysis.status = "completed"
        analysis.source = source
        analysis.model = model
        analysis.organization_health = int(summary.get("org_health", 0) or 0)
        analysis.alignment_score = int(summary.get("alignment", 0) or 0)
        analysis.governance_maturity = payload.get("governance_maturity", {})
        analysis.result = payload
        analysis.completed_at = datetime.now(timezone.utc)
        for g in gaps:
            self.session.add(GovernanceGap(analysis_id=analysis.id, **g))
        for r in recommendations:
            self.session.add(Recommendation(analysis_id=analysis.id, **r))
        await self.session.flush()
        return analysis

    async def fail(self, analysis: AnalysisSession, message: str) -> AnalysisSession:
        analysis.status = "failed"
        analysis.error_message = message[:500]
        await self.session.flush()
        return analysis

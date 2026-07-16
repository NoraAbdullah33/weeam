"""Compliance orchestration: extract uploaded docs → RAG compliance → persist.

No fabricated results: if the knowledge base is empty or no regulatory matches
are found, a clear error is returned instead of fake data.
"""
from __future__ import annotations

from app.core.errors import AnalysisError, NotFoundError
from app.core.logging import get_logger
from app.db.models import AnalysisSession
from app.repositories.analysis_repo import AnalysisRepository
from app.repositories.document_repo import DocumentRepository
from app.services import compliance

logger = get_logger("waaem.analysis")

_SEV = {"Non-Compliant": "critical", "Partially Compliant": "high", "Compliant": "low", "Not Applicable": "low"}


def _gap_rows(report: dict) -> list[dict]:
    rows = []
    for f in report.get("findings", []):
        if f.get("status") == "Compliant":
            continue
        rows.append({
            "title": f.get("requirement_title", ""),
            "severity": f.get("severity") or _SEV.get(f.get("status"), "medium"),
            "description": f.get("why", ""), "business_impact": f.get("gap", ""),
            "recommendation": f.get("recommendation", ""),
            "confidence": int(round(float(f.get("match_score", 0)) * 100)),
            "extra": {"status": f.get("status"), "authority": f.get("authority"),
                      "reference_id": f.get("reference_id"), "source_url": f.get("source_url")},
        })
    return rows


def _reco_rows(report: dict) -> list[dict]:
    return [{"title": r, "priority": "high", "stage": "compliance"} for r in report.get("recommendations", [])]


class AnalysisService:
    def __init__(self, analysis_repo: AnalysisRepository, document_repo: DocumentRepository):
        self.analysis_repo = analysis_repo
        self.document_repo = document_repo

    async def run(self, document_ids: list[str]) -> AnalysisSession:
        docs = await self.document_repo.get_many(document_ids)
        if not docs:
            raise NotFoundError("لم يتم العثور على الوثائق المطلوبة.")
        combined = "\n\n".join(d.extracted_text for d in docs if d.extracted_text).strip()
        if not combined:
            raise AnalysisError("لا يوجد نص قابل للتحليل في الوثائق المرفوعة.")

        analysis = await self.analysis_repo.create(status="processing", document_ids=[d.id for d in docs])
        try:
            report = await compliance.analyze(combined)
        except AnalysisError:
            await self.analysis_repo.fail(analysis, "compliance_failed")
            raise
        except Exception as e:  # noqa: BLE001 — never surface a raw 500
            logger.exception("compliance analysis crashed: %s", e)
            await self.analysis_repo.fail(analysis, str(e)[:200])
            raise AnalysisError("تعذّر تحليل الوثيقة. الرجاء المحاولة بوثيقة أخرى.")

        payload = report.model_dump()
        payload["documents"] = len(docs)
        payload["document_names"] = [d.filename for d in docs]
        # store overall compliance in `organization_health` for querying/history
        payload_for_repo = {"summary": {"org_health": report.overall_compliance, "alignment": report.overall_compliance},
                            **payload}
        await self.analysis_repo.complete(
            analysis, source=report.engine, model=report.engine, payload=payload_for_repo,
            gaps=_gap_rows(payload), recommendations=_reco_rows(payload),
        )
        logger.info("compliance analysis %s: overall=%d%% engine=%s", analysis.id, report.overall_compliance, report.engine)
        return analysis

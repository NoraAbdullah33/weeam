"""Validated compliance report contract (RAG output)."""
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

STATUSES = ["Compliant", "Partially Compliant", "Non-Compliant", "Not Applicable"]
STATUS_AR = {
    "Compliant": "ملتزم",
    "Partially Compliant": "ملتزم جزئياً",
    "Non-Compliant": "غير ملتزم",
    "Not Applicable": "لا ينطبق",
}


class Finding(BaseModel):
    requirement_title: str
    authority: str
    source_document: str = ""
    section: str = ""
    status: str = "Non-Compliant"
    why: str = ""
    evidence_uploaded: str = "Insufficient evidence found."
    evidence_regulation: str = ""
    gap: str = ""
    recommendation: str = ""
    suggested_improvement: str = ""
    reference_id: str = ""
    source_url: str = ""
    severity: str = "medium"          # critical | high | medium | low
    match_score: float = 0.0

    @field_validator("status")
    @classmethod
    def _status(cls, v):
        v = (v or "").strip()
        return v if v in STATUSES else "Non-Compliant"


class AuthorityScore(BaseModel):
    authority: str
    score: int
    matched: int = 0
    total: int = 0


class ComplianceTotals(BaseModel):
    matched_requirements: int = 0
    missing_requirements: int = 0
    partial_matches: int = 0
    high_risk_findings: int = 0
    critical_findings: int = 0


class ComplianceReport(BaseModel):
    overall_compliance: int = 0
    breakdown: List[AuthorityScore] = Field(default_factory=list)
    executive_summary: str = ""
    findings: List[Finding] = Field(default_factory=list)
    missing_controls: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    totals: ComplianceTotals = Field(default_factory=ComplianceTotals)
    engine: str = ""                  # always "llama" — the compliance verdict is the model's judgment
    knowledge_base: dict = Field(default_factory=dict)

    @field_validator("overall_compliance", mode="before")
    @classmethod
    def _clamp(cls, v):
        try:
            return max(0, min(100, int(round(float(v)))))
        except (TypeError, ValueError):
            return 0

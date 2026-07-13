"""Strict Pydantic contract for the Meta Llama governance-analysis output.

Every AI response is validated against `LlamaAnalysis`. Invalid output triggers
a repair prompt; if it still fails, the service returns the curated fallback.
"""
from typing import List

from pydantic import BaseModel, Field, field_validator

CATEGORIES = ["strategy", "objectives", "policies", "procedures", "kpis", "owners"]
SEVERITIES = ["critical", "high", "medium", "low"]


def _clamp(v: int) -> int:
    return max(0, min(100, int(round(v))))


class GovernanceMaturity(BaseModel):
    leadership: int = 0
    policies: int = 0
    procedures: int = 0
    kpis: int = 0
    compliance: int = 0

    @field_validator("*", mode="before")
    @classmethod
    def _num(cls, v):
        try:
            return _clamp(float(v))
        except (TypeError, ValueError):
            return 0


class Entity(BaseModel):
    id: str
    category: str
    label: str
    owner: str = ""
    align: int = 0
    status: str = ""
    desc: str = ""

    @field_validator("category")
    @classmethod
    def _cat(cls, v):
        v = (v or "").strip().lower()
        return v if v in CATEGORIES else "policies"

    @field_validator("align", mode="before")
    @classmethod
    def _align(cls, v):
        try:
            return _clamp(float(v))
        except (TypeError, ValueError):
            return 0


class Gap(BaseModel):
    title: str
    severity: str = "medium"
    description: str = ""
    business_impact: str = ""
    recommendation: str = ""
    evidence: str = ""
    confidence: int = 80
    improvement: str = ""
    departments: List[str] = Field(default_factory=list)

    @field_validator("severity")
    @classmethod
    def _sev(cls, v):
        v = (v or "").strip().lower()
        return v if v in SEVERITIES else "medium"

    @field_validator("confidence", mode="before")
    @classmethod
    def _conf(cls, v):
        try:
            return _clamp(float(v))
        except (TypeError, ValueError):
            return 80


class RoadmapItem(BaseModel):
    title: str
    priority: str = "medium"
    owner: str = ""
    duration: str = ""
    impact: str = ""
    improvement: str = ""
    stage: str = ""
    difficulty: str = "متوسطة"
    risk: str = "متوسط"
    departments: List[str] = Field(default_factory=list)


class LlamaAnalysis(BaseModel):
    """The validated governance analysis returned by the AI engine."""

    organization_health: int = 0
    alignment_score: int = 0
    governance_maturity: GovernanceMaturity = Field(default_factory=GovernanceMaturity)
    entities: List[Entity] = Field(default_factory=list)
    relationships: List[List[str]] = Field(default_factory=list)
    governance_gaps: List[Gap] = Field(default_factory=list)
    roadmap: List[RoadmapItem] = Field(default_factory=list)

    @field_validator("organization_health", "alignment_score", mode="before")
    @classmethod
    def _score(cls, v):
        try:
            return _clamp(float(v))
        except (TypeError, ValueError):
            return 0

    @field_validator("relationships", mode="before")
    @classmethod
    def _rels(cls, v):
        out = []
        for e in v or []:
            if isinstance(e, (list, tuple)) and len(e) >= 2:
                out.append([str(e[0]), str(e[1])])
            elif isinstance(e, dict) and "source" in e and "target" in e:
                out.append([str(e["source"]), str(e["target"])])
        return out

"""Persistent domain models."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _uuid() -> str:
    return uuid.uuid4().hex


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    filename: Mapped[str] = mapped_column(String(512))
    ext: Mapped[str] = mapped_column(String(16))
    content_type: Mapped[str] = mapped_column(String(128), default="")
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    pages: Mapped[int] = mapped_column(Integer, default=0)
    char_count: Mapped[int] = mapped_column(Integer, default=0)
    storage_path: Mapped[str] = mapped_column(String(1024), default="")
    extracted_text: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="uploaded")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class AnalysisSession(Base):
    __tablename__ = "analysis_sessions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    status: Mapped[str] = mapped_column(String(32), default="pending")  # pending|processing|completed|failed
    source: Mapped[str] = mapped_column(String(32), default="")  # llama|llamacpp|fallback
    model: Mapped[str] = mapped_column(String(128), default="")
    document_ids: Mapped[list] = mapped_column(JSON, default=list)

    organization_health: Mapped[int] = mapped_column(Integer, default=0)
    alignment_score: Mapped[int] = mapped_column(Integer, default=0)
    governance_maturity: Mapped[dict] = mapped_column(JSON, default=dict)
    # Full render-ready payload consumed by the frontend (summary/kpis/graph/issues/journey).
    result: Mapped[dict] = mapped_column(JSON, default=dict)
    error_message: Mapped[str] = mapped_column(String(512), default="")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    gaps: Mapped[list["GovernanceGap"]] = relationship(back_populates="analysis", cascade="all, delete-orphan")
    recommendations: Mapped[list["Recommendation"]] = relationship(back_populates="analysis", cascade="all, delete-orphan")


class GovernanceGap(Base):
    __tablename__ = "governance_gaps"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    analysis_id: Mapped[str] = mapped_column(ForeignKey("analysis_sessions.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(512))
    severity: Mapped[str] = mapped_column(String(32), default="medium")
    description: Mapped[str] = mapped_column(Text, default="")
    business_impact: Mapped[str] = mapped_column(Text, default="")
    recommendation: Mapped[str] = mapped_column(Text, default="")
    confidence: Mapped[int] = mapped_column(Integer, default=0)
    extra: Mapped[dict] = mapped_column(JSON, default=dict)

    analysis: Mapped["AnalysisSession"] = relationship(back_populates="gaps")


class KBDocument(Base):
    """A version of an official regulatory document indexed into the KB."""
    __tablename__ = "kb_documents"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    source_id: Mapped[str] = mapped_column(String(128), index=True)  # registry id
    authority: Mapped[str] = mapped_column(String(32), index=True)
    title_en: Mapped[str] = mapped_column(String(512), default="")
    title_ar: Mapped[str] = mapped_column(String(512), default="")
    version: Mapped[str] = mapped_column(String(64), default="")
    published_date: Mapped[str] = mapped_column(String(32), default="")
    language: Mapped[str] = mapped_column(String(16), default="")
    source_url: Mapped[str] = mapped_column(String(1024), default="")
    landing_url: Mapped[str] = mapped_column(String(1024), default="")
    file_hash: Mapped[str] = mapped_column(String(64), index=True, default="")
    raw_path: Mapped[str] = mapped_column(String(1024), default="")
    pages: Mapped[int] = mapped_column(Integer, default=0)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(32), default="indexed")  # indexed|failed|superseded
    is_current: Mapped[bool] = mapped_column(default=True)
    failure_reason: Mapped[str] = mapped_column(String(512), default="")
    indexed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class KBIngestionRun(Base):
    """A record of one ingestion/update run with per-document outcomes."""
    __tablename__ = "kb_ingestion_runs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    total: Mapped[int] = mapped_column(Integer, default=0)
    succeeded: Mapped[int] = mapped_column(Integer, default=0)
    failed: Mapped[int] = mapped_column(Integer, default=0)
    skipped: Mapped[int] = mapped_column(Integer, default=0)
    report: Mapped[list] = mapped_column(JSON, default=list)  # [{source_id, status, reason, ...}]


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    analysis_id: Mapped[str] = mapped_column(ForeignKey("analysis_sessions.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(512))
    priority: Mapped[str] = mapped_column(String(32), default="medium")
    owner: Mapped[str] = mapped_column(String(256), default="")
    duration: Mapped[str] = mapped_column(String(128), default="")
    impact: Mapped[str] = mapped_column(Text, default="")
    improvement: Mapped[str] = mapped_column(String(64), default="")
    stage: Mapped[str] = mapped_column(String(128), default="")
    extra: Mapped[dict] = mapped_column(JSON, default=dict)

    analysis: Mapped["AnalysisSession"] = relationship(back_populates="recommendations")

"""Request/response models for the public REST API."""
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class DocumentOut(BaseModel):
    id: str
    filename: str
    ext: str
    pages: int
    size_kb: int
    char_count: int
    status: str


class UploadResponse(BaseModel):
    success: bool = True
    document_ids: List[str]
    documents: List[DocumentOut]


class AnalyzeRequest(BaseModel):
    document_ids: List[str] = Field(default_factory=list)


class AnalyzeResponse(BaseModel):
    success: bool = True
    analysis_id: str
    status: str
    source: str


class ResultResponse(BaseModel):
    success: bool = True
    analysis_id: str
    status: str
    source: str
    created_at: Optional[datetime] = None
    # Render-ready payload consumed by the frontend workspace.
    result: Dict[str, Any]


class HistoryItem(BaseModel):
    analysis_id: str
    status: str
    source: str
    organization_health: int
    alignment_score: int
    documents: int
    created_at: Optional[datetime] = None


class HistoryResponse(BaseModel):
    success: bool = True
    items: List[HistoryItem]

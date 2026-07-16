"""Document text extraction: PDF (pdfplumber → PyMuPDF fallback) and DOCX."""
from __future__ import annotations

import io

from app.core.errors import UnsupportedFileError
from app.core.logging import get_logger

logger = get_logger("waaem.extraction")


def _extract_pdf(data: bytes) -> tuple[str, int]:
    text_parts: list[str] = []
    pages = 0
    # Primary: pdfplumber (good layout-aware text).
    try:
        import pdfplumber

        with pdfplumber.open(io.BytesIO(data)) as pdf:
            pages = len(pdf.pages)
            for page in pdf.pages:
                text_parts.append(page.extract_text() or "")
        joined = "\n".join(text_parts).strip()
        if joined:
            return joined, pages
    except Exception as e:  # noqa: BLE001
        logger.warning("pdfplumber failed, falling back to PyMuPDF: %s", e)

    # Fallback: PyMuPDF (fitz).
    try:
        import fitz

        doc = fitz.open(stream=data, filetype="pdf")
        pages = doc.page_count
        text_parts = [page.get_text() for page in doc]
        return "\n".join(text_parts).strip(), pages
    except Exception as e:  # noqa: BLE001
        logger.error("PyMuPDF extraction failed: %s", e)
        return "", pages


def _extract_docx(data: bytes) -> tuple[str, int]:
    from docx import Document as Docx

    doc = Docx(io.BytesIO(data))
    parts: list[str] = [p.text for p in doc.paragraphs if p.text and p.text.strip()]
    for table in doc.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells if c.text and c.text.strip()]
            if cells:
                parts.append(" | ".join(cells))
    text = "\n".join(parts).strip()
    # Approximate page count (~500 words/page).
    words = len(text.split())
    pages = max(1, round(words / 500))
    return text, pages


def extract(filename: str, ext: str, data: bytes) -> tuple[str, int]:
    """Return (text, page_count). Raises UnsupportedFileError for unknown types."""
    ext = (ext or "").lower().lstrip(".")
    if ext == "pdf":
        return _extract_pdf(data)
    if ext in ("docx", "doc"):
        return _extract_docx(data)
    raise UnsupportedFileError()

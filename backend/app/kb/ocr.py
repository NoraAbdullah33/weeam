"""Optional OCR for scanned PDFs (no text layer).

Uses PyMuPDF to rasterize pages + pytesseract. If the tesseract binary is not
installed, OCR is skipped and the caller reports the document as needing OCR
rather than fabricating content.
"""
from __future__ import annotations

import shutil

from app.core.logging import get_logger

logger = get_logger("waaem.kb.ocr")


def ocr_available() -> bool:
    if shutil.which("tesseract") is None:
        return False
    try:
        import pytesseract  # noqa: F401
        return True
    except Exception:  # noqa: BLE001
        return False


def ocr_pdf(data: bytes, max_pages: int = 40, langs: str = "ara+eng") -> str:
    if not ocr_available():
        return ""
    import fitz  # PyMuPDF
    import pytesseract
    from PIL import Image
    import io

    out: list[str] = []
    doc = fitz.open(stream=data, filetype="pdf")
    for i, page in enumerate(doc):
        if i >= max_pages:
            break
        pix = page.get_pixmap(dpi=200)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        out.append(pytesseract.image_to_string(img, lang=langs))
    return "\n".join(out).strip()

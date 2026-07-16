"""Text normalization + semantic chunking for regulatory documents."""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.core.config import settings

# Arabic diacritics + tatweel to strip during normalization.
_DIACRITICS = re.compile(r"[ؗ-ًؚ-ْـ]")
_SECTION_RE = re.compile(
    r"^\s*(?:(?:\d+(?:[.\-]\d+)*)|(?:[A-Z]{2,4}[-\s]?\d+(?:[.\-]\d+)*)|(?:المادة|الضابط|البند|القسم)\s*[٠-٩\d]+)",
)


def normalize(text: str) -> str:
    if not text:
        return ""
    text = text.replace(" ", " ")
    text = _DIACRITICS.sub("", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Drop obvious page-marker / classification noise lines.
    lines = [ln.strip() for ln in text.split("\n")]
    lines = [ln for ln in lines if ln and not re.fullmatch(r"\d{1,4}", ln)]
    return "\n".join(lines).strip()


@dataclass
class Chunk:
    text: str
    section: str
    paragraph: int


def _detect_section(line: str, current: str) -> str:
    m = _SECTION_RE.match(line)
    if m:
        return line[:60].strip()
    return current


def chunk_text(text: str) -> list[Chunk]:
    """Paragraph-aware semantic chunking with section tracking + overlap."""
    text = normalize(text)
    if not text:
        return []
    size, overlap = settings.chunk_size, settings.chunk_overlap
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]

    chunks: list[Chunk] = []
    buf = ""
    section = "—"
    para_idx = 0
    for p in paras:
        first_line = p.split("\n", 1)[0]
        section = _detect_section(first_line, section)
        if len(buf) + len(p) + 1 <= size:
            buf = f"{buf}\n{p}".strip()
        else:
            if buf:
                para_idx += 1
                chunks.append(Chunk(text=buf, section=section, paragraph=para_idx))
                tail = buf[-overlap:] if overlap else ""
                buf = f"{tail}\n{p}".strip()
            else:
                # Single very long paragraph → hard-split.
                for i in range(0, len(p), size - overlap):
                    para_idx += 1
                    chunks.append(Chunk(text=p[i:i + size], section=section, paragraph=para_idx))
                buf = ""
    if buf:
        para_idx += 1
        chunks.append(Chunk(text=buf, section=section, paragraph=para_idx))
    # Drop tiny fragments.
    return [c for c in chunks if len(c.text) >= 120]

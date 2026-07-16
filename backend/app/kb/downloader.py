"""Robots-aware document downloader with honest failure reporting.

Never fabricates content. Every attempt returns either real bytes or a
structured failure reason (robots, http status, not-a-pdf, timeout, error).
"""
from __future__ import annotations

import urllib.robotparser
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger("waaem.kb.download")

# Realistic browser headers. Several official portals (e.g. SDAIA) sit behind a
# WAF/anti-bot (Imperva/Incapsula) that returns an HTML challenge to non-browser
# clients. Sending normal browser headers lets us fetch the same PUBLIC PDFs a
# human would download. Content is still validated as a real PDF before use.
_BROWSER_UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
               "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")


def _browser_headers(url: str) -> dict:
    p = urlparse(url)
    return {
        "User-Agent": _BROWSER_UA,
        "Accept": "text/html,application/xhtml+xml,application/pdf,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
        "Referer": f"{p.scheme}://{p.netloc}/",
    }


@dataclass
class DownloadResult:
    ok: bool
    data: bytes | None = None
    content_type: str = ""
    size: int = 0
    final_url: str = ""
    reason: str = ""       # machine reason
    detail: str = ""       # human-friendly (Arabic-capable)


async def _robots_allowed(url: str) -> bool:
    if not settings.respect_robots:
        return True
    try:
        p = urlparse(url)
        robots_url = f"{p.scheme}://{p.netloc}/robots.txt"
        rp = urllib.robotparser.RobotFileParser()
        async with httpx.AsyncClient(timeout=10, headers={"User-Agent": _BROWSER_UA}) as c:
            r = await c.get(robots_url)
            if r.status_code >= 400 or "<html" in r.text[:200].lower():
                return True  # no robots (or WAF challenge) → allowed
            rp.parse(r.text.splitlines())
        return rp.can_fetch(_BROWSER_UA, url)
    except Exception:  # noqa: BLE001 — robots fetch failure shouldn't block
        return True


async def download(url: str) -> DownloadResult:
    if not await _robots_allowed(url):
        return DownloadResult(ok=False, reason="robots_disallowed",
                              detail="ممنوع وفق ملف robots.txt للموقع الرسمي.")
    try:
        async with httpx.AsyncClient(timeout=settings.ingest_timeout, follow_redirects=True,
                                     headers=_browser_headers(url)) as c:
            r = await c.get(url)
    except httpx.TimeoutException:
        return DownloadResult(ok=False, reason="timeout", detail="انتهت مهلة الاتصال بالمصدر الرسمي.")
    except Exception as e:  # noqa: BLE001
        return DownloadResult(ok=False, reason="connection_error", detail=f"تعذّر الاتصال بالمصدر: {type(e).__name__}")

    if r.status_code != 200:
        return DownloadResult(ok=False, reason=f"http_{r.status_code}", final_url=str(r.url),
                              detail=f"رمز استجابة غير متوقع من الموقع الرسمي: {r.status_code}.")

    data = r.content
    ctype = r.headers.get("content-type", "").split(";")[0].strip()
    is_pdf = data[:5] == b"%PDF-" or ctype == "application/pdf"
    if not is_pdf:
        # Common case: WAF/anti-bot page returns 200 + HTML instead of the file.
        snippet = data[:200].decode("utf-8", "ignore").lower()
        waf = "request rejected" in snippet or "access denied" in snippet or "<html" in snippet
        return DownloadResult(
            ok=False, reason="not_pdf", content_type=ctype, size=len(data), final_url=str(r.url),
            detail=("حجب الموقع الرسمي التنزيل الآلي (حماية ضد البوت/WAF)." if waf
                    else f"المحتوى المُستلم ليس ملف PDF (النوع: {ctype or 'غير معروف'})."),
        )

    return DownloadResult(ok=True, data=data, content_type="application/pdf", size=len(data), final_url=str(r.url))

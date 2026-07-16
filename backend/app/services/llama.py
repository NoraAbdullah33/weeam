"""Meta Llama transport client — Groq (hosted) primary, Ollama / llama.cpp local.

The frontend never talks to Llama; only this backend does. Every request forces
JSON output. The client only transports the prompt and returns the raw model
text — the compliance service builds the prompt and validates the response. On a
transport failure the client raises AnalysisError; the caller surfaces an honest
error rather than substituting a non-Llama score.
"""
from __future__ import annotations

import asyncio
import re

import httpx

from app.core.config import settings
from app.core.errors import AnalysisError
from app.core.logging import get_logger

logger = get_logger("waaem.llama")

_JSON_RE = re.compile(r"\{.*\}", re.DOTALL)


def _extract_json(raw: str) -> str:
    raw = (raw or "").strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        raw = raw.split("\n", 1)[-1] if "\n" in raw else raw
    m = _JSON_RE.search(raw)
    return m.group(0) if m else raw


class LlamaClient:
    def __init__(self) -> None:
        self.host = settings.ollama_host.rstrip("/")
        self.model = settings.llama_model
        self.timeout = settings.llama_timeout

    async def health(self) -> bool:
        # Groq (hosted) is considered available whenever a key is configured — the
        # actual reachability is proven by the generate call, which raises on a real
        # API error (retrying transient 429s first).
        if settings.use_groq:
            return True
        try:
            async with httpx.AsyncClient(timeout=5) as c:
                r = await c.get(f"{self.host}/api/tags")
                return r.status_code == 200
        except Exception:  # noqa: BLE001
            return False

    @staticmethod
    def _retry_wait(r: httpx.Response, detail: str, attempt: int) -> float:
        """Seconds to wait before retrying a 429: prefer the server's Retry-After
        header, then Groq's 'try again in Xs' message, else exponential backoff
        (all capped at 60s — the free-tier TPM window resets each minute)."""
        ra = r.headers.get("retry-after")
        if ra:
            try:
                return min(60.0, float(ra))
            except ValueError:
                pass
        m = re.search(r"try again in ([\d.]+)s", detail)
        if m:
            try:
                return min(60.0, float(m.group(1)) + 0.5)
            except ValueError:
                pass
        return min(60.0, 3.0 * (2 ** attempt))

    async def _groq_generate(self, prompt: str) -> str:
        """Hosted Llama via Groq's OpenAI-compatible chat completions endpoint.
        Transient 429 rate-limits are retried with backoff so the real Llama
        judgment is produced whenever possible. Any other API error — or a 429
        that survives every retry — raises AnalysisError, and the caller surfaces
        an honest error rather than a fabricated similarity score."""
        url = f"{settings.groq_base_url.rstrip('/')}/chat/completions"
        headers = {"Authorization": f"Bearer {settings.groq_api_key}", "Content-Type": "application/json"}
        body = {
            "model": settings.groq_model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1,
            "max_tokens": 2200,
            "response_format": {"type": "json_object"},
        }
        last_detail = ""
        for attempt in range(settings.groq_max_retries + 1):
            async with httpx.AsyncClient(timeout=settings.groq_timeout) as c:
                r = await c.post(url, headers=headers, json=body)
            if r.status_code == 200:
                data = r.json()
                content = data["choices"][0]["message"]["content"]
                logger.info("Groq analysis ok · model=%s · usage=%s", settings.groq_model, data.get("usage"))
                return content
            last_detail = r.text[:300]
            if r.status_code == 429 and attempt < settings.groq_max_retries:
                wait = self._retry_wait(r, last_detail, attempt)
                logger.warning("Groq 429 rate-limit (attempt %d/%d) — retrying in %.1fs",
                               attempt + 1, settings.groq_max_retries + 1, wait)
                await asyncio.sleep(wait)
                continue
            # non-retryable error, or 429 that survived every retry
            logger.error("Groq API error %s: %s", r.status_code, last_detail)
            raise AnalysisError(f"Groq API {r.status_code}: {last_detail}")
        raise AnalysisError(f"Groq rate-limited after {settings.groq_max_retries + 1} attempts: {last_detail}")

    async def _ollama_generate(self, prompt: str) -> str:
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "keep_alive": "20m",  # keep the model warm for fast subsequent analyses
            "options": {"temperature": 0.1, "num_ctx": 3072, "num_predict": 500},
        }
        async with httpx.AsyncClient(timeout=self.timeout) as c:
            r = await c.post(f"{self.host}/api/generate", json=payload)
            r.raise_for_status()
            return r.json().get("response", "")

    async def warmup(self) -> None:
        """Preload the model so the first user analysis isn't cold-started."""
        if settings.use_groq:
            logger.info("Using hosted Groq model: %s (no local warmup needed)", settings.groq_model)
            return
        try:
            async with httpx.AsyncClient(timeout=60) as c:
                await c.post(f"{self.host}/api/generate",
                             json={"model": self.model, "prompt": "ok", "stream": False,
                                   "keep_alive": "20m", "options": {"num_predict": 1}})
                logger.info("Llama model warmed: %s", self.model)
        except Exception as e:  # noqa: BLE001
            logger.info("Llama warmup skipped (%s)", type(e).__name__)

    async def _llamacpp_generate(self, prompt: str) -> str:
        """Optional llama.cpp OpenAI-compatible fallback."""
        url = settings.llamacpp_url.rstrip("/")
        body = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }
        async with httpx.AsyncClient(timeout=self.timeout) as c:
            r = await c.post(f"{url}/v1/chat/completions", json=body)
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]

    async def _generate(self, prompt: str) -> str:
        # Prefer Groq (hosted, fast) when configured; on a Groq error it raises so
        # the caller surfaces an honest error. Local Ollama falls through to an
        # optional llama.cpp endpoint (both are still real Llama inference).
        if settings.use_groq:
            return await self._groq_generate(prompt)
        try:
            return await self._ollama_generate(prompt)
        except Exception as e:  # noqa: BLE001
            if settings.llamacpp_url:
                logger.warning("Ollama failed (%s); trying llama.cpp", e)
                return await self._llamacpp_generate(prompt)
            raise


llama_client = LlamaClient()

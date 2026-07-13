"""Meta Llama governance-analysis client (Ollama primary, llama.cpp fallback).

The frontend never talks to Llama — only this backend does. Every response is
forced to JSON, parsed, and validated with Pydantic. Invalid output is repaired
with a follow-up prompt; persistent failure raises AnalysisError so the service
layer can fall back to the curated analysis.
"""
from __future__ import annotations

import json
import re

import httpx
from pydantic import ValidationError

from app.core.config import settings
from app.core.errors import AnalysisError
from app.core.logging import get_logger
from app.schemas.llama import LlamaAnalysis
from app.services.prompts import build_analysis_prompt, build_repair_prompt

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
        # actual reachability is proven by the generate call, which falls back to the
        # retrieval engine on a real API error.
        if settings.use_groq:
            return True
        try:
            async with httpx.AsyncClient(timeout=5) as c:
                r = await c.get(f"{self.host}/api/tags")
                return r.status_code == 200
        except Exception:  # noqa: BLE001
            return False

    async def _groq_generate(self, prompt: str) -> str:
        """Hosted Llama via Groq's OpenAI-compatible chat completions endpoint.
        Raises on any API error so the caller can fall back to the retrieval engine."""
        url = f"{settings.groq_base_url.rstrip('/')}/chat/completions"
        headers = {"Authorization": f"Bearer {settings.groq_api_key}", "Content-Type": "application/json"}
        body = {
            "model": settings.groq_model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1,
            "max_tokens": 2200,
            "response_format": {"type": "json_object"},
        }
        async with httpx.AsyncClient(timeout=settings.groq_timeout) as c:
            r = await c.post(url, headers=headers, json=body)
            if r.status_code != 200:
                # surface Groq's error body so bad key / rate limit / bad request is visible
                detail = r.text[:300]
                logger.error("Groq API error %s: %s", r.status_code, detail)
                raise AnalysisError(f"Groq API {r.status_code}: {detail}")
            data = r.json()
            content = data["choices"][0]["message"]["content"]
            logger.info("Groq analysis ok · model=%s · usage=%s", settings.groq_model, data.get("usage"))
            return content

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
        # Prefer Groq (hosted, fast) when configured; its errors propagate so the
        # compliance engine falls back to the retrieval scorer.
        if settings.use_groq:
            return await self._groq_generate(prompt)
        try:
            return await self._ollama_generate(prompt)
        except Exception as e:  # noqa: BLE001
            if settings.llamacpp_url:
                logger.warning("Ollama failed (%s); trying llama.cpp fallback", e)
                return await self._llamacpp_generate(prompt)
            raise

    async def analyze(self, document_text: str) -> tuple[LlamaAnalysis, str]:
        """Return (validated analysis, source). Raises AnalysisError on failure."""
        source = "llamacpp" if settings.llamacpp_url and not await self.health() else "llama"
        prompt = build_analysis_prompt(document_text)
        raw = ""
        last_err = ""
        for attempt in range(settings.llama_max_retries + 1):
            try:
                raw = await self._generate(prompt)
                data = json.loads(_extract_json(raw))
                analysis = LlamaAnalysis.model_validate(data)
                if not analysis.entities and not analysis.governance_gaps:
                    raise ValueError("empty analysis")
                logger.info("Llama analysis valid on attempt %d", attempt + 1)
                return analysis, source
            except (json.JSONDecodeError, ValidationError, ValueError) as e:
                last_err = str(e)
                logger.warning("Llama output invalid (attempt %d): %s", attempt + 1, last_err)
                prompt = build_repair_prompt(raw, last_err)  # repair prompt for next attempt
        raise AnalysisError(f"AI validation failed: {last_err[:200]}")


llama_client = LlamaClient()

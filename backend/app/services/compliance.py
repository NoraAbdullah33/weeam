"""RAG compliance engine.

upload text → semantic chunks → embed → vector search over the official Saudi
regulatory KB → retrieve matching requirements → Llama compliance analysis
(validated) OR a retrieval-grounded scorer. Both cite ONLY retrieved official
chunks — regulations are never invented.
"""
from __future__ import annotations

import asyncio
import json
from statistics import mean

from app.core.config import settings
from app.core.errors import AnalysisError
from app.core.logging import get_logger
from app.kb import embeddings, vectorstore
from app.kb.chunking import chunk_text
from app.kb.sources import AUTHORITIES
from app.schemas.compliance import (
    STATUS_AR, AuthorityScore, ComplianceReport, ComplianceTotals, Finding,
)
from app.services.llama import _extract_json, llama_client

logger = get_logger("waaem.compliance")

# cosine-similarity thresholds (paraphrase-multilingual-MiniLM)
T_COMPLIANT = 0.60
T_PARTIAL = 0.47
T_EVIDENCE = 0.40


def _auth_ar(code: str) -> str:
    """Arabic name of an authority from its acronym (falls back to the acronym)."""
    return AUTHORITIES.get(code, {}).get("name_ar", code)


def _ver_ar(v) -> str:
    v = str(v or "").strip()
    return "الأحدث" if v.lower() in ("", "latest", "current") else v


def _cite_ar(m: dict) -> str:
    """Fully-Arabic official citation: authority + Arabic doc title + version."""
    title = m.get("title_ar") or m.get("title_en") or ""
    return f"{_auth_ar(m.get('authority', ''))} — {title} (إصدار {_ver_ar(m.get('version'))})"


def _title_from(text: str, section: str) -> str:
    if section and section != "—" and len(section) <= 60:
        return section
    line = text.strip().split("\n", 1)[0]
    return (line[:80] + "…") if len(line) > 80 else line


def _ar_title(r: dict) -> str:
    """Arabic requirement title. Uses the Arabic chunk when available, otherwise
    the Arabic document title + section (for English-only sources like DGA)."""
    m = r["meta"]
    sec = str(m.get("section", "")).strip()
    if m.get("language") == "ar":
        return _title_from(r["text"], sec)
    base = m.get("title_ar") or m.get("title_en", "")
    return f"{base} — {sec}" if sec and sec not in ("—", "") else base


def retrieve_requirements(uploaded_text: str, per_query: int = 4, per_authority: int = 5, cap: int = 20) -> list[dict]:
    """Vector-search the KB (Arabic + English both indexed) for the best-matching
    official controls, with per-authority coverage. The report text is then
    rendered in Arabic by Llama, grounded on these retrieved chunks."""
    up_chunks = chunk_text(uploaded_text)[:30]
    up_chunks_text = [c.text for c in up_chunks] or ([uploaded_text[:1000]] if uploaded_text.strip() else [])
    if not up_chunks_text:
        return []

    up_vectors = embeddings.embed_documents(up_chunks_text)
    best: dict[str, dict] = {}

    def _consider(hit: dict, uq_text: str):
        ref = hit["meta"].get("reference_id") or hit["meta"].get("source_id")
        cur = best.get(ref)
        if cur is None or hit["score"] > cur["score"]:
            best[ref] = {"meta": hit["meta"], "text": hit["text"], "score": hit["score"], "uploaded_evidence": uq_text}

    # global relevance
    for uq_text, uq_vec in zip(up_chunks_text, up_vectors):
        for hit in vectorstore.query(uq_vec, per_query):
            _consider(hit, uq_text)

    # per-authority coverage
    for auth in AUTHORITIES:
        tmp: dict[str, dict] = {}
        for uq_text, uq_vec in zip(up_chunks_text[:12], up_vectors[:12]):
            for hit in vectorstore.query(uq_vec, 3, where={"authority": auth}):
                ref = hit["meta"].get("reference_id")
                if ref not in tmp or hit["score"] > tmp[ref]["hit"]["score"]:
                    tmp[ref] = {"hit": hit, "uq": uq_text}
        for item in sorted(tmp.values(), key=lambda x: x["hit"]["score"], reverse=True)[:per_authority]:
            _consider(item["hit"], item["uq"])

    return sorted(best.values(), key=lambda x: x["score"], reverse=True)[:cap]


def _status_for(score: float) -> tuple[str, str]:
    if score >= T_COMPLIANT:
        return "Compliant", "low"
    if score >= T_PARTIAL:
        return "Partially Compliant", "medium"
    if score >= T_EVIDENCE:
        return "Non-Compliant", "high"
    return "Non-Compliant", "high"


def _score_value(status: str) -> int:
    return {"Compliant": 100, "Partially Compliant": 55, "Non-Compliant": 0, "Not Applicable": 0}.get(status, 0)


def build_retrieval_report(requirements: list[dict]) -> ComplianceReport:
    """Deterministic, retrieval-grounded compliance scoring (no LLM)."""
    findings: list[Finding] = []
    for r in requirements:
        m = r["meta"]
        score = float(r["score"])
        status, severity = _status_for(score)
        has_ev = score >= T_EVIDENCE
        if m.get("authority") == "NCA" and status == "Non-Compliant":
            severity = "critical"
        title = _ar_title(r)
        reg_ev = title  # Arabic requirement label (source PDFs are English/garbled-AR)
        up_ev = (r["uploaded_evidence"][:300].strip() if has_ev else "لا يوجد دليل كافٍ في الوثيقة يغطي هذا المتطلب.")
        cite = _cite_ar(m)
        findings.append(Finding(
            requirement_title=title, authority=m.get("authority", ""),
            source_document=m.get("title_ar") or m.get("title_en", ""), section=str(m.get("section", "")),
            status=status, match_score=round(score, 3), severity=severity,
            why=(f"تطابق دلالي بنسبة {round(score*100)}% بين محتوى وثيقتك والمتطلب النظامي."
                 if has_ev else "لم يُعثر على دليل كافٍ في الوثيقة المرفوعة يغطي هذا المتطلب."),
            evidence_uploaded=up_ev, evidence_regulation=reg_ev,
            gap=("لا توجد فجوة جوهرية." if status == "Compliant"
                 else "المتطلب مغطّى جزئياً ويحتاج تفصيلاً إضافياً." if status == "Partially Compliant"
                 else "المتطلب غير مغطّى في الوثيقة الحالية."),
            recommendation=f"مواءمة الوثيقة مع {cite} لسدّ الفجوة.",
            suggested_improvement=("إضافة بند صريح يغطي هذا الضابط مع تحديد المالك وآلية القياس."
                                   if status != "Compliant" else "الحفاظ على الالتزام ومراجعته دورياً."),
            reference_id=m.get("reference_id", ""), source_url=m.get("source_url", ""),
        ))

    return _finalize(findings, engine="retrieval")


def _finalize(findings: list[Finding], engine: str) -> ComplianceReport:
    by_auth: dict[str, list[Finding]] = {}
    for f in findings:
        by_auth.setdefault(f.authority, []).append(f)

    breakdown = []
    for auth, fs in by_auth.items():
        matched = sum(1 for f in fs if f.status == "Compliant")
        score = round(mean(_score_value(f.status) for f in fs)) if fs else 0
        breakdown.append(AuthorityScore(authority=auth, score=score, matched=matched, total=len(fs)))
    overall = round(mean(b.score for b in breakdown)) if breakdown else 0

    totals = ComplianceTotals(
        matched_requirements=sum(1 for f in findings if f.status == "Compliant"),
        missing_requirements=sum(1 for f in findings if f.status == "Non-Compliant"),
        partial_matches=sum(1 for f in findings if f.status == "Partially Compliant"),
        high_risk_findings=sum(1 for f in findings if f.severity == "high"),
        critical_findings=sum(1 for f in findings if f.severity == "critical"),
    )
    missing = [f.requirement_title for f in findings if f.status == "Non-Compliant"][:12]
    recs = list(dict.fromkeys(f.recommendation for f in findings if f.status != "Compliant"))[:8]

    parts = "، ".join(f"{_auth_ar(b.authority)} {b.score}%" for b in breakdown)
    summary = (
        f"بلغت نسبة الالتزام الكلية {overall}% بعد مقارنة الوثيقة المرفوعة مع "
        f"{len(findings)} متطلباً نظامياً من الأنظمة السعودية الرسمية ({parts}). "
        f"تم رصد {totals.matched_requirements} متطلباً ملتزماً، و{totals.partial_matches} جزئياً، "
        f"و{totals.missing_requirements} غير مغطّى، منها {totals.critical_findings} حرجة."
    )
    return ComplianceReport(
        overall_compliance=overall, breakdown=breakdown, executive_summary=summary,
        findings=findings, missing_controls=missing, recommendations=recs, totals=totals, engine=engine,
        knowledge_base={"chunks": vectorstore.count(), "authorities": vectorstore.authorities_summary()},
    )


# --------------------------------------------------------------------------
# Llama path (primary) — grounded strictly in retrieved chunks
# --------------------------------------------------------------------------
def _build_prompt(uploaded_text: str, requirements: list[dict]) -> str:
    """RAG supplies every regulatory requirement + the uploaded document.
    Llama JUDGES each requirement (status + narrative + severity). It does not
    reproduce metadata — the system attaches authority/section/citation from RAG."""
    reqs = []
    for i, r in enumerate(requirements):
        m = r["meta"]
        ar_anchor = _ar_title(r)  # clean Arabic label to anchor cross-lingual matching
        reg_len = 500 if settings.use_groq else 170  # Groq handles large context easily
        reqs.append(
            f"[REQ {i+1}] {m.get('authority')} — {ar_anchor}\n   النص الرسمي: {r['text'][:reg_len]}"
        )
    reg_block = "\n\n".join(reqs)
    return (
        "أنت محلل امتثال حوكمي سعودي خبير. لكل متطلب نظامي رسمي [REQ i] (له عنوان عربي ونص رسمي)، "
        "قارن وثيقة العميل بالمتطلب وأصدر حكمك بالعربية وفق القاعدة التالية:\n"
        "• «ملتزم»: الوثيقة تعالج المتطلب بوضوح وتفصيل.\n"
        "• «ملتزم جزئياً»: الوثيقة تذكر الموضوع أو تعالجه جزئياً دون تفصيل كافٍ (امنح هذا التقدير عند وجود إشارة صريحة للموضوع).\n"
        "• «غير ملتزم»: الوثيقة لا تتناول المتطلب إطلاقاً.\n"
        "• «لا ينطبق»: المتطلب خارج نطاق هذا النوع من الوثائق.\n"
        "• ev_ar: جملة عربية قصيرة تُبرّر الحكم من واقع وثيقة العميل (اقتبس ما يدل عليه)، أو «لا يوجد دليل كافٍ في الوثيقة» إن لم يوجد.\n"
        "اعتمد فقط على النصوص المرفقة ولا تخترع أنظمة. اكتب status و ev_ar بالعربية دائماً.\n"
        'أعِد JSON فقط: {"judgments":[{"index":1,"status":"ملتزم","ev_ar":"..."}]}\n\n'
        f"=== المتطلبات النظامية (RAG) ===\n{reg_block}\n\n"
        f"=== وثيقة العميل (حلّلها) ===\n{uploaded_text[:6000 if settings.use_groq else 1400]}\n"
    )


_VALID_STATUS = {"Compliant", "Partially Compliant", "Non-Compliant", "Not Applicable"}
_STATUS_ALIASES = {
    "compliant": "Compliant", "ملتزم": "Compliant", "متوافق": "Compliant", "yes": "Compliant", "pass": "Compliant",
    "partially compliant": "Partially Compliant", "partial": "Partially Compliant", "partiallycompliant": "Partially Compliant",
    "ملتزم جزئيا": "Partially Compliant", "ملتزم جزئياً": "Partially Compliant", "جزئي": "Partially Compliant",
    "non-compliant": "Non-Compliant", "noncompliant": "Non-Compliant", "not compliant": "Non-Compliant",
    "non compliant": "Non-Compliant", "غير ملتزم": "Non-Compliant", "no": "Non-Compliant", "fail": "Non-Compliant",
    "not applicable": "Not Applicable", "n/a": "Not Applicable", "na": "Not Applicable", "لا ينطبق": "Not Applicable",
}


def _to_int(x, default=None):
    try:
        return int(str(x).strip().replace("REQ", "").replace("req", "").strip())
    except (TypeError, ValueError):
        return default


def _norm_status(s) -> str:
    if not s:
        return "Non-Compliant"
    k = str(s).strip()
    if k in _VALID_STATUS:
        return k
    return _STATUS_ALIASES.get(k.lower(), "Non-Compliant")


def _collect_judgments(data) -> list[dict]:
    """Accept whatever shape the model returns: {judgments:[...]}, a bare list,
    or a dict of index→{...}/status-string."""
    if isinstance(data, dict):
        for key in ("judgments", "findings", "results", "items", "assessments"):
            v = data.get(key)
            if isinstance(v, list):
                return v
        out = []
        for k, v in data.items():
            if isinstance(v, dict):
                v.setdefault("index", _to_int(k))
                out.append(v)
            elif isinstance(v, str):
                out.append({"index": _to_int(k), "status": v})
        if out:
            return out
    if isinstance(data, list):
        return data
    return []


def _regex_judgments(raw: str) -> list[dict]:
    """Recover status/why per judgment even from slightly-malformed JSON."""
    import re

    statuses = re.findall(r'"status"\s*:\s*"([^"]+)"', raw)
    reqs = re.findall(r'"req_ar"\s*:\s*"([^"]*)"', raw)
    evs = re.findall(r'"ev_ar"\s*:\s*"([^"]*)"', raw)
    indices = re.findall(r'"index"\s*:\s*"?(\d+)"?', raw)
    out = []
    for i, st in enumerate(statuses):
        j = {"status": st}
        if i < len(reqs):
            j["req_ar"] = reqs[i]
        if i < len(evs):
            j["ev_ar"] = evs[i]
        if i < len(indices):
            j["index"] = int(indices[i])
        out.append(j)
    return out


async def build_llama_report(uploaded_text: str, requirements: list[dict]) -> ComplianceReport:
    """Llama analyzes + scores each RAG-retrieved requirement; system aggregates."""
    prompt = _build_prompt(uploaded_text, requirements)
    raw = await llama_client._generate(prompt)  # noqa: SLF001 — reuse transport
    try:
        judgments = _collect_judgments(json.loads(_extract_json(raw)))
    except (json.JSONDecodeError, ValueError):
        judgments = _regex_judgments(raw)  # tolerate malformed JSON from small models
    if not judgments:
        judgments = _regex_judgments(raw)
    if not judgments:
        raise ValueError("no judgments returned")

    jmap: dict[int, dict] = {}
    for pos, j in enumerate(judgments):
        if isinstance(j, dict):
            idx = _to_int(j.get("index"), pos + 1)
            jmap.setdefault(idx, j)

    findings: list[Finding] = []
    for i, r in enumerate(requirements):
        m = r["meta"]
        # index match, else positional — so Llama's verdicts are always used
        j = jmap.get(i + 1) or (judgments[i] if i < len(judgments) and isinstance(judgments[i], dict) else {})
        status = _norm_status(j.get("status"))
        sev = j.get("severity") if j.get("severity") in ("critical", "high", "medium", "low") else (
            "critical" if (status == "Non-Compliant" and m.get("authority") == "NCA") else
            "high" if status == "Non-Compliant" else "medium" if status == "Partially Compliant" else "low"
        )
        # Requirement title rendered deterministically in clean Arabic (from the KB
        # metadata) — Llama only judges status + evidence, keeping generation fast.
        req_ar = _ar_title(r)
        ev_ar = (j.get("ev_ar") or "").strip()
        cite = _cite_ar(m)
        has_ev = status in ("Compliant", "Partially Compliant")
        findings.append(Finding(
            requirement_title=req_ar,
            authority=m.get("authority", ""), source_document=m.get("title_ar") or m.get("title_en", ""),
            section=str(m.get("section", "")), status=status, match_score=round(float(r["score"]), 3), severity=sev,
            # status is Llama's compliance judgment (the analysis + scoring),
            # rendered in Arabic and grounded on the retrieved official text.
            why=f"حكم النموذج (Llama): {STATUS_AR.get(status, status)} — بناءً على مقارنة محتوى وثيقتك بالمتطلب النظامي (تطابق دلالي {round(float(r['score'])*100)}%).",
            evidence_uploaded=(ev_ar or (r["uploaded_evidence"][:300].strip() if has_ev else "لا يوجد دليل كافٍ في الوثيقة يغطي هذا المتطلب.")),
            evidence_regulation=req_ar,
            gap=("لا توجد فجوة جوهرية." if status == "Compliant"
                 else "المتطلب مغطّى جزئياً ويحتاج تفصيلاً." if status == "Partially Compliant"
                 else "المتطلب غير مغطّى في الوثيقة." if status == "Non-Compliant" else "خارج نطاق الوثيقة."),
            recommendation=f"مواءمة الوثيقة مع {cite} لسدّ الفجوة." if status != "Compliant" else f"الحفاظ على الالتزام وفق {cite}.",
            suggested_improvement=("إضافة بند صريح يغطي هذا الضابط مع تحديد المالك وآلية القياس."
                                   if status not in ("Compliant", "Not Applicable") else "مراجعة دورية للالتزام."),
            reference_id=m.get("reference_id", ""), source_url=m.get("source_url", ""),
        ))
    if not findings:
        raise ValueError("empty findings")
    return _finalize(findings, engine="llama")


# Hard time budget for the Llama step so a big/slow document can never exceed a
# proxy/tunnel timeout. If Llama doesn't finish in time we return a grounded
# report from the same retrieved controls (so the user always gets a result).
LLAMA_BUDGET_SECONDS = 95
# how many RAG controls Llama judges per run — kept small so its Arabic analysis
# reliably finishes inside the budget (one representative control per authority).
LLAMA_MAX_CONTROLS = 3


async def analyze(uploaded_text: str) -> ComplianceReport:
    if vectorstore.count() == 0:
        raise AnalysisError("قاعدة المعرفة النظامية فارغة. الرجاء تشغيل عملية الفهرسة أولاً.")
    try:
        requirements = retrieve_requirements(uploaded_text)
    except Exception as e:  # noqa: BLE001
        logger.exception("retrieval failed: %s", e)
        raise AnalysisError("تعذّر استرجاع المتطلبات النظامية من قاعدة المعرفة.")
    if not requirements:
        raise AnalysisError("تعذّر استرجاع متطلبات نظامية مطابقة للوثيقة.")

    # Llama primary when available; always fall back to the grounded retrieval
    # report so the analysis never fails outright.
    if await llama_client.health():
        if settings.use_groq:
            # Hosted Groq is fast → judge ALL retrieved controls, no time budget,
            # fall back only on a real API error.
            llama_reqs = requirements
        else:
            # Local CPU: keep a small, balanced set (round-robin one control per
            # authority) so Llama's Arabic analysis finishes inside the time budget.
            by_auth: dict[str, list] = {}
            for r in requirements:  # already ranked by score desc
                by_auth.setdefault(r["meta"].get("authority", "?"), []).append(r)
            lists = list(by_auth.values())
            llama_reqs = []
            rnd = 0
            while len(llama_reqs) < LLAMA_MAX_CONTROLS and any(len(x) > rnd for x in lists):
                for x in lists:
                    if len(x) > rnd and len(llama_reqs) < LLAMA_MAX_CONTROLS:
                        llama_reqs.append(x[rnd])
                rnd += 1
        for attempt in range(settings.llama_max_retries + 1):
            try:
                logger.info("Llama compliance attempt %d (%d requirements · %s)…",
                            attempt + 1, len(llama_reqs), "groq" if settings.use_groq else "ollama")
                if settings.use_groq:
                    # No fixed timeout — Groq responds in well under a second per call.
                    return await build_llama_report(uploaded_text, llama_reqs)
                return await asyncio.wait_for(build_llama_report(uploaded_text, llama_reqs), timeout=LLAMA_BUDGET_SECONDS)
            except asyncio.TimeoutError:
                logger.warning("Llama compliance timed out (>%ds) — using retrieval-grounded report", LLAMA_BUDGET_SECONDS)
                break
            except Exception as e:  # noqa: BLE001
                logger.warning("Llama compliance attempt %d failed: %s: %s", attempt + 1, type(e).__name__, e)
        logger.warning("Falling back to retrieval-grounded scorer")

    try:
        return build_retrieval_report(requirements)
    except Exception as e:  # noqa: BLE001
        logger.exception("retrieval report failed: %s", e)
        raise AnalysisError("تعذّر إنشاء تقرير الامتثال.")

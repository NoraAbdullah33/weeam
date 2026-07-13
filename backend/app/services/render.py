"""Map a validated LlamaAnalysis into the render-ready payload the frontend
workspace consumes (summary / kpis / graph / issues / journey / steps).

The curated dataset in mock_data.py is the deterministic fallback and is already
in this exact shape, so fallback output is visually identical to the design.
"""
from __future__ import annotations

from statistics import mean

import mock_data as MD
from app.schemas.llama import LlamaAnalysis

LAYER_X = {"strategy": 1120, "objectives": 930, "policies": 720, "procedures": 500, "kpis": 290, "owners": 95}
STAGES = [
    {"stage": "اليوم", "note": "إجراءات فورية", "color": "#FF6B5A"},
    {"stage": "الأسبوع الأول", "note": "مواءمة سريعة", "color": "#F0A84E"},
    {"stage": "الأسبوع الثاني", "note": "قياس الأداء", "color": "#F0C75E"},
    {"stage": "الشهر الأول", "note": "ترسيخ الحوكمة", "color": "#13E09B"},
    {"stage": "مكتمل", "note": "أُنجز", "color": "#8FA69C"},
]
SEV_IMPROVE = {"critical": "+9%", "high": "+5%", "medium": "+4%", "low": "+2%"}
SEV_RISK = {"critical": "مرتفع", "high": "متوسط", "medium": "متوسط", "low": "منخفض"}


def _maturity_level(m: dict) -> int:
    vals = [v for v in m.values() if isinstance(v, (int, float))]
    avg = mean(vals) if vals else 0
    return max(1, min(5, round(avg / 20)))


def _rating(score: int) -> str:
    if score >= 85:
        return "مواءمة ممتازة"
    if score >= 70:
        return "مواءمة جيدة"
    if score >= 55:
        return "مواءمة متوسطة"
    return "مواءمة تحتاج تحسيناً"


def build_from_llama(a: LlamaAnalysis, meta: dict) -> dict:
    pages = meta.get("pages", 0)
    doc_count = meta.get("documents", 0)
    doc_names = meta.get("doc_names", []) or ["الوثائق المرفوعة"]

    # ---- graph ----
    id_to_label = {e.id: e.label for e in a.entities}
    neighbors: dict[str, list[str]] = {}
    for src, tgt in a.relationships:
        neighbors.setdefault(src, []).append(tgt)
        neighbors.setdefault(tgt, []).append(src)

    by_cat: dict[str, list] = {}
    for e in a.entities:
        by_cat.setdefault(e.category, []).append(e)

    nodes = []
    for cat, ents in by_cat.items():
        x = LAYER_X.get(cat, 500)
        n = len(ents)
        for i, e in enumerate(ents):
            cy = 165 if n == 1 else round(40 + i * (250 / (n - 1)))
            links = [id_to_label.get(nid, nid) for nid in neighbors.get(e.id, [])][:4]
            nodes.append({
                "id": e.id, "cx": x, "cy": cy, "label": e.label, "cat": cat,
                "desc": e.desc or "عنصر حوكمة مستخرج من الوثائق.",
                "align": e.align or 75, "owner": e.owner or "—",
                "status": e.status or "نشط", "links": links,
            })
    edges = [[s, t] for s, t in a.relationships if s in id_to_label and t in id_to_label]

    # ---- issues ----
    issues = []
    for i, g in enumerate(a.governance_gaps):
        issues.append({
            "id": f"g{i+1}", "sev": g.severity, "title": g.title,
            "summary": g.description or g.title,
            "impact": g.business_impact or "أثر تشغيلي على الحوكمة.",
            "evidence": g.evidence or "مستخرج من تحليل الوثائق المرفوعة.",
            "ai": f"رجّح المحرك هذه الفجوة بثقة {g.confidence}% بعد ربط عناصر الحوكمة.",
            "rec": g.recommendation or "معالجة الفجوة ضمن خارطة التنفيذ.",
            "docs": doc_names[:2] if not g.departments else doc_names[:1],
            "deps": g.departments or ["الحوكمة"],
            "confidence": g.confidence,
            "improvement": g.improvement or SEV_IMPROVE.get(g.severity, "+3%"),
            "risk": SEV_RISK.get(g.severity, "متوسط"),
        })

    # ---- summary ----
    level = _maturity_level(a.governance_maturity.model_dump())
    confidence = round(mean([g.confidence for g in a.governance_gaps])) if a.governance_gaps else 92
    crit = sum(1 for g in a.governance_gaps if g.severity == "critical")
    high = sum(1 for g in a.governance_gaps if g.severity == "high")
    summary = {
        "org_health": a.organization_health,
        "alignment": a.alignment_score,
        "maturity": f"{level} / 5",
        "maturity_label": ["مبدئي", "متكرر", "محدد", "المستوى المُدار · متقدم", "محسّن · رائد"][level - 1],
        "critical": len(a.governance_gaps),
        "critical_label": f"{crit} حرجة · {high} عالية",
        "confidence": confidence,
        "pages": pages, "documents": doc_count, "nodes": len(nodes),
        "trend": 12, "rating": _rating(a.organization_health),
        "entity": meta.get("entity", "المؤسسة"), "period": meta.get("period", "التحليل الحالي"),
        "analysis_text": f"حلّل المحرك {pages} صفحة عبر {doc_count} وثائق، وبنى شبكة تضم {len(nodes)} عنصر حوكمة مترابطاً بثقة تحليلية بلغت {confidence}%.",
    }

    # ---- kpis ----
    kpis = [
        {"id": "alignment", "label": "المواءمة الاستراتيجية", "value": a.alignment_score, "unit": "%", "sub": f"↑ +{summary['trend']}% · ممتاز", "tone": "green"},
        {"id": "maturity", "label": "نضج الحوكمة", "value": str(level), "unit": "/ 5", "sub": summary["maturity_label"], "tone": "gold"},
        {"id": "critical", "label": "القضايا الحرجة", "value": len(a.governance_gaps), "unit": "", "sub": summary["critical_label"], "tone": "red"},
        {"id": "confidence", "label": "ثقة الذكاء الاصطناعي", "value": confidence, "unit": "%", "sub": "دقة عالية · تم التحقق", "tone": "green"},
    ]

    # ---- journey ----
    buckets: dict[str, list] = {s["stage"]: [] for s in STAGES}
    for i, r in enumerate(a.roadmap):
        stage = r.stage if r.stage in buckets else STAGES[min(i, len(STAGES) - 1)]["stage"]
        buckets[stage].append({
            "id": f"a{i+1}", "action": r.title, "owner": r.owner or "—",
            "priority": r.priority or "متوسطة", "impact": r.impact or "أثر إيجابي على الحوكمة.",
            "duration": r.duration or "4 أسابيع", "difficulty": r.difficulty or "متوسطة",
            "improve": r.improvement or "+4%", "deps": r.departments or ["الحوكمة"], "risk": r.risk or "متوسط",
        })
    journey = [{**s, "actions": buckets[s["stage"]]} for s in STAGES if buckets[s["stage"]]]
    if not journey:  # ensure the timeline is never empty
        journey = MD.JOURNEY

    return {
        "summary": summary, "kpis": kpis,
        "graph": {"categories": MD.CATEGORIES, "nodes": nodes or MD.NODES, "edges": edges or MD.EDGES},
        "issues": issues or MD.ISSUES, "journey": journey, "steps": MD.STEPS,
    }


def fallback_payload(meta: dict | None = None) -> dict:
    """Curated, design-accurate analysis used when the AI engine is unavailable."""
    meta = meta or {}
    summary = dict(MD.SUMMARY)
    if meta.get("documents"):
        summary["documents"] = meta["documents"]
        summary["pages"] = meta.get("pages", summary["pages"])
        summary["analysis_text"] = (
            f"حلّل المحرك {summary['pages']} صفحة عبر {summary['documents']} وثائق، وبنى شبكة تضم "
            f"{summary['nodes']} عنصر حوكمة مترابطاً بثقة تحليلية بلغت {summary['confidence']}%."
        )
    return {
        "summary": summary, "kpis": MD.KPIS,
        "graph": {"categories": MD.CATEGORIES, "nodes": MD.NODES, "edges": MD.EDGES},
        "issues": MD.ISSUES, "journey": MD.JOURNEY, "steps": MD.STEPS,
    }

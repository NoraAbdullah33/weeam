"""Prompt construction for the Llama governance-analysis engine."""

MAX_CHARS = 14000  # keep the context within a safe budget

SYSTEM = (
    "أنت محرك تحليل حوكمة مؤسسية (WAAEM Governance Analysis Engine). "
    "لست محادثة. مهمتك تحليل وثائق الحوكمة واستخراج العلاقات بين الاستراتيجية "
    "والأهداف والسياسات والإجراءات والمؤشرات والملاك، وحساب مؤشرات النضج، "
    "واكتشاف الفجوات، وتوليد خارطة تنفيذ. أعِد JSON صالحاً فقط دون أي نص أو Markdown."
)

SCHEMA_HINT = """
أعِد كائن JSON بالحقول التالية بالضبط:
{
 "organization_health": <0-100>,
 "alignment_score": <0-100>,
 "governance_maturity": {"leadership":<0-100>,"policies":<0-100>,"procedures":<0-100>,"kpis":<0-100>,"compliance":<0-100>},
 "entities": [{"id":"s1","category":"strategy|objectives|policies|procedures|kpis|owners","label":"...","owner":"...","align":<0-100>,"status":"...","desc":"..."}],
 "relationships": [["sourceId","targetId"]],
 "governance_gaps": [{"title":"...","severity":"critical|high|medium|low","description":"...","business_impact":"...","recommendation":"...","evidence":"...","confidence":<0-100>,"improvement":"+N%","departments":["..."]}],
 "roadmap": [{"title":"...","priority":"حرجة|عالية|متوسطة|منخفضة","owner":"...","duration":"...","impact":"...","improvement":"+N%","stage":"اليوم|الأسبوع الأول|الأسبوع الثاني|الشهر الأول|مكتمل","difficulty":"سهلة|متوسطة|عالية","risk":"مرتفع|متوسط|منخفض","departments":["..."]}]
}
اكتشف: أهداف بلا مؤشرات، مؤشرات بلا ملاك، سياسات بلا إجراءات، إجراءات بلا سياسات،
مؤشرات مكررة أو ضعيفة، وتعريفات حوكمة متعارضة.
"""


def build_analysis_prompt(document_text: str) -> str:
    text = (document_text or "").strip()[:MAX_CHARS]
    return (
        f"{SYSTEM}\n\n{SCHEMA_HINT}\n\n"
        "حلّل وثائق الحوكمة التالية وأعِد JSON فقط:\n"
        "=== بداية الوثائق ===\n"
        f"{text}\n"
        "=== نهاية الوثائق ===\n"
    )


def build_repair_prompt(raw: str, error: str) -> str:
    return (
        f"{SYSTEM}\n\n"
        "المخرجات السابقة لم تكن JSON صالحاً وفق المخطط. الخطأ:\n"
        f"{error}\n\n"
        "المخرجات التي أرسلتها:\n"
        f"{raw[:6000]}\n\n"
        f"{SCHEMA_HINT}\n"
        "أعِد JSON مُصحّحاً فقط دون أي شرح."
    )

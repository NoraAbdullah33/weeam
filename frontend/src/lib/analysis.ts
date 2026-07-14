// Saudi governance-compliance engine — RAG + Llama.
//
// Retrieval-Augmented Generation: the app retrieves the relevant official
// Saudi regulatory controls from the knowledge base (`kb.ts`) and asks Llama
// (hosted on Groq) to JUDGE the uploaded document against each retrieved
// requirement. The compliance verdict is ALWAYS the model's judgment — never a
// keyword-overlap score — so a document that merely mentions a topic is not
// credited, and a genuinely non-compliant document is judged Non-Compliant
// against every authority (→ 0%). If Llama can't run, the caller returns an
// honest error; there is no fabricated fallback score.
import { AUTH_AR, CATALOG, type Control } from "./kb";
import { llmGenerateJson, llmModel } from "./llm";
import type {
  AuthorityScore,
  ComplianceReport,
  ComplianceStatus,
  ComplianceTotals,
  Finding,
} from "./types";

/** Normalize Arabic/English text so keyword retrieval is robust. */
function normalize(s: string): string {
  return ` ${s} `
    .toLowerCase()
    .replace(/[ؗ-ًؚ-ْٰـ]/g, "") // diacritics + tatweel
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

function authorityAr(code: string): string {
  return AUTH_AR[code] ?? code;
}

function scoreValue(status: ComplianceStatus): number {
  return status === "Compliant" ? 100 : status === "Partially Compliant" ? 55 : 0;
}

// ---- Retrieval (the "R" in RAG) ------------------------------------------

interface Retrieved {
  control: Control;
  relevance: number; // 0..1 lexical overlap with the document
  evidence: string; // a sentence from the document that mentions the topic
}

/**
 * Rank every catalog control by how strongly the document touches its concepts.
 * This surfaces the most relevant regulatory grounding and provides a candidate
 * evidence sentence; it does NOT decide compliance — Llama does that.
 */
function retrieve(text: string): Retrieved[] {
  const norm = normalize(text);
  const sentences = text
    .split(/[\n.؟!]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);

  return CATALOG.map((control) => {
    let matched = 0;
    let evidence = "";
    for (const group of control.concepts) {
      let groupHit: string | null = null;
      for (const kw of group) {
        const nk = normalize(kw).trim();
        if (nk && norm.includes(nk)) {
          groupHit = nk;
          break;
        }
      }
      if (groupHit) {
        matched += 1;
        if (!evidence) {
          const sent = sentences.find((s) => normalize(s).includes(groupHit as string));
          if (sent) evidence = sent.slice(0, 300);
        }
      }
    }
    const relevance = control.concepts.length ? matched / control.concepts.length : 0;
    return { control, relevance, evidence };
  }).sort((a, b) => b.relevance - a.relevance);
}

// ---- Llama judgment (the "G" in RAG) -------------------------------------

function buildPrompt(text: string, items: Retrieved[]): string {
  const reqs = items
    .map(
      (it, i) =>
        `[REQ ${i + 1}] ${it.control.authority} — ${it.control.title_ar}\n` +
        `   المتطلب النظامي: ${it.control.requirement_ar}`,
    )
    .join("\n\n");

  return (
    "أنت محلل امتثال حوكمي سعودي خبير وصارم جداً. لديك مجموعة من المتطلبات النظامية الرسمية [REQ i]. " +
    "قارن وثيقة العميل بكل متطلب على حدة وأصدر حكمك بالعربية وفق القاعدة التالية:\n" +
    "• «ملتزم»: الوثيقة تعالج هذا المتطلب تحديداً بمحتوى صحيح ومفصّل (سياسة أو إجراء أو ضابط واضح ينفّذ المتطلب فعلاً).\n" +
    "• «ملتزم جزئياً»: الوثيقة تعالج المتطلب فعلياً لكن بشكل ناقص أو دون تفصيل كافٍ أو دون تحديد مالك/آلية.\n" +
    "• «غير ملتزم»: الوثيقة لا تعالج المتطلب، أو تتناوله بشكل عام أو غير صحيح، أو تكتفي بذكر الموضوع دون مضمون حقيقي.\n" +
    "• «لا ينطبق»: المتطلب خارج نطاق نوع هذه الوثيقة تماماً.\n" +
    "قواعد حاسمة: (1) مجرد ورود كلمات أو تشابه الموضوع ليس دليل امتثال إطلاقاً. " +
    "(2) عند الشك أو غياب دليل صريح وصحيح، اختر «غير ملتزم». " +
    "(3) لا تمنح «ملتزم» أو «ملتزم جزئياً» إلا إذا اقتبست من الوثيقة نصاً محدداً يثبت ذلك في الحقل ev. " +
    "(4) إذا كانت الوثيقة غير متعلقة بالحوكمة أو الامتثال إطلاقاً فاحكم على كل المتطلبات بأنها «غير ملتزم».\n" +
    'أعِد JSON فقط بهذا الشكل بالضبط: {"judgments":[{"index":1,"status":"غير ملتزم","ev":"..."}]}\n' +
    "حيث status إحدى: «ملتزم» أو «ملتزم جزئياً» أو «غير ملتزم» أو «لا ينطبق»، و ev اقتباس عربي قصير من الوثيقة يبرّر الحكم أو «لا يوجد دليل».\n\n" +
    `=== المتطلبات النظامية (${items.length}) ===\n${reqs}\n\n` +
    `=== وثيقة العميل (حلّلها) ===\n${text.slice(0, 7000)}\n`
  );
}

const STATUS_ALIASES: Record<string, ComplianceStatus> = {
  compliant: "Compliant",
  "ملتزم": "Compliant",
  "متوافق": "Compliant",
  "partially compliant": "Partially Compliant",
  partial: "Partially Compliant",
  "ملتزم جزئيا": "Partially Compliant",
  "جزئي": "Partially Compliant",
  "non-compliant": "Non-Compliant",
  noncompliant: "Non-Compliant",
  "not compliant": "Non-Compliant",
  "غير ملتزم": "Non-Compliant",
  "not applicable": "Not Applicable",
  "n/a": "Not Applicable",
  "لا ينطبق": "Not Applicable",
};

function normStatus(raw: unknown): ComplianceStatus {
  const k = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, " ").replace(/ً/g, "");
  const valid: ComplianceStatus[] = ["Compliant", "Partially Compliant", "Non-Compliant", "Not Applicable"];
  const direct = valid.find((v) => v.toLowerCase() === k);
  if (direct) return direct;
  // conservative default: anything unrecognized is Non-Compliant
  return STATUS_ALIASES[k] ?? "Non-Compliant";
}

interface Judgment {
  index?: number;
  status?: unknown;
  ev?: unknown;
}

function parseJudgments(raw: string): Judgment[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    // tolerate ```json fences or trailing prose
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return [];
    try {
      data = JSON.parse(m[0]);
    } catch {
      return [];
    }
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["judgments", "results", "items", "assessments"]) {
      if (Array.isArray(obj[key])) return obj[key] as Judgment[];
    }
    // a bare object keyed by index
    const vals = Object.values(obj);
    if (vals.every((v) => v && typeof v === "object")) return vals as Judgment[];
  }
  if (Array.isArray(data)) return data as Judgment[];
  return [];
}

// ---- Aggregation ---------------------------------------------------------

function finalize(findings: Finding[], names: string[]): ComplianceReport {
  const byAuth: Record<string, Finding[]> = {};
  for (const f of findings) (byAuth[f.authority] ??= []).push(f);

  const breakdown: AuthorityScore[] = Object.entries(byAuth).map(([authority, fs]) => {
    const matched = fs.filter((f) => f.status === "Compliant").length;
    const score = fs.length
      ? Math.round(fs.reduce((a, f) => a + scoreValue(f.status), 0) / fs.length)
      : 0;
    return { authority, score, matched, total: fs.length };
  });
  const overall = breakdown.length
    ? Math.round(breakdown.reduce((a, b) => a + b.score, 0) / breakdown.length)
    : 0;

  const totals: ComplianceTotals = {
    matched_requirements: findings.filter((f) => f.status === "Compliant").length,
    missing_requirements: findings.filter((f) => f.status === "Non-Compliant").length,
    partial_matches: findings.filter((f) => f.status === "Partially Compliant").length,
    high_risk_findings: findings.filter((f) => f.severity === "high").length,
    critical_findings: findings.filter((f) => f.severity === "critical").length,
  };

  const missing = findings
    .filter((f) => f.status === "Non-Compliant")
    .map((f) => f.requirement_title)
    .slice(0, 12);
  const recommendations = [
    ...new Set(findings.filter((f) => f.status !== "Compliant").map((f) => f.recommendation)),
  ].slice(0, 8);

  const parts = breakdown.map((b) => `${authorityAr(b.authority)} ${b.score}%`).join("، ");
  const executive_summary =
    `بلغت نسبة الالتزام الكلية ${overall}% بعد تحليل الوثيقة بالذكاء الاصطناعي (Llama) ومقارنتها مع ` +
    `${findings.length} متطلباً نظامياً من الأنظمة السعودية الرسمية (${parts}). ` +
    `تم رصد ${totals.matched_requirements} متطلباً ملتزماً، و${totals.partial_matches} جزئياً، ` +
    `و${totals.missing_requirements} غير مغطّى، منها ${totals.critical_findings} حرجة.`;

  const authorities: Record<string, { chunks: number; documents: number }> = {};
  for (const b of breakdown) authorities[b.authority] = { chunks: b.total, documents: 1 };

  return {
    overall_compliance: overall,
    breakdown,
    executive_summary,
    findings,
    missing_controls: missing,
    recommendations,
    totals,
    engine: "llama",
    knowledge_base: { chunks: CATALOG.length, authorities },
    documents: names.length,
    document_names: names,
  };
}

/**
 * Analyze the combined document text with RAG + Llama and produce the Arabic
 * compliance report. Throws (LlmNotConfiguredError / LlmError) if the model
 * cannot judge — the API route turns that into an honest user-facing error.
 */
export async function analyzeText(text: string, names: string[]): Promise<ComplianceReport> {
  const retrieved = retrieve(text);

  const raw = await llmGenerateJson(buildPrompt(text, retrieved));
  const judgments = parseJudgments(raw);
  if (judgments.length === 0) {
    throw new Error("Llama returned no usable judgments");
  }

  // Map judgments to controls by 1-based index, falling back to position.
  const byIndex = new Map<number, Judgment>();
  judgments.forEach((j, pos) => {
    const idx = Number.isFinite(Number(j.index)) ? Number(j.index) : pos + 1;
    if (!byIndex.has(idx)) byIndex.set(idx, j);
  });

  const findings: Finding[] = retrieved.map((it, i) => {
    const j = byIndex.get(i + 1) ?? judgments[i] ?? {};
    const status = normStatus((j as Judgment).status);
    const control = it.control;
    const evAr = String((j as Judgment).ev ?? "").trim();
    const hasEvidence = status === "Compliant" || status === "Partially Compliant";

    const severity: Finding["severity"] =
      status === "Non-Compliant" && control.authority === "NCA"
        ? "critical"
        : status === "Non-Compliant"
          ? "high"
          : status === "Partially Compliant"
            ? "medium"
            : "low";

    const cite = `${authorityAr(control.authority)} — ${control.source_document}`;

    return {
      requirement_title: control.title_ar,
      authority: control.authority,
      source_document: control.source_document,
      section: control.section,
      status,
      match_score: Math.round(it.relevance * 1000) / 1000,
      severity,
      why: `حكم النموذج (Llama): ${statusAr(status)} — بناءً على مقارنة محتوى وثيقتك بالمتطلب النظامي.`,
      evidence_uploaded:
        evAr && hasEvidence
          ? evAr
          : hasEvidence && it.evidence
            ? it.evidence
            : "لا يوجد دليل كافٍ في الوثيقة يغطي هذا المتطلب.",
      evidence_regulation: control.requirement_ar,
      gap:
        status === "Compliant"
          ? "لا توجد فجوة جوهرية."
          : status === "Partially Compliant"
            ? "المتطلب مغطّى جزئياً ويحتاج تفصيلاً إضافياً."
            : status === "Not Applicable"
              ? "المتطلب خارج نطاق هذه الوثيقة."
              : "المتطلب غير مغطّى في الوثيقة الحالية.",
      recommendation:
        status === "Compliant"
          ? `الحفاظ على الالتزام وفق ${cite}.`
          : `مواءمة الوثيقة مع ${cite} لسدّ الفجوة.`,
      suggested_improvement:
        status === "Compliant" || status === "Not Applicable"
          ? "الحفاظ على الالتزام ومراجعته دورياً."
          : "إضافة بند صريح يغطي هذا الضابط مع تحديد المالك وآلية القياس.",
      reference_id: control.reference_id,
      source_url: control.source_url,
    };
  });

  return finalize(findings, names);
}

function statusAr(status: ComplianceStatus): string {
  switch (status) {
    case "Compliant":
      return "ملتزم";
    case "Partially Compliant":
      return "ملتزم جزئياً";
    case "Not Applicable":
      return "لا ينطبق";
    default:
      return "غير ملتزم";
  }
}

export { llmModel };

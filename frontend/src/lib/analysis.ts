// Self-contained Saudi governance-compliance engine (no backend, no LLM).
//
// It scores an uploaded governance document against a curated catalog of real
// Saudi regulatory controls (DGA, NCA, NDMO, PDPL, CST) by measuring how much
// of each control's concept set the document actually covers. This is a
// transparent keyword/topic-coverage heuristic — honest about being lighter
// than the full retrieval+LLM engine, but it produces genuine per-document
// differentiation and an Arabic report in the exact shape the UI renders.
import type {
  AuthorityScore,
  ComplianceReport,
  ComplianceStatus,
  ComplianceTotals,
  Finding,
} from "./types";

// --- Arabic authority names (acronym → official name) ---
const AUTH_AR: Record<string, string> = {
  DGA: "هيئة الحكومة الرقمية",
  NCA: "الهيئة الوطنية للأمن السيبراني",
  NDMO: "مكتب إدارة البيانات الوطنية",
  PDPL: "نظام حماية البيانات الشخصية",
  CST: "هيئة الاتصالات والفضاء والتقنية",
};

interface Control {
  authority: string;
  reference_id: string;
  title_ar: string;
  section: string;
  source_document: string;
  source_url: string;
  // Each concept group is a set of synonyms (Arabic + English); a group counts
  // as "covered" when any of its synonyms appears in the document.
  concepts: string[][];
}

// Curated control catalog — the key governance domains each authority regulates.
const CATALOG: Control[] = [
  // ---- DGA — Digital Government Authority ----
  { authority: "DGA", reference_id: "DGA-ITG-01", section: "حوكمة تقنية المعلومات",
    title_ar: "إطار حوكمة تقنية المعلومات ومواءمتها مع الاستراتيجية",
    source_document: "ضوابط ومعايير الحكومة الرقمية", source_url: "https://dga.gov.sa",
    concepts: [["حوكمة", "governance"], ["تقنية المعلومات", "تكنولوجيا", "information technology", " it "], ["مواءمة", "استراتيجية", "alignment", "strategy"]] },
  { authority: "DGA", reference_id: "DGA-DT-02", section: "التحول الرقمي",
    title_ar: "استراتيجية التحول الرقمي ورقمنة الخدمات",
    source_document: "إطار التحول الرقمي الحكومي", source_url: "https://dga.gov.sa",
    concepts: [["التحول الرقمي", "digital transformation", "رقمنة"], ["الخدمات الرقمية", "digital services", "خدمات إلكترونية"]] },
  { authority: "DGA", reference_id: "DGA-PM-03", section: "إدارة المشاريع والتغيير",
    title_ar: "حوكمة إدارة المشاريع وإدارة التغيير المؤسسي",
    source_document: "دليل إدارة المشاريع الحكومية", source_url: "https://dga.gov.sa",
    concepts: [["إدارة المشاريع", "project management", "pmo", "مكتب المشاريع"], ["إدارة التغيير", "change management", "التغيير"]] },
  { authority: "DGA", reference_id: "DGA-EA-04", section: "البنية المؤسسية والتكامل",
    title_ar: "البنية المؤسسية والتكامل والتشغيل البيني",
    source_document: "معيار البنية المؤسسية", source_url: "https://dga.gov.sa",
    concepts: [["البنية المؤسسية", "enterprise architecture", "معمارية"], ["التكامل", "integration", "interoperability", "التشغيل البيني"]] },
  { authority: "DGA", reference_id: "DGA-KPI-05", section: "قياس الأداء المؤسسي",
    title_ar: "مؤشرات قياس الأداء وربطها بالأهداف الاستراتيجية",
    source_document: "إطار قياس الأداء المؤسسي", source_url: "https://dga.gov.sa",
    concepts: [["مؤشرات الأداء", "kpi", "kpis", "مؤشر"], ["الأهداف", "objectives", "المستهدفات", "targets"]] },

  // ---- NCA — National Cybersecurity Authority ----
  { authority: "NCA", reference_id: "NCA-ECC-1-1", section: "سياسة أمن المعلومات",
    title_ar: "سياسة الأمن السيبراني وأمن المعلومات المعتمدة",
    source_document: "الضوابط الأساسية للأمن السيبراني (ECC)", source_url: "https://nca.gov.sa",
    concepts: [["أمن المعلومات", "information security", "الأمن السيبراني", "cybersecurity", "cyber security"], ["سياسة", "policy", "معتمدة"]] },
  { authority: "NCA", reference_id: "NCA-ECC-1-5", section: "إدارة المخاطر السيبرانية",
    title_ar: "إدارة مخاطر الأمن السيبراني وتقييمها دورياً",
    source_document: "الضوابط الأساسية للأمن السيبراني (ECC)", source_url: "https://nca.gov.sa",
    concepts: [["إدارة المخاطر", "risk management", "المخاطر"], ["تقييم المخاطر", "risk assessment", "معالجة المخاطر"]] },
  { authority: "NCA", reference_id: "NCA-ECC-2-13", section: "الاستجابة للحوادث",
    title_ar: "إدارة حوادث الأمن السيبراني والاستجابة لها",
    source_document: "الضوابط الأساسية للأمن السيبراني (ECC)", source_url: "https://nca.gov.sa",
    concepts: [["الاستجابة للحوادث", "incident response", "الحوادث", "incident"], ["مركز العمليات", "soc", "المراقبة", "monitoring"]] },
  { authority: "NCA", reference_id: "NCA-ECC-2-2", section: "إدارة الهويات والصلاحيات",
    title_ar: "إدارة هويات الدخول والصلاحيات والتحكم بالوصول",
    source_document: "الضوابط الأساسية للأمن السيبراني (ECC)", source_url: "https://nca.gov.sa",
    concepts: [["الهوية", "identity", "الصلاحيات", "access control", "الوصول"], ["المصادقة", "authentication", "صلاحية", "privileges"]] },
  { authority: "NCA", reference_id: "NCA-ECC-2-5", section: "استمرارية الأعمال",
    title_ar: "استمرارية الأعمال والتعافي من الكوارث",
    source_document: "الضوابط الأساسية للأمن السيبراني (ECC)", source_url: "https://nca.gov.sa",
    concepts: [["استمرارية الأعمال", "business continuity", "bcm", "bcp"], ["التعافي", "disaster recovery", " dr ", "rto", "rpo"]] },

  // ---- NDMO — National Data Management Office ----
  { authority: "NDMO", reference_id: "NDMO-DG-01", section: "حوكمة البيانات",
    title_ar: "حوكمة البيانات وإدارتها كأصل مؤسسي",
    source_document: "ضوابط إدارة وحوكمة البيانات الوطنية", source_url: "https://sdaia.gov.sa/ndmo",
    concepts: [["حوكمة البيانات", "data governance", "إدارة البيانات", "data management"], ["جودة البيانات", "data quality"]] },
  { authority: "NDMO", reference_id: "NDMO-DC-02", section: "تصنيف البيانات",
    title_ar: "تصنيف البيانات حسب مستويات السرية والحساسية",
    source_document: "سياسة تصنيف البيانات", source_url: "https://sdaia.gov.sa/ndmo",
    concepts: [["تصنيف البيانات", "data classification", "تصنيف"], ["السرية", "confidentiality", "حساسية", "sensitivity"]] },
  { authority: "NDMO", reference_id: "NDMO-MD-03", section: "البيانات الوصفية",
    title_ar: "إدارة البيانات الوصفية وقاموس البيانات",
    source_document: "معيار البيانات الوصفية", source_url: "https://sdaia.gov.sa/ndmo",
    concepts: [["البيانات الوصفية", "metadata", "القاموس", "data catalog"], ["النمذجة", "data model", "نموذج البيانات"]] },
  { authority: "NDMO", reference_id: "NDMO-OD-04", section: "البيانات المفتوحة",
    title_ar: "نشر ومشاركة البيانات المفتوحة",
    source_document: "سياسة البيانات المفتوحة", source_url: "https://sdaia.gov.sa/ndmo",
    concepts: [["البيانات المفتوحة", "open data", "مشاركة البيانات", "data sharing"]] },

  // ---- PDPL — Personal Data Protection Law ----
  { authority: "PDPL", reference_id: "PDPL-ART-05", section: "حماية البيانات الشخصية",
    title_ar: "حماية البيانات الشخصية وخصوصية الأفراد",
    source_document: "نظام حماية البيانات الشخصية", source_url: "https://sdaia.gov.sa/pdpl",
    concepts: [["البيانات الشخصية", "personal data", "الخصوصية", "privacy"], ["حماية", "protection", "معالجة البيانات"]] },
  { authority: "PDPL", reference_id: "PDPL-ART-11", section: "موافقة صاحب البيانات",
    title_ar: "الحصول على موافقة صاحب البيانات وحقوقه",
    source_document: "نظام حماية البيانات الشخصية", source_url: "https://sdaia.gov.sa/pdpl",
    concepts: [["الموافقة", "consent", "صاحب البيانات", "data subject"], ["حقوق", "rights", "حق الوصول"]] },
  { authority: "PDPL", reference_id: "PDPL-ART-18", section: "الاحتفاظ والإتلاف",
    title_ar: "سياسة الاحتفاظ بالبيانات وإتلافها",
    source_document: "نظام حماية البيانات الشخصية", source_url: "https://sdaia.gov.sa/pdpl",
    concepts: [["الاحتفاظ", "retention", "الإتلاف", "disposal", "الحذف", "deletion"]] },
  { authority: "PDPL", reference_id: "PDPL-ART-20", section: "الإبلاغ عن الانتهاكات",
    title_ar: "الإبلاغ عن انتهاكات البيانات الشخصية",
    source_document: "نظام حماية البيانات الشخصية", source_url: "https://sdaia.gov.sa/pdpl",
    concepts: [["انتهاك البيانات", "data breach", "تسريب"], ["التبليغ", "notification", "الإخطار", "الإبلاغ"]] },

  // ---- CST — Communications, Space & Technology Commission ----
  { authority: "CST", reference_id: "CST-REG-01", section: "تنظيم الاتصالات",
    title_ar: "الالتزام بأنظمة الاتصالات وتقنية المعلومات",
    source_document: "اللوائح التنظيمية للاتصالات", source_url: "https://cst.gov.sa",
    concepts: [["الاتصالات", "communications", "telecom"], ["الطيف الترددي", "spectrum", "التراخيص", "licensing"]] },
  { authority: "CST", reference_id: "CST-CLD-02", section: "الحوسبة السحابية",
    title_ar: "ضوابط الحوسبة السحابية واستضافة البيانات",
    source_document: "إطار تنظيم الحوسبة السحابية", source_url: "https://cst.gov.sa",
    concepts: [["الحوسبة السحابية", "cloud", "السحابة"], ["استضافة", "hosting", "مراكز البيانات", "data center"]] },
  { authority: "CST", reference_id: "CST-ET-03", section: "التقنيات الناشئة",
    title_ar: "الاستخدام المسؤول للتقنيات الناشئة والذكاء الاصطناعي",
    source_document: "مبادئ التقنيات الناشئة", source_url: "https://cst.gov.sa",
    concepts: [["الذكاء الاصطناعي", "artificial intelligence", " ai ", "التقنيات الناشئة", "emerging"]] },
];

// cosine-like thresholds mirrored from the original engine
const T_COMPLIANT = 0.6;
const T_PARTIAL = 0.47;
const T_EVIDENCE = 0.4;

/** Normalize Arabic/English text so keyword matching is robust. */
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

function statusFor(score: number): { status: ComplianceStatus; severity: Finding["severity"] } {
  if (score >= T_COMPLIANT) return { status: "Compliant", severity: "low" };
  if (score >= T_PARTIAL) return { status: "Partially Compliant", severity: "medium" };
  return { status: "Non-Compliant", severity: "high" };
}

function scoreValue(status: ComplianceStatus): number {
  return status === "Compliant" ? 100 : status === "Partially Compliant" ? 55 : 0;
}

interface Scored {
  control: Control;
  coverage: number;
  score: number;
  evidence: string;
}

/** Score every catalog control against the document text. */
function scoreControls(text: string): Scored[] {
  const norm = normalize(text);
  const sentences = text.split(/[\n.؟!]/).map((s) => s.trim()).filter((s) => s.length > 12);

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
          const sent = sentences.find((s) => normalize(s).includes(groupHit));
          if (sent) evidence = sent.slice(0, 300);
        }
      }
    }
    const coverage = control.concepts.length ? matched / control.concepts.length : 0;
    // Map coverage → pseudo semantic match score so that full coverage reads as
    // Compliant (≥0.60), roughly half coverage as Partially Compliant (≥0.47),
    // and no coverage as Non-Compliant.
    const score = Math.min(0.9, 0.3 + 0.55 * coverage);
    return { control, coverage, score, evidence };
  });
}

function finalize(findings: Finding[], names: string[]): ComplianceReport {
  const byAuth: Record<string, Finding[]> = {};
  for (const f of findings) (byAuth[f.authority] ??= []).push(f);

  const breakdown: AuthorityScore[] = Object.entries(byAuth).map(([authority, fs]) => {
    const matched = fs.filter((f) => f.status === "Compliant").length;
    const score = fs.length ? Math.round(fs.reduce((a, f) => a + scoreValue(f.status), 0) / fs.length) : 0;
    return { authority, score, matched, total: fs.length };
  });
  const overall = breakdown.length ? Math.round(breakdown.reduce((a, b) => a + b.score, 0) / breakdown.length) : 0;

  const totals: ComplianceTotals = {
    matched_requirements: findings.filter((f) => f.status === "Compliant").length,
    missing_requirements: findings.filter((f) => f.status === "Non-Compliant").length,
    partial_matches: findings.filter((f) => f.status === "Partially Compliant").length,
    high_risk_findings: findings.filter((f) => f.severity === "high").length,
    critical_findings: findings.filter((f) => f.severity === "critical").length,
  };

  const missing = findings.filter((f) => f.status === "Non-Compliant").map((f) => f.requirement_title).slice(0, 12);
  const recommendations = [...new Set(findings.filter((f) => f.status !== "Compliant").map((f) => f.recommendation))].slice(0, 8);

  const parts = breakdown.map((b) => `${authorityAr(b.authority)} ${b.score}%`).join("، ");
  const executive_summary =
    `بلغت نسبة الالتزام الكلية ${overall}% بعد مقارنة الوثيقة المرفوعة مع ${findings.length} متطلباً نظامياً ` +
    `من الأنظمة السعودية الرسمية (${parts}). تم رصد ${totals.matched_requirements} متطلباً ملتزماً، ` +
    `و${totals.partial_matches} جزئياً، و${totals.missing_requirements} غير مغطّى، منها ${totals.critical_findings} حرجة.`;

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
    engine: "built-in-heuristic",
    knowledge_base: { chunks: CATALOG.length, authorities },
    documents: names.length,
    document_names: names,
  };
}

/** Analyze combined document text and produce the Arabic compliance report. */
export function analyzeText(text: string, names: string[]): ComplianceReport {
  const scored = scoreControls(text)
    .sort((a, b) => b.score - a.score);

  const findings: Finding[] = scored.map(({ control, score, evidence }) => {
    const { status, severity: baseSeverity } = statusFor(score);
    // NCA non-compliance is treated as critical, mirroring the original engine.
    const severity =
      control.authority === "NCA" && status === "Non-Compliant" ? "critical" : baseSeverity;
    const hasEvidence = score >= T_EVIDENCE;
    const cite = `${authorityAr(control.authority)} — ${control.source_document}`;

    return {
      requirement_title: control.title_ar,
      authority: control.authority,
      source_document: control.source_document,
      section: control.section,
      status,
      match_score: Math.round(score * 1000) / 1000,
      severity,
      why:
        hasEvidence
          ? `تطابق موضوعي بنسبة ${Math.round(score * 100)}% بين محتوى وثيقتك والمتطلب النظامي.`
          : "لم يُعثر على دليل كافٍ في الوثيقة المرفوعة يغطي هذا المتطلب.",
      evidence_uploaded:
        (hasEvidence && evidence) ? evidence : "لا يوجد دليل كافٍ في الوثيقة يغطي هذا المتطلب.",
      evidence_regulation: control.title_ar,
      gap:
        status === "Compliant"
          ? "لا توجد فجوة جوهرية."
          : status === "Partially Compliant"
            ? "المتطلب مغطّى جزئياً ويحتاج تفصيلاً إضافياً."
            : "المتطلب غير مغطّى في الوثيقة الحالية.",
      recommendation:
        status === "Compliant"
          ? `الحفاظ على الالتزام وفق ${cite}.`
          : `مواءمة الوثيقة مع ${cite} لسدّ الفجوة.`,
      suggested_improvement:
        status === "Compliant"
          ? "الحفاظ على الالتزام ومراجعته دورياً."
          : "إضافة بند صريح يغطي هذا الضابط مع تحديد المالك وآلية القياس.",
      reference_id: control.reference_id,
      source_url: control.source_url,
    };
  });

  return finalize(findings, names);
}

"use client";

import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CountUp } from "@/components/ui/count-up";
import { useLang } from "./i18n";
import { LangToggle } from "./LangToggle";
import { addRipple } from "./Orb";
import type { ComplianceReport as Report, Finding } from "@/lib/types";

const STATUS: Record<string, { c: string; ar: string; en: string }> = {
  Compliant: { c: "#13E09B", ar: "ملتزم", en: "Compliant" },
  "Partially Compliant": { c: "#F0C75E", ar: "ملتزم جزئياً", en: "Partially Compliant" },
  "Non-Compliant": { c: "#FF6B5A", ar: "غير ملتزم", en: "Non-Compliant" },
  "Not Applicable": { c: "#8FA69C", ar: "لا ينطبق", en: "Not Applicable" },
};
const AUTH: Record<string, { ar: string; en: string }> = {
  DGA: { ar: "هيئة الحكومة الرقمية", en: "Digital Government Authority" },
  NCA: { ar: "الهيئة الوطنية للأمن السيبراني", en: "National Cybersecurity Authority" },
  NDMO: { ar: "مكتب إدارة البيانات الوطنية", en: "National Data Management Office" },
  PDPL: { ar: "نظام حماية البيانات الشخصية", en: "Personal Data Protection Law" },
  CST: { ar: "هيئة الاتصالات والفضاء والتقنية", en: "Communications, Space & Technology Commission" },
};
const scoreColor = (s: number) => (s >= 80 ? "#13E09B" : s >= 60 ? "#F0C75E" : "#FF6B5A");

export function ComplianceReport({ report, onRestart }: { report: Report; onRestart: () => void }) {
  const { t, lang } = useLang();
  const ov = report.overall_compliance;
  const ring = 653;

  const references = useMemo(() => {
    const map = new Map<string, { doc: string; url: string; authority: string }>();
    report.findings.forEach((f) => {
      if (f.source_url && !map.has(f.source_url)) map.set(f.source_url, { doc: f.source_document, url: f.source_url, authority: f.authority });
    });
    return Array.from(map.values());
  }, [report.findings]);

  return (
    <div style={{ position: "relative", zIndex: 5, maxWidth: 1080, margin: "0 auto", padding: "26px clamp(16px,4vw,44px) 60px" }}>
      {/* header */}
      <div className="anim-fadeUp" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative", width: 36, height: 36 }}>
            <div style={{ position: "absolute", inset: -6, borderRadius: "50%", background: "radial-gradient(circle,rgba(0,194,122,.6),transparent 65%)", filter: "blur(8px)" }} />
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle at 34% 28%,#3affbf,#00C27A 45%,#05392a)", boxShadow: "inset 0 -6px 12px rgba(0,0,0,.5),0 0 16px rgba(0,194,122,.5)" }} />
          </div>
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>واءم</div>
            <div style={{ fontSize: 10.5, color: "rgba(248,250,252,.5)" }}>{t("تقرير الامتثال الحوكمي", "Governance Compliance Report")}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 999, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.09)", fontSize: 11.5, color: "rgba(248,250,252,.7)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#13E09B", boxShadow: "0 0 8px #13E09B" }} />
            {report.engine === "llama" ? t("تحليل ذكي · Llama", "Llama RAG") : t("محرك RAG", "RAG engine")} · {report.knowledge_base?.chunks ?? 0} {t("مقطع نظامي", "reg. chunks")}
          </span>
          <button onClick={() => window.print()} style={btn}>{t("تصدير التقرير", "Export report")}</button>
          <button onClick={(e) => { addRipple(e); onRestart(); }} style={{ ...btn, background: "linear-gradient(135deg,#00C27A,#13E09B)", color: "#04140E", border: "none" }}>{t("تحليل جديد", "New analysis")}</button>
          <LangToggle />
        </div>
      </div>

      {/* hero score + breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px,1fr) 1.3fr", gap: 16, alignItems: "stretch" }} className="cr-hero">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ ...panel, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "-25%", insetInlineStart: "-10%", width: "60%", height: "70%", background: "radial-gradient(circle,rgba(0,194,122,.22),transparent 65%)", filter: "blur(28px)" }} />
          <div style={{ fontSize: 12, fontWeight: 600, color: "#13E09B", letterSpacing: ".08em", position: "relative" }}>{t("الالتزام الكلي", "Overall Compliance")}</div>
          <div style={{ position: "relative", width: 220, height: 220, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 6 }}>
            <svg width="220" height="220" viewBox="0 0 250 250" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="125" cy="125" r="104" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="14" />
              <motion.circle cx="125" cy="125" r="104" fill="none" stroke={scoreColor(ov)} strokeWidth="14" strokeLinecap="round" strokeDasharray={ring}
                initial={{ strokeDashoffset: ring }} animate={{ strokeDashoffset: ring * (1 - ov / 100) }} transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                style={{ filter: `drop-shadow(0 0 8px ${scoreColor(ov)}bb)` }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "baseline", fontSize: 62, fontWeight: 700, color: "#F8FAFC", lineHeight: 1 }}>
                <CountUp value={ov} duration={1.6} className="mono" /><span className="mono" style={{ fontSize: 26, color: scoreColor(ov) }}>%</span>
              </div>
              <div style={{ fontSize: 12.5, color: scoreColor(ov), marginTop: 2, fontWeight: 600 }}>
                {ov >= 80 ? t("التزام عالٍ", "High") : ov >= 60 ? t("التزام متوسط", "Moderate") : t("التزام منخفض", "Low")}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} style={{ ...panel, padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{t("الالتزام حسب الجهة", "Compliance by Authority")}</div>
          {report.breakdown.map((b, i) => (
            <div key={b.authority}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: "#F8FAFC", fontWeight: 600 }}>{AUTH[b.authority]?.[lang] ?? b.authority} <span style={{ color: "rgba(248,250,252,.45)", fontWeight: 400, fontSize: 11 }}>· {b.authority}</span></span>
                <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: scoreColor(b.score) }}>{b.score}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 6, background: "rgba(255,255,255,.06)", overflow: "hidden" }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${b.score}%` }} transition={{ duration: 1, delay: 0.2 + i * 0.1 }} style={{ height: "100%", borderRadius: 6, background: scoreColor(b.score) }} />
              </div>
              <div style={{ fontSize: 10.5, color: "rgba(248,250,252,.4)", marginTop: 4 }}>{b.matched}/{b.total} {t("متطلب ملتزم", "requirements met")}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* totals strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginTop: 16 }}>
        {[
          { v: report.totals.matched_requirements, l: t("متطلبات ملتزمة", "Matched"), c: "#13E09B" },
          { v: report.totals.partial_matches, l: t("التزام جزئي", "Partial"), c: "#F0C75E" },
          { v: report.totals.missing_requirements, l: t("متطلبات مفقودة", "Missing"), c: "#FF6B5A" },
          { v: report.totals.high_risk_findings, l: t("مخاطر عالية", "High-risk"), c: "#F0A84E" },
          { v: report.totals.critical_findings, l: t("نتائج حرجة", "Critical"), c: "#FF6B5A" },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }} style={{ ...panel, padding: "16px 18px" }}>
            <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: s.c }}>{s.v}</div>
            <div style={{ fontSize: 11.5, color: "rgba(248,250,252,.55)", marginTop: 2 }}>{s.l}</div>
          </motion.div>
        ))}
      </div>

      {/* executive summary */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ ...panel, padding: 22, marginTop: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{t("الملخص التنفيذي", "Executive Summary")}</div>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: "rgba(248,250,252,.72)" }}>{report.executive_summary}</div>
      </motion.div>

      {/* findings */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{t("النتائج التفصيلية", "Findings")}</div>
        <div style={{ fontSize: 12.5, color: "rgba(248,250,252,.5)", marginBottom: 14 }}>{report.findings.length} {t("متطلب — انقر للتوسعة", "requirements — click to expand")}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {report.findings.map((f, i) => <FindingCard key={f.reference_id + i} f={f} i={i} />)}
        </div>
      </div>

      {/* references */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{t("المراجع الرسمية", "Official References")}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {references.map((r, i) => (
            <a key={i} href={r.url} target="_blank" rel="noreferrer" style={{ ...panel, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "#13E09B", background: "rgba(0,194,122,.12)", border: "1px solid rgba(0,194,122,.25)", padding: "3px 9px", borderRadius: 7 }}>{AUTH[r.authority]?.[lang] ?? r.authority}</span>
              <span style={{ flex: 1, fontSize: 13, color: "#F8FAFC", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.doc}</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#13E09B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6M10 14 21 3" /></svg>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function FindingCard({ f, i }: { f: Finding; i: number }) {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(i === 0);
  const s = STATUS[f.status] ?? STATUS["Non-Compliant"];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
      style={{ ...panel, overflow: "hidden", borderColor: open ? `${s.c}44` : "rgba(255,255,255,.09)" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "15px 18px", background: "transparent", border: "none", cursor: "pointer", textAlign: "start", fontFamily: "inherit" }}>
        <span style={{ width: 4, height: 34, borderRadius: 3, background: s.c, flex: "none" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: s.c, background: `${s.c}22`, border: `1px solid ${s.c}44`, padding: "2px 9px", borderRadius: 7 }}>{t(s.ar, s.en)}</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "#13E09B", background: "rgba(0,194,122,.1)", padding: "2px 8px", borderRadius: 6 }}>{AUTH[f.authority]?.[lang] ?? f.authority}</span>
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "#F8FAFC", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.requirement_title}</div>
        </div>
        <motion.svg animate={{ rotate: open ? 180 : 0 }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(248,250,252,.5)" strokeWidth="2.2" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></motion.svg>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28 }}>
            <div style={{ padding: "0 18px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
              {f.why && <Field label={t("السبب", "Why")} value={f.why} color="#13E09B" />}
              <Field label={t("الدليل من وثيقتك", "Evidence — your document")} value={f.evidence_uploaded} color="#F0C75E" mono />
              <Field label={t("الدليل من النظام", "Evidence — regulation")} value={f.evidence_regulation} color="#00C27A" mono />
              {f.gap && <Field label={t("تحليل الفجوة", "Gap analysis")} value={f.gap} color="#FF6B5A" />}
              {f.recommendation && <Field label={t("التوصية", "Recommendation")} value={f.recommendation} color="#13E09B" />}
              {f.suggested_improvement && <Field label={t("التحسين المقترح", "Suggested improvement")} value={f.suggested_improvement} color="#F0C75E" />}
              {f.source_url && (
                <a href={f.source_url} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: "#13E09B", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {t("المرجع الرسمي", "Official reference")}: {f.source_document} {f.section ? `· ${f.section}` : ""}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Field({ label, value, color, mono }: { label: string; value: string; color: string; mono?: boolean }) {
  return (
    <div style={{ borderRadius: 12, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", padding: 12 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color, letterSpacing: ".03em", marginBottom: 5, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: color }} />{label}
      </div>
      <div dir="auto" className={mono ? "mono" : ""} style={{ fontSize: 12.5, lineHeight: 1.7, color: "rgba(248,250,252,.75)" }}>{value}</div>
    </div>
  );
}

const panel: React.CSSProperties = {
  borderRadius: 18, background: "linear-gradient(150deg,rgba(16,42,34,.7),rgba(11,30,23,.5))",
  border: "1px solid rgba(255,255,255,.09)", backdropFilter: "blur(14px)",
};
const btn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", padding: "8px 14px", borderRadius: 11,
  border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.04)", color: "rgba(248,250,252,.8)",
  fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer", position: "relative", overflow: "hidden",
};

"use client";

import { useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ComplianceReport as Report, Finding } from "@/lib/types";

// ---------------------------------------------------------------------------
// Static config (from the imported WAAEM design)
// ---------------------------------------------------------------------------
const AUTH: Record<string, { name: string; short: string; code: string }> = {
  DGA: { name: "هيئة الحكومة الرقمية", short: "الحكومة الرقمية (DGA)", code: "Digital Government Authority" },
  NCA: { name: "الهيئة الوطنية للأمن السيبراني", short: "الأمن السيبراني (NCA)", code: "National Cybersecurity Authority" },
  NDMO: { name: "مكتب إدارة البيانات الوطنية", short: "إدارة البيانات (NDMO)", code: "National Data Management Office" },
  PDPL: { name: "نظام حماية البيانات الشخصية", short: "حماية البيانات (PDPL)", code: "Personal Data Protection Law" },
  CST: { name: "هيئة الاتصالات والفضاء والتقنية", short: "الاتصالات والتقنية (CST)", code: "Communications, Space & Technology Commission" },
};
const AUTH_ORDER = ["DGA", "NCA", "NDMO", "PDPL", "CST"];

type St = "non" | "partial" | "compliant";
const SINFO: Record<St, { l: string; c: string; bg: string; bd: string }> = {
  non: { l: "غير مطابق", c: "#E5484D", bg: "rgba(229,72,77,.1)", bd: "rgba(229,72,77,.24)" },
  partial: { l: "مطابق جزئياً", c: "#E0921F", bg: "rgba(224,146,31,.12)", bd: "rgba(224,146,31,.26)" },
  compliant: { l: "مطابق", c: "#12A150", bg: "rgba(18,161,80,.1)", bd: "rgba(18,161,80,.24)" },
};
const statusOf = (s: string): St =>
  s === "Compliant" ? "compliant" : s === "Partially Compliant" ? "partial" : s === "Non-Compliant" ? "non" : "compliant";
const authColor = (n: number) => (n >= 85 ? "#12A150" : n >= 60 ? "#C6A34F" : n >= 40 ? "#E0921F" : "#E5484D");

// ---------------------------------------------------------------------------
// view model derived from the real backend report
// ---------------------------------------------------------------------------
interface VF {
  id: string; auth: string; status: St; title: string; desc: string;
  reason: string; evidenceDoc: string; evidenceReg: string; gap: string; rec: string; improve: string;
  ref: string; sourceUrl: string; authorityShort: string;
}
function buildView(r: Report) {
  const findings: VF[] = r.findings.map((f: Finding, i) => {
    const st = statusOf(f.status);
    return {
      id: `f${i}`, auth: f.authority, status: st,
      title: f.requirement_title,
      desc: st === "compliant" ? (f.evidence_uploaded || f.why) : (f.gap || f.why),
      reason: f.why, evidenceDoc: f.evidence_uploaded, evidenceReg: f.evidence_regulation,
      gap: f.gap, rec: f.recommendation, improve: f.suggested_improvement,
      ref: f.source_document || (AUTH[f.authority]?.name ?? f.authority),
      sourceUrl: f.source_url, authorityShort: AUTH[f.authority]?.short ?? f.authority,
    };
  });
  // priority-first ordering: non → partial → compliant
  const rank = { non: 0, partial: 1, compliant: 2 } as const;
  findings.sort((a, b) => rank[a.status] - rank[b.status]);
  const counts = {
    compliant: findings.filter((f) => f.status === "compliant").length,
    partial: findings.filter((f) => f.status === "partial").length,
    non: findings.filter((f) => f.status === "non").length,
  };
  const present = new Set(r.breakdown.map((b) => b.authority));
  const order = [
    ...AUTH_ORDER.filter((a) => present.has(a)),
    ...r.breakdown.map((b) => b.authority).filter((a) => !AUTH_ORDER.includes(a)),
  ];
  const scoreMap = Object.fromEntries(r.breakdown.map((b) => [b.authority, b.score]));
  const authorities = order.map((a) => ({ key: a, score: scoreMap[a] ?? 0, name: AUTH[a]?.name ?? a, short: AUTH[a]?.short ?? a }));
  return { findings, counts, authorities, overall: r.overall_compliance, summary: r.executive_summary };
}
type View = ReturnType<typeof buildView>;

// ---------------------------------------------------------------------------
// small svg helper + interactions
// ---------------------------------------------------------------------------
const Ic = ({ d, s = 22, sw = 1.9, c = "currentColor", fill = "none" }: { d: string[]; s?: number; sw?: number; c?: string; fill?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={fill} stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {d.map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const addRipple = (e: React.MouseEvent<HTMLElement>) => {
  const t = e.currentTarget, r = t.getBoundingClientRect(), size = Math.max(r.width, r.height);
  const s = document.createElement("span");
  s.style.cssText = `position:absolute;border-radius:50%;background:rgba(255,255,255,.4);pointer-events:none;transform:scale(0);animation:ripple .6s ease-out;width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
  if (getComputedStyle(t).position === "static") t.style.position = "relative";
  t.appendChild(s); setTimeout(() => s.remove(), 620);
};
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

type Phase = "landing" | "uploading" | "analysis" | "report";

export default function WaaemPage() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [docName, setDocName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState<St | "all">("non");
  const [authority, setAuthority] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const sNon = useRef<HTMLSpanElement>(null);
  const sPartial = useRef<HTMLSpanElement>(null);
  const sCompliant = useRef<HTMLSpanElement>(null);

  const view = useMemo(() => (report ? buildView(report) : null), [report]);

  const animate = (el: HTMLElement | null, to: number, dur: number) => {
    if (!el) return;
    const t0 = performance.now();
    const stepFn = (t: number) => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(to * e));
      if (p < 1) requestAnimationFrame(stepFn);
    };
    requestAnimationFrame(stepFn);
  };
  const reveal = (v: View) => {
    setTimeout(() => {
      if (ringRef.current) ringRef.current.style.strokeDashoffset = String(553 * (1 - v.overall / 100));
      animate(scoreRef.current, v.overall, 1700);
      animate(sCompliant.current, v.counts.compliant, 1200);
      animate(sPartial.current, v.counts.partial, 1000);
      animate(sNon.current, v.counts.non, 900);
    }, 220);
  };

  const pick = () => inputRef.current?.click();
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    begin(f);
    e.target.value = "";
  };

  async function begin(file: File) {
    setErr(null);
    setDocName(file.name);
    setPhase("uploading");
    let stepTimer: ReturnType<typeof setInterval> | undefined;
    try {
      const up = await api.upload([file]);
      const ids = up.document_ids;
      if (!ids?.length) throw new Error("تعذّر رفع الوثيقة.");
      setPhase("analysis");
      setStep(0);
      const started = Date.now();
      stepTimer = setInterval(() => setStep((s) => Math.min(AUTH_ORDER.length, s + 1)), 700);

      const an = await api.analyze(ids);
      const res = await api.result(an.analysis_id);
      const rep = res.result;

      const minMs = AUTH_ORDER.length * 700 + 500;
      const elapsed = Date.now() - started;
      if (elapsed < minMs) await sleep(minMs - elapsed);
      if (stepTimer) clearInterval(stepTimer);
      setStep(AUTH_ORDER.length);

      const v = buildView(rep);
      setReport(rep);
      setTab(v.counts.non ? "non" : v.counts.partial ? "partial" : "compliant");
      setAuthority(null);
      setDrawerId(null);
      setPhase("report");
      reveal(v);
    } catch (e) {
      if (stepTimer) clearInterval(stepTimer);
      setErr(e instanceof Error ? e.message : "تعذّر تحليل الوثيقة. حاول مرة أخرى.");
      setPhase("landing");
    }
  }

  const restart = () => {
    setReport(null); setDocName(""); setDrawerId(null); setTab("non"); setAuthority(null); setStep(0); setErr(null);
    setPhase("landing");
  };

  const drawerF = view?.findings.find((f) => f.id === drawerId) || null;

  // ======================= RENDER =======================
  return (
    <div dir="rtl" style={{ position: "relative", minHeight: "100vh", background: "#F2F6F4", overflowX: "hidden" }}>
      {/* soft background */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-14%", right: "-6%", width: "44vw", height: "44vw", background: "radial-gradient(circle,rgba(0,158,106,.14),transparent 62%)", filter: "blur(24px)", animation: "softGlow 12s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: "-20%", left: "-8%", width: "40vw", height: "40vw", background: "radial-gradient(circle,rgba(19,196,137,.10),transparent 62%)", filter: "blur(28px)", animation: "softGlow 16s ease-in-out infinite" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(16,35,28,.028) 1px,transparent 1px),linear-gradient(90deg,rgba(16,35,28,.028) 1px,transparent 1px)", backgroundSize: "48px 48px", WebkitMaskImage: "radial-gradient(ellipse 85% 65% at 50% 34%,#000 20%,transparent 80%)", maskImage: "radial-gradient(ellipse 85% 65% at 50% 34%,#000 20%,transparent 80%)" }} />
      </div>

      {/* top bar */}
      <div style={{ position: "relative", zIndex: 5, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px clamp(20px,5vw,56px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative", width: 38, height: 38 }}>
            <div style={{ position: "absolute", inset: -5, borderRadius: "50%", background: "radial-gradient(circle,rgba(0,158,106,.5),transparent 66%)", filter: "blur(7px)" }} />
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle at 34% 28%,#4fe3b0,#009E6A 46%,#0B3D2E)", boxShadow: "inset 0 -5px 11px rgba(0,0,0,.35),0 0 12px rgba(0,158,106,.4)" }} />
          </div>
          <div style={{ lineHeight: 1.12 }}>
            <div style={{ fontWeight: 700, fontSize: 19 }}>واءم</div>
            <div style={{ fontSize: 10.5, color: "#5A6B64" }}>منصة الامتثال التنظيمي بالذكاء الاصطناعي</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 13px", borderRadius: 999, background: "#fff", border: "1px solid rgba(16,35,28,.08)", fontSize: 12, color: "#5A6B64", fontWeight: 500 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#12A150", boxShadow: "0 0 0 3px rgba(18,161,80,.16)" }} />
          المحرك جاهز
        </div>
      </div>

      {/* ===================== LANDING ===================== */}
      {phase === "landing" && (
        <section style={{ position: "relative", zIndex: 5, maxWidth: 1060, margin: "0 auto", padding: "clamp(30px,7vh,80px) clamp(20px,5vw,56px) 90px", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 15px", borderRadius: 999, background: "rgba(0,158,106,.08)", border: "1px solid rgba(0,158,106,.16)", fontSize: 12.5, fontWeight: 600, color: "#0B3D2E", animation: "fadeUp .6s ease both" }}>
            <Ic s={14} sw={2.2} c="#009E6A" d={["M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z", "m9 12 2 2 4-4"]} />
            متوافق مع الأنظمة التنظيمية السعودية
          </div>
          <h1 style={{ fontSize: "clamp(30px,5.4vw,52px)", fontWeight: 700, lineHeight: 1.28, letterSpacing: "-.01em", margin: "26px auto 0", maxWidth: 840, animation: "fadeUp .7s ease both" }}>
            تحليل الامتثال للأنظمة السعودية <span style={{ color: "#009E6A" }}>باستخدام الذكاء الاصطناعي</span>
          </h1>
          <p style={{ fontSize: "clamp(15px,2.2vw,18px)", lineHeight: 1.85, color: "#5A6B64", maxWidth: 700, margin: "22px auto 0", fontWeight: 400, animation: "fadeUp .8s ease both" }}>
            ارفع أي سياسة أو إجراء أو دليل تنظيمي، وسيقوم النظام بتحليلها ومقارنتها تلقائياً مع متطلبات هيئة الحكومة الرقمية، والهيئة الوطنية للأمن السيبراني، ومكتب إدارة البيانات الوطنية، ونظام حماية البيانات الشخصية، وهيئة الاتصالات والفضاء والتقنية.
          </p>

          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginTop: 38, animation: "fadeUp .9s ease both" }}>
            <div style={{ position: "absolute", top: -16, width: 220, height: 80, background: "radial-gradient(circle,rgba(0,158,106,.28),transparent 68%)", filter: "blur(22px)", pointerEvents: "none" }} />
            <input ref={inputRef} type="file" accept=".pdf,.docx" onChange={onFile} style={{ display: "none" }} />
            <button onClick={pick} onMouseDown={addRipple} style={{ position: "relative", overflow: "hidden", display: "inline-flex", alignItems: "center", gap: 12, padding: "17px 40px", border: "none", borderRadius: 16, background: "linear-gradient(135deg,#009E6A,#13C489)", color: "#fff", fontFamily: "inherit", fontSize: 17, fontWeight: 700, cursor: "pointer", boxShadow: "0 18px 40px -14px rgba(0,158,106,.6)" }}>
              <Ic s={20} sw={2.2} c="#fff" d={["M12 16V4M7 9l5-5 5 5", "M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"]} />
              رفع الوثيقة
            </button>
            <div style={{ fontSize: 13, color: "#5A6B64", padding: "4px 8px" }}>PDF · DOCX · يبدأ التحليل فور الرفع</div>
            {err && <div style={{ color: "#E5484D", fontSize: 13.5, fontWeight: 600, marginTop: 4 }}>{err}</div>}
          </div>

          {/* features */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,230px),1fr))", gap: 16, marginTop: "clamp(40px,6vw,60px)", textAlign: "right" }}>
            {[
              { title: "تحليل بالذكاء الاصطناعي", desc: "تحليل الوثائق التنظيمية آلياً واستخراج المتطلبات والضوابط بدقة.", c: "#009E6A", bg: "rgba(0,158,106,.1)", d: ["M12 3a2 2 0 0 0-2 2 2 2 0 0 0-2 2 2 2 0 0 0-1 3.7A2 2 0 0 0 8 15a2 2 0 0 0 2 2 2 2 0 0 0 2 2", "M12 3a2 2 0 0 1 2 2 2 2 0 0 1 2 2 2 2 0 0 1 1 3.7A2 2 0 0 1 16 15a2 2 0 0 1-2 2 2 2 0 0 1-2 2"] },
              { title: "مطابقة الأنظمة السعودية", desc: "مقارنة الوثيقة مع متطلبات خمس جهات تنظيمية سعودية تلقائياً.", c: "#0B3D2E", bg: "rgba(11,61,46,.09)", d: ["M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z", "m9 12 2 2 4-4"] },
              { title: "تقرير امتثال احترافي", desc: "إصدار تقرير تنفيذي واضح يبرز الفجوات والتوصيات ذات الأولوية.", c: "#C6A34F", bg: "rgba(198,163,79,.14)", d: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "m9 15 2 2 4-4"] },
            ].map((f, i) => (
              <div key={i} style={{ background: "#fff", border: "1px solid rgba(16,35,28,.07)", borderRadius: 20, padding: "26px 24px", boxShadow: "0 10px 30px -20px rgba(16,35,28,.25)", animation: `fadeUp .6s ease both`, animationDelay: `${0.1 * (i + 1)}s` }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: f.bg, display: "flex", alignItems: "center", justifyContent: "center" }}><Ic s={24} c={f.c} d={f.d} /></div>
                <div style={{ fontSize: 16.5, fontWeight: 700, marginTop: 18 }}>{f.title}</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.7, color: "#5A6B64", marginTop: 8 }}>{f.desc}</div>
              </div>
            ))}
          </div>

          {/* supported authorities */}
          <div style={{ marginTop: "clamp(40px,6vw,64px)", background: "#fff", border: "1px solid rgba(16,35,28,.07)", borderRadius: 22, padding: "clamp(22px,4vw,30px)", boxShadow: "0 10px 30px -22px rgba(16,35,28,.22)", textAlign: "right" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 6 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(0,158,106,.1)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic s={18} c="#009E6A" d={["M3 21h18M6 21V10M18 21V10M4 10l8-6 8 6M9 21v-6h6v6"]} /></div>
              <div style={{ fontSize: "clamp(17px,2.6vw,20px)", fontWeight: 700 }}>الجهات التنظيمية المدعومة</div>
            </div>
            <div style={{ fontSize: 13, color: "#5A6B64", textAlign: "center", marginBottom: 20 }}>يقارن النظام وثيقتك تلقائياً مع الأنظمة الرسمية لدى خمس جهات تنظيمية سعودية</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,230px),1fr))", gap: 12 }}>
              {AUTH_ORDER.map((a) => (
                <div key={a} style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 16px", borderRadius: 14, background: "#FBFDFC", border: "1px solid rgba(16,35,28,.07)" }}>
                  <span style={{ flex: "none", width: 24, height: 24, borderRadius: "50%", background: "rgba(18,161,80,.12)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic s={14} sw={2.6} c="#12A150" d={["m20 6-11 11-5-5"]} /></span>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "#10231C", lineHeight: 1.5 }}>{AUTH[a].name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===================== PROCESSING ===================== */}
      {(phase === "uploading" || phase === "analysis") && (
        <div style={{ position: "fixed", inset: 0, zIndex: 40, background: "radial-gradient(ellipse 100% 80% at 50% 30%,#0B3D2E,#061c15 75%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", gap: 30, animation: "blurIn .5s ease both" }}>
          <div style={{ position: "relative", width: 220, height: 220, animation: "orbFloat 6s ease-in-out infinite" }}>
            <div style={{ position: "absolute", inset: -48, borderRadius: "50%", background: "radial-gradient(circle,rgba(0,158,106,.6),transparent 62%)", filter: "blur(34px)", animation: "breatheGlow 3s ease-in-out infinite" }} />
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "conic-gradient(from 0deg,#009E6A,#13C489,#C6A34F,#13C489,#009E6A)", WebkitMask: "radial-gradient(farthest-side,transparent calc(100% - 10px),#000 calc(100% - 9px))", mask: "radial-gradient(farthest-side,transparent calc(100% - 10px),#000 calc(100% - 9px))", animation: "spin 5s linear infinite", opacity: 0.9 }} />
            <div style={{ position: "absolute", inset: 22, borderRadius: "50%", background: "radial-gradient(circle at 34% 28%,#5fffc6,#009E6A 44%,#042a1f)", boxShadow: "inset 0 -18px 40px rgba(0,0,0,.5),inset 0 12px 30px rgba(255,255,255,.24),0 0 70px rgba(0,158,106,.55)", animation: "breathe 3s ease-in-out infinite" }} />
            <div style={{ position: "absolute", top: "20%", left: "26%", width: "38%", height: "26%", borderRadius: "50%", background: "radial-gradient(circle,rgba(255,255,255,.7),transparent 70%)", filter: "blur(6px)" }} />
            <div style={{ position: "absolute", inset: 22, borderRadius: "50%", border: "1px solid rgba(255,255,255,.16)", animation: "pulseRing 2.6s ease-out infinite" }} />
          </div>

          {phase === "uploading" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>جارٍ رفع الوثيقة<span style={{ animation: "dotPulse 1.4s ease-in-out infinite" }}>...</span></div>
              <div style={{ fontSize: 13.5, color: "rgba(255,255,255,.6)", marginTop: 8 }}>{docName}</div>
            </div>
          )}

          {phase === "analysis" && (
            <>
              <div style={{ textAlign: "center" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 9, fontSize: 22, fontWeight: 700, color: "#fff" }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#13C489", boxShadow: "0 0 10px #13C489", animation: "dotPulse 1.3s ease-in-out infinite" }} />
                  جاري تحليل الوثيقة
                </div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,.62)", marginTop: 10 }}>يتم الآن مقارنة الوثيقة مع:</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "min(440px,92vw)" }}>
                {AUTH_ORDER.map((a, i) => {
                  const done = i < step, active = i === step;
                  return (
                    <div key={a} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderRadius: 14, background: done ? "rgba(19,196,137,.12)" : "rgba(255,255,255,.05)", border: `1px solid ${done ? "rgba(19,196,137,.3)" : "rgba(255,255,255,.08)"}`, transition: "all .3s ease" }}>
                      <span style={{ flex: "none", width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: done ? "#12A150" : "rgba(255,255,255,.1)", color: "#fff" }}>
                        {done ? <span style={{ display: "inline-flex", animation: "checkPop .4s ease both" }}><Ic s={14} sw={2.8} c="#fff" d={["m20 6-11 11-5-5"]} /></span>
                          : active ? <span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid rgba(255,255,255,.4)", borderTopColor: "#13C489", animation: "spin .8s linear infinite" }} />
                            : <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,.35)" }} />}
                      </span>
                      <div style={{ flex: 1, textAlign: "right" }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: done ? "#fff" : "rgba(255,255,255,.72)" }}>{AUTH[a].name}</div>
                        <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.5)" }}>{AUTH[a].code}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ===================== REPORT ===================== */}
      {phase === "report" && view && (
        <div style={{ position: "relative", zIndex: 5, maxWidth: 1080, margin: "0 auto", padding: "6px clamp(18px,4vw,48px) 90px" }}>
          {/* header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 22, animation: "fadeUp .5s ease both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(0,158,106,.1)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic s={20} c="#009E6A" d={["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "m9 15 2 2 4-4"]} /></div>
              <div><div style={{ fontSize: 15, fontWeight: 700 }}>تقرير الامتثال التنظيمي</div><div style={{ fontSize: 12, color: "#5A6B64" }}>{docName}</div></div>
            </div>
            <button onClick={restart} onMouseDown={addRipple} style={{ position: "relative", overflow: "hidden", display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", border: "1px solid rgba(16,35,28,.12)", borderRadius: 12, background: "#fff", color: "#10231C", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <Ic s={15} sw={2} d={["M12 16V4M7 9l5-5 5 5", "M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"]} />تحليل وثيقة جديدة
            </button>
          </div>

          {/* score + stats */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, animation: "blurIn .6s ease both" }}>
            <div style={{ flex: "1 1 260px", minWidth: "min(100%,260px)", position: "relative", overflow: "hidden", background: "linear-gradient(150deg,#0B3D2E,#083026)", borderRadius: 24, padding: "clamp(20px,3vw,28px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: "0 24px 50px -26px rgba(11,61,46,.6)" }}>
              <div style={{ position: "absolute", top: "-20%", right: "-10%", width: "60%", height: "70%", background: "radial-gradient(circle,rgba(19,196,137,.3),transparent 65%)", filter: "blur(26px)" }} />
              <div style={{ position: "relative", width: 210, height: 210, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="210" height="210" viewBox="0 0 210 210" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="105" cy="105" r="88" fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="13" />
                  <circle ref={ringRef} cx="105" cy="105" r="88" fill="none" stroke="url(#gr)" strokeWidth="13" strokeLinecap="round" strokeDasharray="553" strokeDashoffset="553" style={{ transition: "stroke-dashoffset 1.8s cubic-bezier(.22,1,.36,1)", filter: "drop-shadow(0 0 6px rgba(19,196,137,.7))" }} />
                  <defs><linearGradient id="gr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#13C489" /><stop offset="1" stopColor="#C6A34F" /></linearGradient></defs>
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ display: "flex", alignItems: "baseline" }}>
                    <span ref={scoreRef} className="mono" style={{ fontSize: "clamp(52px,10vw,64px)", fontWeight: 700, color: "#fff", lineHeight: 1, letterSpacing: "-.03em" }}>0</span>
                    <span className="mono" style={{ fontSize: "clamp(22px,4.5vw,26px)", fontWeight: 600, color: "#13C489" }}>%</span>
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,.65)", marginTop: 2 }}>نسبة الامتثال الإجمالية</div>
                </div>
              </div>
              <div style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 7, marginTop: 14, padding: "6px 14px", borderRadius: 999, background: "rgba(198,163,79,.18)", border: "1px solid rgba(198,163,79,.4)", fontSize: 12.5, fontWeight: 700, color: "#E4C97A" }}>
                <Ic s={13} c="#E4C97A" fill="#E4C97A" d={["M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z"]} />
                {view.overall >= 80 ? "مستوى امتثال ممتاز" : view.overall >= 60 ? "مستوى امتثال جيد" : view.overall >= 40 ? "مستوى امتثال متوسط" : "يحتاج معالجة عاجلة"}
              </div>
            </div>

            <div style={{ flex: "2 1 320px", minWidth: "min(100%,260px)", display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }}>
              {[
                { ref: sCompliant, color: "#12A150", label: "بند مطابق", bg: "rgba(18,161,80,.1)", d: ["m9 12 2 2 4-4", "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"] },
                { ref: sPartial, color: "#E0921F", label: "مطابق جزئياً", bg: "rgba(224,146,31,.12)", d: ["M12 9v4M12 17h.01", "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"] },
                { ref: sNon, color: "#E5484D", label: "غير مطابق", bg: "rgba(229,72,77,.1)", d: ["M18 6 6 18M6 6l12 12"] },
              ].map((s, i) => (
                <div key={i} style={{ position: "relative", overflow: "hidden", background: "#fff", border: "1px solid rgba(16,35,28,.07)", borderRadius: 18, padding: "clamp(14px,2.4vw,20px)", display: "flex", flexDirection: "column", minHeight: 130, boxShadow: "0 10px 28px -22px rgba(16,35,28,.2)" }}>
                  <div style={{ position: "absolute", top: 0, insetInline: 0, height: 3, background: s.color }} />
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center" }}><Ic s={20} sw={2} c={s.color} d={s.d} /></div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: "auto" }}>
                    <span ref={s.ref} className="mono" style={{ fontSize: "clamp(30px,7vw,42px)", fontWeight: 700, color: "#10231C", lineHeight: 1 }}>0</span>
                  </div>
                  <div style={{ fontSize: "clamp(11px,3vw,13px)", fontWeight: 600, color: s.color, marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* executive summary */}
          <div style={{ marginTop: 18, background: "#fff", border: "1px solid rgba(16,35,28,.07)", borderRadius: 20, padding: "22px 24px", boxShadow: "0 10px 30px -22px rgba(16,35,28,.22)", animation: "fadeUp .6s ease .1s both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Ic s={16} sw={2} c="#009E6A" d={["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 8v4M12 16h.01"]} />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "#0B3D2E" }}>الملخص التنفيذي</span>
            </div>
            <p style={{ fontSize: 14.5, lineHeight: 1.85, color: "#3A4A44", margin: 0 }}>{view.summary}</p>
          </div>

          {/* priority findings */}
          <div style={{ marginTop: 30, animation: "fadeUp .6s ease .15s both" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              <div><div style={{ fontSize: 19, fontWeight: 700 }}>النتائج ذات الأولوية</div><div style={{ fontSize: 12.5, color: "#5A6B64", marginTop: 3 }}>البنود التي تحتاج إجراءً تظهر أولاً · اختر التصنيف لعرض المزيد</div></div>
            </div>

            {/* tabs */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: 5, background: "#fff", border: "1px solid rgba(16,35,28,.07)", borderRadius: 14, width: "fit-content", maxWidth: "100%" }}>
              {([
                { k: "all" as const, label: "الكل", count: view.findings.length, c: "#009E6A" },
                { k: "non" as const, label: "غير مطابق", count: view.counts.non, c: SINFO.non.c },
                { k: "partial" as const, label: "مطابق جزئياً", count: view.counts.partial, c: SINFO.partial.c },
                { k: "compliant" as const, label: "مطابق", count: view.counts.compliant, c: SINFO.compliant.c },
              ]).map((t) => {
                const on = tab === t.k;
                return (
                  <button key={t.k} onClick={() => setTab(t.k)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: on ? "#0B3D2E" : "transparent", color: on ? "#fff" : "#5A6B64", transition: "all .2s ease" }}>
                    {t.label}
                    <span className="mono" style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: on ? "rgba(255,255,255,.18)" : t.c + "22", color: on ? "#fff" : t.c }}>{t.count}</span>
                  </button>
                );
              })}
            </div>

            {/* grid */}
            <div style={{ marginTop: 18 }}>
              <FindingsGrid findings={view.findings.filter((f) => tab === "all" || f.status === tab)} onOpen={setDrawerId} />
            </div>
          </div>

          {/* authority overview */}
          <div style={{ marginTop: 34, animation: "fadeUp .6s ease .2s both" }}>
            <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 4 }}>الامتثال حسب الجهة التنظيمية</div>
            <div style={{ fontSize: 12.5, color: "#5A6B64", marginBottom: 16 }}>{view.authorities.length} جهات مدعومة · انقر أي جهة لعرض بنودها</div>
            <div style={{ background: "#fff", border: "1px solid rgba(16,35,28,.07)", borderRadius: 18, padding: 8, boxShadow: "0 10px 28px -22px rgba(16,35,28,.2)" }}>
              {view.authorities.map((a) => {
                const col = authColor(a.score), open = authority === a.key;
                return (
                  <div key={a.key} onClick={() => setAuthority(open ? null : a.key)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 14px", borderRadius: 12, cursor: "pointer", transition: "background .2s ease", background: open ? "rgba(0,158,106,.05)" : "transparent" }}>
                    <div style={{ flex: "0 1 220px", minWidth: 150 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#10231C", lineHeight: 1.4 }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: "#8A968F", marginTop: 2 }}>{a.short}</div>
                    </div>
                    <div style={{ flex: "1 1 130px", height: 8, borderRadius: 6, background: "rgba(16,35,28,.07)", overflow: "hidden", minWidth: 100 }}>
                      <div style={{ height: "100%", width: `${a.score}%`, borderRadius: 6, background: col, transition: "width 1s ease" }} />
                    </div>
                    <div style={{ flex: "none", display: "flex", alignItems: "baseline", width: 52, justifyContent: "flex-start" }}>
                      <span className="mono" style={{ fontSize: 19, fontWeight: 700, color: col }}>{a.score}</span>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: col }}>%</span>
                    </div>
                    <div style={{ flex: "none", color: "#8A968F", transform: open ? "rotate(-90deg)" : "none", transition: "transform .2s ease" }}><Ic s={17} sw={2.2} d={["m15 18-6-6 6-6"]} /></div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, padding: "11px 15px", borderRadius: 12, background: "rgba(0,158,106,.06)", border: "1px solid rgba(0,158,106,.14)" }}>
              <Ic s={15} sw={2} c="#009E6A" d={["M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z", "m9 12 2 2 4-4"]} />
              <span style={{ fontSize: 12.5, color: "#0B3D2E", lineHeight: 1.6 }}>يستند هذا التقييم إلى أحدث الأنظمة المفهرسة لدى الجهات التنظيمية المدعومة.</span>
            </div>

            {authority && (
              <div style={{ marginTop: 16, background: "#fff", border: "1px solid rgba(0,158,106,.25)", borderRadius: 20, padding: "20px 22px", boxShadow: "0 18px 44px -28px rgba(0,158,106,.45)", animation: "fadeUp .35s ease both" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: authColor(view.authorities.find((x) => x.key === authority)?.score ?? 0), boxShadow: `0 0 0 4px ${authColor(view.authorities.find((x) => x.key === authority)?.score ?? 0)}22` }} />
                    <div style={{ fontSize: 15.5, fontWeight: 700 }}>بنود {AUTH[authority]?.name ?? authority}</div>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: "#5A6B64", background: "rgba(16,35,28,.05)", padding: "3px 9px", borderRadius: 7 }}>{view.findings.filter((f) => f.auth === authority).length} بند</span>
                  </div>
                  <button onClick={() => setAuthority(null)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 11, border: "1px solid rgba(16,35,28,.12)", background: "#fff", color: "#5A6B64", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>إغلاق <Ic s={13} sw={2.4} d={["M18 6 6 18M6 6l12 12"]} /></button>
                </div>
                <FindingsGrid findings={view.findings.filter((f) => f.auth === authority)} onOpen={setDrawerId} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== DRAWER ===================== */}
      {drawerF && (
        <>
          <div onClick={() => setDrawerId(null)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(6,28,21,.4)", backdropFilter: "blur(3px)", animation: "blurIn .3s ease both" }} />
          <aside style={{ position: "fixed", top: 0, insetInlineStart: 0, height: "100%", width: "min(520px,94vw)", zIndex: 61, background: "#F7FAF8", boxShadow: "12px 0 44px -18px rgba(6,28,21,.4)", overflowY: "auto", animation: "fadeUp .35s ease both" }}>
            <div style={{ height: 4, background: SINFO[drawerF.status].c }} />
            <div style={{ padding: "26px 28px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, padding: "5px 12px", borderRadius: 8, color: SINFO[drawerF.status].c, background: SINFO[drawerF.status].bg, border: `1px solid ${SINFO[drawerF.status].bd}` }}>{SINFO[drawerF.status].l}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: "#5A6B64", background: "rgba(16,35,28,.05)", padding: "5px 11px", borderRadius: 8 }}>{drawerF.authorityShort}</span>
                </div>
                <button onClick={() => setDrawerId(null)} style={{ flex: "none", width: 34, height: 34, borderRadius: 11, border: "1px solid rgba(16,35,28,.12)", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic s={16} sw={2.2} c="#5A6B64" d={["M18 6 6 18M6 6l12 12"]} /></button>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 14, lineHeight: 1.4, color: "#10231C" }}>{drawerF.title}</div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 22 }}>
                {[
                  { label: "السبب", text: drawerF.reason, c: "#009E6A", d: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 8v4M12 16h.01"] },
                  { label: "الدليل من وثيقتك", text: drawerF.evidenceDoc, c: "#C6A34F", d: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6"] },
                  { label: "الدليل من النظام", text: drawerF.evidenceReg, c: "#009E6A", d: ["M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"] },
                  ...(drawerF.status !== "compliant" ? [
                    { label: "تحليل الفجوة", text: drawerF.gap, c: "#E5484D", d: ["M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z", "M12 9v4M12 17h.01"] },
                    { label: "التوصية", text: drawerF.rec, c: "#009E6A", d: ["m9 12 2 2 4-4", "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"] },
                    { label: "التحسين المقترح", text: drawerF.improve, c: "#0B3D2E", d: ["M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4"] },
                  ] : []),
                ].filter((b) => b.text).map((b, i) => (
                  <div key={i}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ color: b.c }}><Ic s={16} sw={2} c={b.c} d={b.d} /></span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#0B3D2E" }}>{b.label}</span>
                    </div>
                    <div style={{ fontSize: 13.5, lineHeight: 1.75, color: "#3A4A44", marginTop: 7, paddingInlineStart: 25 }}>{b.text}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 22, padding: 16, borderRadius: 14, background: "rgba(0,158,106,.06)", border: "1px solid rgba(0,158,106,.16)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, fontWeight: 700, color: "#0B3D2E" }}>
                  <Ic s={14} sw={2} c="#009E6A" d={["M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"]} />المرجع الرسمي
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0B3D2E", marginTop: 8, lineHeight: 1.6 }}>
                  {drawerF.sourceUrl ? <a href={drawerF.sourceUrl} target="_blank" rel="noreferrer">{drawerF.ref}</a> : drawerF.ref}
                </div>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function FindingsGrid({ findings, onOpen }: { findings: VF[]; onOpen: (id: string) => void }) {
  if (!findings.length) {
    return (
      <div style={{ textAlign: "center", padding: "50px 20px", background: "#fff", border: "1px solid rgba(16,35,28,.07)", borderRadius: 20 }}>
        <div style={{ width: 52, height: 52, margin: "0 auto", borderRadius: 16, background: "rgba(18,161,80,.1)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic s={26} sw={2.2} c="#12A150" d={["m9 12 2 2 4-4", "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"]} /></div>
        <div style={{ fontSize: 15, fontWeight: 600, marginTop: 14 }}>لا توجد بنود ضمن هذا التصنيف</div>
        <div style={{ fontSize: 13, color: "#5A6B64", marginTop: 6 }}>جرّب تصنيفاً آخر لعرض النتائج</div>
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,300px),1fr))", gap: 16 }}>
      {findings.map((g) => {
        const si = SINFO[g.status];
        return (
          <div key={g.id} style={{ position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", background: "#fff", border: "1px solid rgba(16,35,28,.07)", borderRadius: 18, padding: "18px 20px", boxShadow: "0 10px 30px -22px rgba(16,35,28,.22)" }}>
            <div style={{ position: "absolute", top: 0, insetInline: 0, height: 3, background: si.c }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 8, color: si.c, background: si.bg, border: `1px solid ${si.bd}` }}>{si.l}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#5A6B64" }}>{g.authorityShort}</span>
            </div>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: "#10231C", marginTop: 14, lineHeight: 1.45 }}>{g.title}</div>
            <div style={{ fontSize: 13, color: "#5A6B64", lineHeight: 1.7, marginTop: 8 }}>{g.desc}</div>
            <button onClick={() => onOpen(g.id)} onMouseDown={addRipple} style={{ position: "relative", overflow: "hidden", display: "inline-flex", alignItems: "center", gap: 7, marginTop: 16, padding: "9px 15px", border: "1px solid rgba(16,35,28,.12)", borderRadius: 11, background: "#fff", color: "#10231C", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}>
              عرض التفاصيل <Ic s={13} sw={2.4} d={["m15 18-6-6 6-6"]} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

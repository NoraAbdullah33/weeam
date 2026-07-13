"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Orb, addRipple } from "./Orb";
import { useLang } from "./i18n";
import { LangToggle } from "./LangToggle";

function magMove(e: React.MouseEvent<HTMLElement>) {
  const t = e.currentTarget;
  const r = t.getBoundingClientRect();
  t.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.22}px,${(e.clientY - r.top - r.height / 2) * 0.32}px)`;
}
function magLeave(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.transform = "translate(0,0)";
}

export function Landing({
  onStart, files, onAddFiles, onRemove, busy,
}: {
  onStart: () => void;
  files: File[];
  onAddFiles: (f: FileList | null) => void;
  onRemove: (i: number) => void;
  busy?: boolean;
}) {
  const { t, dir } = useLang();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: "blur(8px)" }}
      transition={{ duration: 0.6 }}
      style={{ position: "relative", zIndex: 5, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "40px 24px", gap: 26 }}
    >
      <div style={{ position: "fixed", top: 20, [dir === "rtl" ? "left" : "right"]: 20, zIndex: 40 } as React.CSSProperties}>
        <LangToggle />
      </div>

      <Orb size={220} />

      <div className="anim-fadeUp" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div className="wordmark" style={{ fontSize: "clamp(52px,9vw,96px)", fontWeight: 700, lineHeight: 0.95, letterSpacing: "-.02em" }}>واءم</div>
        <div style={{ fontSize: "clamp(14px,2.2vw,19px)", fontWeight: 500, color: "#13E09B", letterSpacing: ".04em" }}>
          {t("مساعد الامتثال الحوكمي بالذكاء الاصطناعي", "AI Governance Compliance Assistant")}
        </div>
        <div style={{ maxWidth: 560, fontSize: "clamp(15px,2.4vw,21px)", lineHeight: 1.6, color: "rgba(248,250,252,.72)", fontWeight: 300, marginTop: 6 }}>
          {t(
            "ارفع أي سياسة أو إجراء أو وثيقة حوكمة — ونقارنها آلياً مع الأنظمة السعودية الرسمية (DGA · NCA · NDMO).",
            "Upload any policy, procedure or governance document — we compare it against official Saudi regulations (DGA · NCA · NDMO)."
          )}
        </div>
      </div>

      {/* Upload area */}
      <div className="anim-fadeUp" style={{ width: "min(540px,92vw)", display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); onAddFiles(e.dataTransfer.files); }}
          style={{
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
            padding: "18px 22px", borderRadius: 18,
            border: `1px dashed ${drag ? "rgba(19,224,155,.7)" : "rgba(19,224,155,.28)"}`,
            background: drag ? "rgba(0,194,122,.10)" : "rgba(255,255,255,.03)",
            transition: "all .25s ease", backdropFilter: "blur(10px)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#13E09B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></svg>
          <span style={{ fontSize: 14, color: "rgba(248,250,252,.75)", fontWeight: 500 }}>
            {t("اسحب وأفلت وثيقتك هنا", "Drag & drop your document")} <span style={{ color: "rgba(248,250,252,.4)" }}>· PDF · DOCX</span>
          </span>
          <input ref={inputRef} type="file" multiple accept=".pdf,.docx" style={{ display: "none" }} onChange={(e) => onAddFiles(e.target.files)} />
        </div>

        {files.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {files.map((f, i) => (
              <motion.div key={f.name + i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 13px", borderRadius: 12, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.09)" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#13E09B" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
                <span style={{ flex: 1, textAlign: "start", fontSize: 12.5, color: "#F8FAFC", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                <button onClick={(e) => { e.stopPropagation(); onRemove(i); }} style={{ border: "none", background: "transparent", cursor: "pointer", color: "rgba(248,250,252,.5)", display: "flex" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="anim-fadeUp" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <button
          onClick={onStart} onMouseMove={magMove} onMouseLeave={magLeave} onMouseDown={addRipple} disabled={busy}
          style={{ position: "relative", overflow: "hidden", display: "inline-flex", alignItems: "center", gap: 12, padding: "17px 38px", border: "1px solid rgba(19,224,155,.4)", borderRadius: 18, background: "linear-gradient(135deg,rgba(0,194,122,.95),rgba(19,224,155,.9))", color: "#04140E", fontFamily: "inherit", fontSize: 17, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1, boxShadow: "0 0 0 1px rgba(255,255,255,.06),0 20px 50px -14px rgba(0,194,122,.7)", transition: "transform .25s cubic-bezier(.22,1,.36,1),box-shadow .25s ease" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#04140E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 3 14 9-14 9V3z" /></svg>
          {t("تحليل الامتثال", "Analyze compliance")}
        </button>
        <div style={{ fontSize: 12.5, color: "rgba(248,250,252,.4)" }}>
          {files.length
            ? t(`${files.length} وثيقة جاهزة`, `${files.length} document(s) ready`)
            : t("مقارنة آلية مع الأنظمة السعودية الرسمية عبر RAG", "Automatic RAG comparison against official Saudi regulations")}
        </div>
      </div>
    </motion.section>
  );
}

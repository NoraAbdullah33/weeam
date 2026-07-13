"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Orb } from "./Orb";

const STEPC = ["#00C27A", "#13E09B", "#F0C75E", "#3AD8C0", "#00C27A", "#13E09B", "#F0C75E", "#FF6B5A", "#13E09B", "#00C27A"];
const ABSORB = [
  { ext: "PDF", tx: "120px", ty: "40px" },
  { ext: "DOCX", tx: "-120px", ty: "50px" },
  { ext: "PDF", tx: "110px", ty: "-70px" },
  { ext: "DOCX", tx: "-110px", ty: "-60px" },
];

export function Thinking({ steps, onDone }: { steps: string[]; onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const orbGlow = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let i = 0;
    const ti = setInterval(() => {
      i++;
      if (i < steps.length) {
        setIdx(i);
        const g = orbGlow.current;
        if (g) g.style.background = `radial-gradient(circle,${STEPC[i]}88,transparent 60%)`;
      }
    }, 560);
    const done = setTimeout(() => { clearInterval(ti); onDone(); }, 5900);
    return () => { clearInterval(ti); clearTimeout(done); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length]);

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: "relative", zIndex: 5, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", gap: 34 }}
    >
      <div style={{ position: "relative", width: 300, height: 300 }}>
        <Orb size={300} fast glowRef={orbGlow} />
        {ABSORB.map((d, i) => (
          <div key={i} style={{ position: "absolute", top: "50%", left: "50%", margin: "-16px 0 0 -22px", width: 44, height: 32, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.18)", color: "#13E09B", fontFamily: "var(--font-geist-mono),monospace", fontSize: 9, fontWeight: 700, ["--tx" as string]: d.tx, ["--ty" as string]: d.ty, animation: `docAbsorb 2.2s ease-in ${i * 0.5}s infinite` }}>
            {d.ext}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#13E09B", letterSpacing: ".14em", textTransform: "uppercase" }}>WAAEM · RAG COMPLIANCE</div>
        <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ fontSize: "clamp(22px,4vw,30px)", fontWeight: 700, color: "#F8FAFC", minHeight: 40 }}>
          {steps[idx]}
        </motion.div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 9, width: "min(420px,92vw)" }}>
        {steps.map((s, i) => {
          const done = i < idx, active = i === idx;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 14px", borderRadius: 12, transition: "all .4s ease", background: active ? "rgba(0,194,122,.12)" : "transparent", border: `1px solid ${active ? "rgba(0,194,122,.28)" : "transparent"}`, opacity: done ? 0.55 : active ? 1 : 0.28 }}>
              <span style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", fontSize: 11, fontWeight: 700, color: "#04140E", background: done ? "#13E09B" : active ? "#00C27A" : "rgba(255,255,255,.12)", boxShadow: active ? "0 0 12px rgba(0,194,122,.8)" : "none", animation: active ? "glowPulse 1.2s ease-in-out infinite" : "none" }}>
                {done ? "✓" : ""}
              </span>
              <span style={{ fontSize: 14, fontWeight: active ? 600 : 400, color: active ? "#F8FAFC" : "rgba(248,250,252,.8)" }}>{s}</span>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}

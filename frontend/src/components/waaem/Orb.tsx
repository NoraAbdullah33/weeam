"use client";

import { forwardRef } from "react";

/** The living WAAEM orb. `fast` speeds up rotation/breathing for the thinking phase. */
export const Orb = forwardRef<HTMLDivElement, { size?: number; fast?: boolean; glowRef?: React.Ref<HTMLDivElement> }>(
  function Orb({ size = 240, fast = false, glowRef }, ref) {
    const spin = fast ? 4 : 9;
    const breathe = fast ? 2.4 : 5;
    const inset = Math.round(size * 0.092);
    return (
      <div ref={ref} style={{ position: "relative", width: size, height: size, animation: `orbFloat 7s ease-in-out infinite` }}>
        <div style={{ position: "absolute", inset: -Math.round(size * 0.19), borderRadius: "50%", background: "radial-gradient(circle,rgba(0,194,122,.55),transparent 62%)", filter: "blur(34px)", animation: `breatheGlow ${breathe}s ease-in-out infinite` }} />
        {glowRef && <div ref={glowRef} style={{ position: "absolute", inset: -Math.round(size * 0.12), borderRadius: "50%", background: "radial-gradient(circle,rgba(19,224,155,.5),transparent 60%)", filter: "blur(28px)", transition: "background .6s ease" }} />}
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "conic-gradient(from 0deg,#00C27A,#13E09B,#F0C75E,#13E09B,#00C27A)", mask: "radial-gradient(farthest-side,transparent calc(100% - 10px),#000 calc(100% - 9px))", WebkitMask: "radial-gradient(farthest-side,transparent calc(100% - 10px),#000 calc(100% - 9px))", animation: `spin ${spin}s linear infinite`, opacity: 0.88 }} />
        <div style={{ position: "absolute", inset, borderRadius: "50%", background: "radial-gradient(circle at 34% 28%,#3affbf,#00C27A 42%,#05392a 100%)", boxShadow: "inset 0 -18px 40px rgba(0,0,0,.5),inset 0 12px 30px rgba(255,255,255,.25),0 0 60px rgba(0,194,122,.5)", animation: `breathe ${breathe}s ease-in-out infinite` }} />
        <div style={{ position: "absolute", top: "20%", left: "26%", width: "38%", height: "26%", borderRadius: "50%", background: "radial-gradient(circle,rgba(255,255,255,.7),transparent 70%)", filter: "blur(6px)" }} />
        <div style={{ position: "absolute", inset, borderRadius: "50%", border: "1px solid rgba(255,255,255,.16)", animation: `pulseRing ${fast ? 2 : 3.4}s ease-out infinite` }} />
        <div style={{ position: "absolute", inset: 0, animation: "spin 14s linear infinite" }}>
          <span style={{ position: "absolute", top: -4, left: "50%", width: 8, height: 8, borderRadius: "50%", background: "#13E09B", boxShadow: "0 0 12px #13E09B" }} />
        </div>
        <div style={{ position: "absolute", inset: 0, animation: "spinRev 10s linear infinite" }}>
          <span style={{ position: "absolute", bottom: 6, left: "24%", width: 6, height: 6, borderRadius: "50%", background: "#F0C75E", boxShadow: "0 0 12px #F0C75E" }} />
        </div>
      </div>
    );
  }
);

/** Material ripple on click — attaches a span to the target. */
export function addRipple(e: React.MouseEvent<HTMLElement>) {
  const t = e.currentTarget;
  const r = t.getBoundingClientRect();
  const size = Math.max(r.width, r.height);
  const s = document.createElement("span");
  s.style.cssText = `position:absolute;border-radius:50%;background:rgba(255,255,255,.28);pointer-events:none;transform:scale(0);animation:ripple .6s ease-out;width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
  if (getComputedStyle(t).position === "static") t.style.position = "relative";
  t.appendChild(s);
  setTimeout(() => s.remove(), 620);
}

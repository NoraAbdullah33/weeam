"use client";

import { useEffect, useMemo, useRef } from "react";

const NOISE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

export function Background() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  // Deterministic star field (SSR-safe)
  const stars = useMemo(() => {
    const rnd = (i: number, s: number) => {
      const v = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453;
      return v - Math.floor(v);
    };
    return Array.from({ length: 34 }, (_, i) => ({
      x: rnd(i, 1) * 100,
      y: rnd(i, 2) * 100,
      s: rnd(i, 3) * 2 + 1,
      d: (rnd(i, 4) * 3).toFixed(2),
      dur: (2 + rnd(i, 5) * 3).toFixed(2),
    }));
  }, []);

  // Cursor glow
  useEffect(() => {
    const mm = (e: PointerEvent) => {
      const g = glowRef.current;
      if (g) g.style.transform = `translate(${e.clientX - 320}px,${e.clientY - 320}px)`;
    };
    window.addEventListener("pointermove", mm, { passive: true });
    return () => window.removeEventListener("pointermove", mm);
  }, []);

  // Particle network
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let w = 0, h = 0, raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = c.offsetWidth; h = c.offsetHeight;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const N = 52;
    const P = Array.from({ length: N }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.24, vy: (Math.random() - 0.5) * 0.24,
      r: Math.random() * 1.5 + 0.5,
    }));
    const loop = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of P) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.29);
        ctx.fillStyle = "rgba(19,224,155,.45)"; ctx.fill();
      }
      for (let i = 0; i < N; i++)
        for (let j = i + 1; j < N; j++) {
          const a = P[i], b = P[j], dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
          if (d < 120) {
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = "rgba(0,194,122," + 0.13 * (1 - d / 120) + ")";
            ctx.lineWidth = 1; ctx.stroke();
          }
        }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-15%", right: "-10%", width: "60vw", height: "60vw", background: "radial-gradient(circle,rgba(0,194,122,.28),transparent 60%)", filter: "blur(30px)", animation: "meshA 24s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: "-25%", left: "-12%", width: "55vw", height: "55vw", background: "radial-gradient(circle,rgba(19,224,155,.18),transparent 60%)", filter: "blur(36px)", animation: "meshB 30s ease-in-out infinite" }} />
        <div style={{ position: "absolute", top: "30%", left: "30%", width: "36vw", height: "36vw", background: "radial-gradient(circle,rgba(240,199,94,.10),transparent 62%)", filter: "blur(40px)", animation: "meshA 34s ease-in-out infinite" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px)", backgroundSize: "52px 52px", maskImage: "radial-gradient(ellipse 85% 70% at 50% 40%,#000 20%,transparent 80%)", WebkitMaskImage: "radial-gradient(ellipse 85% 70% at 50% 40%,#000 20%,transparent 80%)" }} />
        {stars.map((s, i) => (
          <span key={i} style={{ position: "absolute", left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, borderRadius: "50%", background: "#F8FAFC", animation: `twinkle ${s.dur}s ease-in-out ${s.d}s infinite` }} />
        ))}
        <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.85 }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 120% 80% at 50% 120%,rgba(8,28,21,0),rgba(4,16,11,.85))" }} />
        <div style={{ position: "absolute", inset: 0, opacity: 0.05, mixBlendMode: "overlay", backgroundImage: `url("${NOISE}")` }} />
      </div>
      <div ref={glowRef} style={{ position: "fixed", top: 0, left: 0, width: 640, height: 640, zIndex: 1, pointerEvents: "none", mixBlendMode: "screen", background: "radial-gradient(circle,rgba(0,194,122,.14),transparent 60%)", willChange: "transform" }} />
    </>
  );
}

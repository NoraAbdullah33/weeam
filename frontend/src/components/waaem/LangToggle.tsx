"use client";

import { useLang } from "./i18n";

export function LangToggle() {
  const { lang, toggle } = useLang();
  return (
    <button
      onClick={toggle}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 13px", borderRadius: 999,
        background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.12)", backdropFilter: "blur(10px)",
        color: "rgba(248,250,252,.85)", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
      }}
      aria-label="Switch language"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#13E09B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6" /></svg>
      {lang === "ar" ? "English" : "العربية"}
    </button>
  );
}

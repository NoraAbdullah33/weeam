"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Lang = "ar" | "en";

interface Ctx {
  lang: Lang;
  dir: "rtl" | "ltr";
  toggle: () => void;
  t: (ar: string, en: string) => string;
}

const LangCtx = createContext<Ctx | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("ar");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("waaem-lang")) as Lang | null;
    if (saved === "ar" || saved === "en") setLang(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    if (typeof window !== "undefined") localStorage.setItem("waaem-lang", lang);
  }, [lang]);

  const toggle = useCallback(() => setLang((p) => (p === "ar" ? "en" : "ar")), []);
  const t = useCallback((ar: string, en: string) => (lang === "ar" ? ar : en), [lang]);

  return <LangCtx.Provider value={{ lang, dir: lang === "ar" ? "rtl" : "ltr", toggle, t }}>{children}</LangCtx.Provider>;
}

export function useLang() {
  const c = useContext(LangCtx);
  if (!c) throw new Error("useLang must be used within LangProvider");
  return c;
}

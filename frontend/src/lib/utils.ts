import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Pick the localized string from a { ar, en } bilingual field. */
export function loc(field: { ar: string; en: string } | undefined, lang: "ar" | "en") {
  if (!field) return "";
  return field[lang] ?? field.en ?? field.ar;
}

/** Map a 0-100 score to a semantic color. */
export function scoreColor(score: number | null | undefined) {
  if (score == null) return "#9aa5a0";
  if (score >= 75) return "#12a67a";
  if (score >= 60) return "#b7902e";
  if (score >= 45) return "#d98a1f";
  return "#e0484d";
}

export function scoreTone(score: number | null | undefined): "ok" | "gold" | "warn" | "danger" | "muted" {
  if (score == null) return "muted";
  if (score >= 75) return "ok";
  if (score >= 60) return "gold";
  if (score >= 45) return "warn";
  return "danger";
}

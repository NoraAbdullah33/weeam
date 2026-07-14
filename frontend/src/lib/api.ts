import type { ComplianceReport } from "./types";

// Fully self-contained: the API routes under /api/* run inside this Next.js app
// (see src/app/api/*), so there is no external backend to configure.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store", ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || `API ${path} failed: ${res.status}`);
  }
  return data as T;
}

export interface UploadResult {
  document_ids: string[];
  documents: { id: string; filename: string; ext: string; pages: number; size_kb: number }[];
}

export interface AnalyzeResult {
  analysis_id: string;
  status: string;
  source: string;
  result: ComplianceReport;
}

export const api = {
  upload: (files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    return jsonFetch<UploadResult>("/api/upload", { method: "POST", body: fd });
  },
  analyze: (documentIds: string[]) =>
    jsonFetch<AnalyzeResult>("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_ids: documentIds }),
    }),
};

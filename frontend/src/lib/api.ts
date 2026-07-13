import type { ComplianceReport, KBStatus } from "./types";

// Same-origin: Next.js rewrites /api/* to the FastAPI backend (see next.config.ts).
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

export const api = {
  upload: (files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    return jsonFetch<UploadResult>("/api/upload", { method: "POST", body: fd });
  },
  analyze: (documentIds: string[]) =>
    jsonFetch<{ analysis_id: string; status: string; source: string }>("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_ids: documentIds }),
    }),
  result: (analysisId: string) =>
    jsonFetch<{ analysis_id: string; status: string; source: string; result: ComplianceReport }>(
      `/api/result/${analysisId}`
    ),
  kbStatus: () => jsonFetch<KBStatus>("/api/kb/status"),
  aiStatus: () => jsonFetch<{ online: boolean; model: string; kb_chunks: number }>("/api/ai/status"),
};

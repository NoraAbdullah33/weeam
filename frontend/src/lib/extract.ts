// Server-side document text extraction (Node runtime).
// PDF via unpdf (serverless-friendly pdf.js build), DOCX via mammoth, plus a
// plain-text fallback. No native binaries — runs on Vercel's Node functions.
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

export interface Extracted {
  filename: string;
  ext: string;
  pages: number;
  text: string;
}

// Cap stored text so the self-contained token carried to /api/analyze stays small.
const MAX_TEXT_CHARS = 120_000;

function extFromName(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

async function extractPdf(buf: Uint8Array): Promise<{ text: string; pages: number }> {
  const pdf = await getDocumentProxy(buf);
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  return { text: (text || "").trim(), pages: totalPages || 1 };
}

async function extractDocx(buf: Buffer): Promise<{ text: string; pages: number }> {
  const { value } = await mammoth.extractRawText({ buffer: buf });
  const text = (value || "").trim();
  // DOCX has no fixed page count — estimate for display (~1800 chars/page).
  const pages = Math.max(1, Math.round(text.length / 1800));
  return { text, pages };
}

/** Extract text from an uploaded file. Throws on unsupported/empty content. */
export async function extractFile(file: File): Promise<Extracted> {
  const ext = extFromName(file.name);
  const bytes = new Uint8Array(await file.arrayBuffer());

  let out: { text: string; pages: number };
  if (ext === "pdf") {
    out = await extractPdf(bytes);
  } else if (ext === "docx") {
    out = await extractDocx(Buffer.from(bytes));
  } else if (ext === "txt" || ext === "md") {
    const text = Buffer.from(bytes).toString("utf8").trim();
    out = { text, pages: Math.max(1, Math.round(text.length / 1800)) };
  } else {
    throw new Error("نوع الملف غير مدعوم. الرجاء رفع ملفات PDF أو DOCX.");
  }

  if (!out.text) {
    throw new Error("لا يوجد نص قابل للتحليل في الوثيقة المرفوعة.");
  }

  return {
    filename: file.name,
    ext: ext || "pdf",
    pages: out.pages,
    text: out.text.slice(0, MAX_TEXT_CHARS),
  };
}

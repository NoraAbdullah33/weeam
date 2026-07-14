// POST /api/upload — receive files, extract text, return self-contained tokens.
// Runs entirely on the frontend's own serverless runtime; no backend required.
import { type NextRequest, NextResponse } from "next/server";

import { extractFile } from "@/lib/extract";
import { encodeDoc } from "@/lib/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vercel serverless functions cap the request body at ~4.5 MB, so keep uploads
// comfortably under that and fail with a clear Arabic message otherwise.
const MAX_UPLOAD_MB = 4;

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ success: false, message: "تعذّر قراءة الملفات المرفوعة." }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return NextResponse.json({ success: false, message: "لم يتم رفع أي ملفات." }, { status: 400 });
  }

  const maxBytes = MAX_UPLOAD_MB * 1024 * 1024;
  const document_ids: string[] = [];
  const documents: { id: string; filename: string; ext: string; pages: number; size_kb: number }[] = [];

  try {
    for (const file of files) {
      if (file.size > maxBytes) {
        return NextResponse.json(
          { success: false, message: `حجم الملف يتجاوز ${MAX_UPLOAD_MB} ميجابايت. الرجاء رفع ملف أصغر.` },
          { status: 413 },
        );
      }
      const doc = await extractFile(file);
      const token = encodeDoc({ n: doc.filename, p: doc.pages, t: doc.text });
      document_ids.push(token);
      documents.push({
        id: token.slice(0, 12),
        filename: doc.filename,
        ext: doc.ext,
        pages: doc.pages,
        size_kb: Math.max(1, Math.round(file.size / 1024)),
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "تعذّر معالجة الوثيقة المرفوعة.";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }

  return NextResponse.json({ document_ids, documents });
}

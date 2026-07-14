// POST /api/analyze — decode the document tokens, run the RAG + Llama Saudi
// governance compliance engine, and return the full report in one call.
// Stateless: the report is returned directly (no separate /api/result round-trip).
import { type NextRequest, NextResponse } from "next/server";

import { analyzeText } from "@/lib/analysis";
import { LlmError, LlmNotConfiguredError } from "@/lib/llm";
import { decodeDoc } from "@/lib/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Groq-Llama judgment is a single fast call, but allow headroom on Vercel.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { document_ids?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "طلب غير صالح." }, { status: 400 });
  }

  const ids = Array.isArray(body.document_ids) ? body.document_ids.filter((x): x is string => typeof x === "string") : [];
  if (ids.length === 0) {
    return NextResponse.json(
      { success: false, message: "الرجاء رفع وثيقة واحدة على الأقل قبل التحليل." },
      { status: 422 },
    );
  }

  let combined = "";
  const names: string[] = [];
  try {
    for (const id of ids) {
      const doc = decodeDoc(id);
      if (doc.t) combined += (combined ? "\n\n" : "") + doc.t;
      if (doc.n) names.push(doc.n);
    }
  } catch {
    return NextResponse.json(
      { success: false, message: "تعذّر قراءة الوثائق. الرجاء إعادة رفعها ثم التحليل." },
      { status: 400 },
    );
  }

  if (!combined.trim()) {
    return NextResponse.json(
      { success: false, message: "لا يوجد نص قابل للتحليل في الوثائق المرفوعة." },
      { status: 400 },
    );
  }

  // The compliance verdict is produced solely by Llama (RAG-grounded). There is
  // no keyword/similarity fallback: if the model can't judge, we return an
  // honest error instead of a fabricated score.
  let result;
  try {
    result = await analyzeText(combined, names);
  } catch (e) {
    if (e instanceof LlmNotConfiguredError) {
      return NextResponse.json(
        {
          success: false,
          message:
            "خدمة التحليل بالذكاء الاصطناعي غير مُهيأة: لم يتم ضبط مفتاح Groq (GROQ_API_KEY) في إعدادات النشر.",
        },
        { status: 503 },
      );
    }
    const detail = e instanceof LlmError ? e.message : e instanceof Error ? e.message : "";
    console.error("analyze failed:", detail);
    return NextResponse.json(
      {
        success: false,
        message: "تعذّر إكمال التحليل بالذكاء الاصطناعي (Llama) حالياً. يرجى إعادة المحاولة بعد قليل.",
      },
      { status: 503 },
    );
  }

  // A short, human-readable analysis id (the report travels with the response).
  const analysis_id = `wa-${result.overall_compliance}-${combined.length.toString(36)}`;

  return NextResponse.json({ analysis_id, status: "completed", source: result.engine, result });
}

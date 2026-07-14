import { type NextRequest } from "next/server";

// Runtime reverse-proxy for the FastAPI backend.
//
// The whole app is served from a single origin: the browser only ever calls the
// frontend's own `/api/*`, and this handler forwards each request to the backend
// server-side (so there are no CORS issues). Unlike a build-time `rewrites()`
// entry — whose destination is frozen at build and, when unset, silently points
// at `127.0.0.1:8000` and gets dropped by the host so `/api/*` 404s — this reads
// `BACKEND_URL` at request time and fails loudly with an actionable message.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Backend base URL (no trailing slash), or null when not configured. */
function backendBase(): string | null {
  const raw = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "";
  const trimmed = raw.trim().replace(/\/+$/, "");
  return trimmed || null;
}

// Hop-by-hop / encoding headers that must not be copied verbatim when proxying.
const STRIP_REQUEST = ["host", "connection", "content-length"];
const STRIP_RESPONSE = ["content-encoding", "content-length", "transfer-encoding", "connection"];

async function proxy(req: NextRequest, path: string[]): Promise<Response> {
  const base = backendBase();
  if (!base) {
    // Misconfiguration — surface it instead of an opaque 404 so the operator
    // knows to set BACKEND_URL (see DEPLOYMENT.md §A).
    return Response.json(
      {
        success: false,
        message:
          "الخادم غير مُهيّأ بعد: لم يتم ضبط عنوان الواجهة الخلفية (BACKEND_URL). راجع دليل النشر.",
      },
      { status: 503 },
    );
  }

  const target = `${base}/api/${path.join("/")}${req.nextUrl.search}`;

  const headers = new Headers(req.headers);
  for (const h of STRIP_REQUEST) headers.delete(h);

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  // Buffer the body (uploads are capped at MAX_UPLOAD_MB) — reliable across
  // runtimes and avoids half-duplex streaming caveats for multipart uploads.
  const body = hasBody ? await req.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return Response.json(
      { success: false, message: "تعذّر الوصول إلى الخادم الخلفي. حاول مرة أخرى لاحقاً." },
      { status: 502 },
    );
  }

  // `upstream.body` is already content-decoded by fetch, so drop the encoding /
  // length headers that would otherwise describe the original compressed bytes.
  const resHeaders = new Headers(upstream.headers);
  for (const h of STRIP_RESPONSE) resHeaders.delete(h);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: resHeaders,
  });
}

type Ctx = { params: Promise<{ path: string[] }> };
const handler = async (req: NextRequest, ctx: Ctx): Promise<Response> => {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
export const HEAD = handler;

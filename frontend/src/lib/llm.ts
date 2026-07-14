// Groq-hosted Llama client (runs from the Next.js serverless runtime on Vercel).
//
// The compliance verdict is produced solely by Llama. There is NO similarity /
// keyword fallback score: if the model can't be reached, we throw and the API
// surfaces an honest error rather than a fabricated number.

const GROQ_BASE_URL = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_MAX_RETRIES = Number(process.env.GROQ_MAX_RETRIES || "5");

/** Raised when no Groq key is configured — the caller returns an honest error. */
export class LlmNotConfiguredError extends Error {
  constructor() {
    super("GROQ_API_KEY is not set");
    this.name = "LlmNotConfiguredError";
  }
}

/** Raised when the Groq call fails (rate-limited past retries, bad key, etc.). */
export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmError";
  }
}

export function isLlmConfigured(): boolean {
  return Boolean((process.env.GROQ_API_KEY || "").trim());
}

export function llmModel(): string {
  return GROQ_MODEL;
}

/** Seconds to wait before retrying a 429: prefer Retry-After, then Groq's
 *  "try again in Xs" message, else exponential backoff (all capped at 60s). */
function retryWait(res: Response, detail: string, attempt: number): number {
  const ra = res.headers.get("retry-after");
  if (ra) {
    const v = Number(ra);
    if (Number.isFinite(v)) return Math.min(60, v);
  }
  const m = detail.match(/try again in ([\d.]+)s/);
  if (m) {
    const v = Number(m[1]);
    if (Number.isFinite(v)) return Math.min(60, v + 0.5);
  }
  return Math.min(60, 3 * 2 ** attempt);
}

const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));

/**
 * Send a prompt to Groq-Llama and return the raw JSON string content.
 * Forces JSON output; retries transient 429 rate-limits with backoff.
 */
export async function llmGenerateJson(prompt: string): Promise<string> {
  const apiKey = (process.env.GROQ_API_KEY || "").trim();
  if (!apiKey) throw new LlmNotConfiguredError();

  const url = `${GROQ_BASE_URL.replace(/\/$/, "")}/chat/completions`;
  const body = JSON.stringify({
    model: GROQ_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens: 3000,
    response_format: { type: "json_object" },
  });

  let lastDetail = "";
  for (let attempt = 0; attempt <= GROQ_MAX_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body,
      });
    } catch (e) {
      lastDetail = e instanceof Error ? e.message : String(e);
      // network hiccup — brief backoff then retry
      if (attempt < GROQ_MAX_RETRIES) {
        await sleep(Math.min(60, 2 * 2 ** attempt));
        continue;
      }
      throw new LlmError(`Groq request failed: ${lastDetail}`);
    }

    if (res.ok) {
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new LlmError("Groq returned an empty response");
      return content;
    }

    lastDetail = (await res.text()).slice(0, 300);
    if (res.status === 429 && attempt < GROQ_MAX_RETRIES) {
      await sleep(retryWait(res, lastDetail, attempt));
      continue;
    }
    throw new LlmError(`Groq API ${res.status}: ${lastDetail}`);
  }
  throw new LlmError(`Groq rate-limited after ${GROQ_MAX_RETRIES + 1} attempts: ${lastDetail}`);
}

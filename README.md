<div align="center">

# واءم · WAAEM

### AI Governance & Compliance Platform

**Evaluate any organizational document against official Saudi regulations — using Retrieval‑Augmented Generation (RAG) and Llama.**

[![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?logo=vercel)](https://waaem.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![Groq](https://img.shields.io/badge/Groq-Llama%203.3%2070B-F55036)](https://groq.com/)

**Live:** https://waaem.vercel.app

</div>

---

WAAEM (Arabic: **واءم**, *to align/harmonize*) compares any uploaded governance document — a policy, procedure, manual, or internal regulation — against a knowledge base of official Saudi regulatory controls, and returns a structured, Arabic‑first compliance report.

It uses **Retrieval‑Augmented Generation (RAG)**: the app retrieves the relevant official requirements from its knowledge base and asks **Llama** (hosted on Groq) to **judge** the document against each one. The compliance verdict is **always the model's judgment** — never a keyword‑overlap score — so a document that merely mentions a topic is not credited, and a **genuinely non‑compliant document is judged Non‑Compliant against every authority (0%)**.

> There is **no fabricated fallback score.** If Llama can't be reached, the app returns an honest "analysis unavailable" message rather than a made‑up number.

---

## Architecture (Vercel‑native, no separate backend)

The entire app — upload, text extraction, retrieval, and Llama judgment — runs inside the **Next.js app's own serverless API routes** on **Vercel**. There is no separate backend server and no database; document text is carried statelessly between requests.

```
Browser ──▶ /api/upload   (Next.js route, Node runtime)
              └─ extract text (mammoth for .docx, unpdf for .pdf) → stateless token

Browser ──▶ /api/analyze  (Next.js route, Node runtime)
              ├─ retrieve relevant Saudi controls from the KB   (src/lib/kb.ts)
              ├─ Llama judges the doc vs each requirement (Groq) (src/lib/llm.ts)
              └─ aggregate per‑authority scores + report          (src/lib/analysis.ts)
```

| Piece | File |
|---|---|
| Knowledge base (controls + official requirement text) | [`src/lib/kb.ts`](frontend/src/lib/kb.ts) |
| Groq‑Llama client (JSON mode, 429 backoff retry) | [`src/lib/llm.ts`](frontend/src/lib/llm.ts) |
| RAG retrieval + Llama judgment + scoring | [`src/lib/analysis.ts`](frontend/src/lib/analysis.ts) |
| Upload / analyze API routes | [`src/app/api/`](frontend/src/app/api/) |

---

## How scoring works

1. **Retrieve** — rank the knowledge‑base controls (DGA, NCA, NDMO, PDPL, CST) by relevance to the uploaded document, surfacing the official requirement text as grounding.
2. **Judge** — Llama reads the document against each retrieved requirement and returns one of *Compliant / Partially Compliant / Non‑Compliant / Not Applicable*, with Arabic evidence. Mere topic overlap is explicitly **not** treated as compliance.
3. **Aggregate** — each authority's score is the mean of its controls' verdicts (Compliant = 100, Partial = 55, Non‑Compliant = 0); the overall score is the mean of the authority scores.

A non‑compliant document therefore scores **0% against every authority**; a compliant one gets differentiated per‑authority scores.

---

## Configuration

The one required setting is the Groq API key, set as a Vercel environment variable:

| Variable | Required | Purpose |
|---|---|---|
| `GROQ_API_KEY` | ✅ | Hosted Llama judgment (get a free key at [console.groq.com](https://console.groq.com/keys)). Without it, analysis returns an honest error. |
| `GROQ_MODEL` | optional | Defaults to `llama-3.3-70b-versatile`. |

---

## Regulatory authorities covered

| Authority | الجهة |
|---|---|
| **DGA** — Digital Government Authority | هيئة الحكومة الرقمية |
| **NCA** — National Cybersecurity Authority | الهيئة الوطنية للأمن السيبراني |
| **NDMO** — National Data Management Office | مكتب إدارة البيانات الوطنية |
| **PDPL** — Personal Data Protection Law | نظام حماية البيانات الشخصية |
| **CST** — Communications, Space & Technology Commission | هيئة الاتصالات والفضاء والتقنية |

Controls and their official requirement text live in [`frontend/src/lib/kb.ts`](frontend/src/lib/kb.ts) — add an entry there to extend coverage.

---

## Local development

```bash
cd frontend
npm install
echo "GROQ_API_KEY=gsk_your_key_here" > .env.local
npm run dev   # http://localhost:3000
```

---

<div align="center">

**واءم · WAAEM** — aligning organizations with Saudi regulations, intelligently.

</div>

# WAAEM — Deployment Guide

**Recommended: Vercel — the frontend is fully self-contained.** Document
extraction (PDF/DOCX) and the Saudi governance-compliance analysis run inside
the Next.js app's own `/api` routes (Node runtime), so **no separate backend is
required** to upload a document and get an Arabic compliance report. Just deploy
`frontend/` to Vercel and it works.

> **Optional heavy engine.** The repo also ships a Python **FastAPI** backend
> (PostgreSQL, ChromaDB, OCR, live-regulation retrieval + LLM) for the fullest
> analysis. It's optional — see §B/§C. The built-in engine covers the core
> upload → analyze → report flow without it.

---

## A) Frontend → Vercel  (recommended, zero-config)

1. Import the repo at [vercel.com/new](https://vercel.com/new).
2. Set **Root Directory** to `frontend` (Framework preset: Next.js — auto).
3. Deploy. Your app is live at the Vercel URL — **no environment variables
   needed.**

The browser only ever calls the app's own `/api/*` routes, which run on Vercel's
Node functions — so there are **no CORS issues** and nothing external to
configure. Uploads are capped at ~4 MB (Vercel's serverless request-body limit).

---

## B) Backend → any Docker host

The backend ships a `Dockerfile` and a `render.yaml` blueprint. On Render:

1. Render Dashboard → **New +** → **Blueprint** → connect the repo → **Apply**
   (creates `waaem-db` Postgres + `waaem-backend`).
2. `DATABASE_URL` is auto-linked and normalised to `asyncpg`; migrations run on
   boot; health check is `/api/health`.
3. Optionally set `OLLAMA_HOST` and tighten `CORS_ORIGINS` to your Vercel domain.

Copy the resulting backend URL into Vercel's `BACKEND_URL` (step A3).

---

## C) Docker Compose (single host, all-in-one)

```bash
docker compose up --build -d
docker compose exec ollama ollama pull llama3.1     # first run only
```
- Frontend: http://localhost:3000
- Backend:  http://localhost:8000  (`/api/health`, `/api/ai/status`)
- Postgres + Ollama run as services; migrations run automatically on backend boot.

Stop: `docker compose down` (add `-v` to wipe volumes).

---

## D) Meta Llama (Ollama)

- **Local / Docker:** the `ollama` service; `ollama pull llama3.1`.
- **Cloud GPU:** run Ollama on a GPU VM (RunPod, Lambda, a GPU droplet), expose
  `:11434`, and point `OLLAMA_HOST` at it.
- **No GPU?** keep `AI_ALLOW_FALLBACK=true` — the platform serves the curated
  analysis and remains fully usable end-to-end.
- **llama.cpp:** set `LLAMACPP_URL=http://host:8080` for the OpenAI-compatible
  fallback path.

## Environment variables

| Variable | Default | Notes |
| -------- | ------- | ----- |
| `DATABASE_URL` | `sqlite+aiosqlite:///./waaem.db` | Postgres in prod; `postgres://` auto-normalised |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama endpoint |
| `LLAMA_MODEL` | `llama3.1` | any pulled Llama model |
| `LLAMA_TIMEOUT` | `120` | seconds |
| `LLAMA_MAX_RETRIES` | `2` | JSON repair attempts |
| `AI_ALLOW_FALLBACK` | `true` | curated analysis when AI is unavailable |
| `LLAMACPP_URL` | *(empty)* | optional llama.cpp fallback |
| `MAX_UPLOAD_MB` | `25` | per-file limit |
| `ALLOWED_EXTENSIONS` | `pdf,docx` | accepted types |
| `CORS_ORIGINS` | `*` | comma-separated in prod |
| `BACKEND_URL` (frontend) | *(unused for the self-contained app)* | only for the optional Docker-Compose path that fronts the Python backend |

## Post-deploy smoke test
```bash
curl https://<backend>/api/health          # {"status":"healthy"}
curl https://<backend>/api/ai/status        # engine availability
# upload → analyze → result
curl -F "files=@governance.pdf" https://<backend>/api/upload
```

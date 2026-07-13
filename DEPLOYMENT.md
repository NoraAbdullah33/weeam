# WAAEM — Deployment Guide

**Recommended: Vercel (frontend) + a hosted backend.** Vercel runs the Next.js
frontend; the FastAPI backend (PostgreSQL, ChromaDB, OCR, ingestion) runs on a
container host and the frontend proxies `/api/*` to it. A single-host
**Docker Compose** path is also included.

> **Why the backend isn't on Vercel:** it needs a long-running process, a
> persistent disk for ChromaDB, and system binaries (Tesseract OCR) — none of
> which fit Vercel's serverless model. Host it on Render/Fly/Railway or any
> Docker host, then point the frontend at it.

---

## A) Frontend → Vercel  (recommended)

1. Import the repo at [vercel.com/new](https://vercel.com/new).
2. Set **Root Directory** to `frontend` (Framework preset: Next.js — auto).
3. Add an environment variable **`BACKEND_URL`** = your backend's public URL
   (e.g. `https://waaem-backend.onrender.com`). Next.js rewrites `/api/*` to it.
4. Deploy. Your app is live at the Vercel URL.

The browser only ever calls the frontend's own `/api/*`, which Vercel rewrites
to the backend server-side — so there are **no CORS issues** and the API base
never changes. See **[frontend/vercel.json](frontend/vercel.json)**.

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
| `BACKEND_URL` (frontend) | `http://127.0.0.1:8000` | proxy target |

## Post-deploy smoke test
```bash
curl https://<backend>/api/health          # {"status":"healthy"}
curl https://<backend>/api/ai/status        # engine availability
# upload → analyze → result
curl -F "files=@governance.pdf" https://<backend>/api/upload
```

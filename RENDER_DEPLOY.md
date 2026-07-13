# Deploying the WAAEM backend to Render

The **frontend deploys to Vercel** (see [DEPLOYMENT.md](DEPLOYMENT.md)); this guide
covers the **backend** (FastAPI) plus a managed **PostgreSQL** database, both
defined in [`render.yaml`](render.yaml).

## Prerequisites
- A [Render](https://render.com) account.
- This repo pushed to GitHub (at `NoraAbdullah33/WAAEM`).

## 1. Create the Blueprint
1. Render Dashboard → **New +** → **Blueprint**.
2. Connect the `NoraAbdullah33/WAAEM` repository.
3. Render reads `render.yaml` and shows two resources:
   - `waaem-db` — PostgreSQL (free)
   - `waaem-backend` — Docker web service
4. Click **Apply**. The database provisions first, then the backend builds.

## 2. Get the backend URL for Vercel
1. Wait for **`waaem-backend`** to finish its first deploy.
2. Copy its URL, e.g. `https://waaem-backend.onrender.com`.
3. In **Vercel**, set the frontend's `BACKEND_URL` env var to that URL
   (Vercel rewrites `/api/*` to it). See [DEPLOYMENT.md](DEPLOYMENT.md) §A.

## 3. (Optional) Enable the LLM
The backend runs with `AI_ALLOW_FALLBACK=true`, so it works without an LLM
(retrieval-grounded answers). To use a real model, point it at a hosted Ollama
endpoint:

- **`waaem-backend`** → **Environment** → set `OLLAMA_HOST` to your endpoint
  (e.g. `https://your-ollama-host:11434`), and adjust `LLAMA_MODEL` if needed.

Render does not host Ollama itself — use a separate GPU/VM host for it.

## Environment variables reference

| Variable            | Set by     | Notes |
|---------------------|------------|-------|
| `DATABASE_URL`      | Blueprint  | Auto-linked from `waaem-db`; app converts `postgres://` → asyncpg. |
| `ENVIRONMENT`       | Blueprint  | `production` |
| `CORS_ORIGINS`      | Blueprint  | `*` — tighten to your Vercel domain for production. |
| `AI_ALLOW_FALLBACK` | Blueprint  | `true` |
| `OLLAMA_HOST`       | **you**    | Optional; hosted LLM endpoint. |

## Notes
- Migrations run automatically on backend start (`alembic upgrade head`).
- Health check: `GET /api/health`.
- The free Postgres plan and free/starter services **sleep when idle** and the
  free DB expires after 90 days — upgrade the plan for always-on production use.
- For persistent ChromaDB retrieval, attach a Render **disk** to the backend at
  `CHROMA_DIR` (requires a paid plan).

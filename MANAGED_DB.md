# Managed databases — Neon (Postgres) + Chroma Cloud (vectors)

WAAEM uses two stores. Both can run fully managed so the backend keeps **no local
database** and needs no persistent disk.

| Store | What it holds | Managed option | How to switch |
|-------|---------------|----------------|---------------|
| SQL | documents, analyses, KB metadata | **Neon** / Supabase Postgres | set `DATABASE_URL` |
| Vector | the RAG index (embedded chunks) | **Chroma Cloud** | set `CHROMA_API_KEY` (+ tenant, database) |

Set neither and the app runs locally (SQLite file + on-disk Chroma) — no change needed for dev.

---

## 1. Postgres → Neon

1. Create a project at [neon.tech](https://neon.tech) → copy the connection string.
2. Set it on the backend (no code change — a plain `postgres://` URL is auto-normalised to asyncpg, and `sslmode`/`channel_binding` are handled automatically):
   ```
   DATABASE_URL=postgresql://user:password@ep-xxx.aws.neon.tech/waaem?sslmode=require
   ```
3. Run migrations (happens automatically on backend start): `alembic upgrade head`.

Supabase works the same way — use its "Connection string (URI)".

---

## 2. Vectors → Chroma Cloud

1. Create a database at [trychroma.com](https://www.trychroma.com/) → copy the **API key**, **tenant**, and **database** name.
2. Set on the backend:
   ```
   CHROMA_API_KEY=ck-xxxxxxxx
   CHROMA_TENANT=00000000-0000-0000-0000-000000000000
   CHROMA_DATABASE=waaem
   ```
3. Build the knowledge base once so the hosted index is populated:
   ```
   curl -X POST https://<backend>/api/kb/ingest
   curl https://<backend>/api/kb/status     # confirm chunk count > 0
   ```

When `CHROMA_API_KEY` is set the app uses hosted Chroma; otherwise it falls back
to the local `CHROMA_DIR` store. Embeddings still run locally (fastembed, CPU) —
only the vector **storage/search** moves to the cloud.

---

## Result

With both set, the backend is effectively **stateless**: no SQLite file, no
ChromaDB folder, no disk to persist. It can redeploy freely and still keep all
documents, analyses, and the regulatory index.

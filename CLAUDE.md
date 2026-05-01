# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository

Monorepo-style layout with `backend/` (FastAPI) and `frontend/` (Next.js) at the root, plus a `start.sh` that launches both dev servers.

## Common commands

Start both dev servers (requires `backend/.venv`, `backend/.env`, `frontend/node_modules`, and `frontend/.env.local`):
```bash
./start.sh                # Frontend :3000, Backend :8000, Docs :8000/docs
```

Backend (run from `backend/` with venv active):
```bash
.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
.venv/bin/alembic upgrade head
.venv/bin/alembic revision --autogenerate -m "<message>"
.venv/bin/alembic downgrade -1
```

Frontend (run from `frontend/`):
```bash
npm run dev               # next dev
npm run build             # next build
npm run lint              # next lint (ESLint, eslint-config-next)
npm start                 # next start (production)
```

There is no automated test suite. Verification is manual via `/docs` (Swagger), `curl` against the API, and exercising the UI in the browser.

## Architecture

### Request → generation lifecycle (the core flow)

All generation endpoints are `POST /generate/{kind}` returning `202 + generation_id`. The flow is identical regardless of kind:

1. Route handler validates input, charges credits, creates a `Generation` row with `status=pending`, then schedules a `BackgroundTasks` job and returns immediately.
2. The background job opens its **own** `AsyncSession` (the request session is closed by the time it runs), flips status to `processing`, calls Gemini **4× in parallel via `asyncio.gather`**, uploads outputs to Supabase Storage, and updates the row to `completed` (with `image_urls`) or `failed` (with `error_message`).
3. Frontend polls `GET /generations?limit=50` every ~5s while any item is `pending`/`processing`.

Image bytes are read once in the request and **passed directly to the background task** — never re-downloaded from storage. Refunds on failure happen inside the background task.

### Routers

`app/main.py` mounts:
- `auth_router` → `/auth`
- `users_router` → `/me`, `/me/topup`, `/pricing`
- `generate_router` → `/generate/{marketplace,ugc,enhance,fat-maker,listing-pack,chess}` (all multipart)
- `generations_router` → `/generations` (list/detail/delete) — **separate APIRouter** from `generate_router`, both defined in `app/api/routes/generation.py`
- `coach_router` → `/growth` (the "Growth Manager" / coach feature, uses OpenAI rather than Gemini)

`GenerationType` enum in `app/models/generation.py`: `marketplace | ugc | enhance | mini_app | listing_pack`. Chess and Fat-Maker are both stored as `mini_app`.

### Backend stack constraints (locked — do not swap)

- **Python 3.11 / FastAPI async / SQLAlchemy 2.x async + asyncpg / Alembic async**.
- **Supabase Postgres via the connection pooler on port 6543** (pgBouncer transaction mode). The asyncpg driver MUST run with `statement_cache_size=0`. Do not enable prepared statements unless you also switch to a session-mode (port 5432) connection.
- **Supabase Storage via aioboto3** (S3-compatible API), two public buckets: `uploads` and `generations`. Do not introduce `supabase-py`.
- **Google OAuth 2.0 ID-token verification** runs server-side via `google-auth`. The verify call is blocking and is dispatched via thread pool executor.
- **JWT, 7-day, no refresh tokens** (`python-jose`). Auth dependency in `app/api/deps.py`.
- **AI generation:** `google-genai` SDK, model `gemini-3-pro-image-preview`, 4 variants per request via `asyncio.gather`. Coach/growth feature uses the `openai` SDK instead.
- **Background work:** FastAPI `BackgroundTasks`. There is no Redis/Celery/ARQ; do not introduce one without explicit go-ahead.
- **Config:** `pydantic-settings` v2 reading `backend/.env`.

### Backend module map

- `app/core/config.py` — settings (CORS origins, DB URL, JWT secret, Gemini/OpenAI keys, Supabase S3 creds).
- `app/core/security.py` — JWT create/decode.
- `app/core/pricing.py` — credit pricing tables (image bundles + top-up packs). Credits are stored as Decimal (see migration `e5f6a7b8c9d0`).
- `app/db/base.py` — `Base` (DeclarativeBase) + `TimestampMixin`. **Models are imported at the bottom of this file so Alembic autogenerate sees them.**
- `app/db/session.py` — async engine + session factory.
- `app/services/image_service.py` — Gemini calls + background task orchestration for marketplace/ugc/enhance/mini_app.
- `app/services/listing_pack_service.py` — listing-pack-specific generation orchestration.
- `app/services/coach_service.py` + `coach_prompts.py` — OpenAI-backed Growth Manager.
- `app/services/prompts.py` — prompt templates keyed by `(marketplace, style)` and `(scene, style)`.
- `app/services/storage_service.py` — Supabase Storage uploads/deletes via aioboto3.
- `app/services/auth_service.py` — Google ID-token verification, user upsert, JWT issuance.

### Form-data quirk

The `benefits` field on `POST /generate/marketplace` is a **JSON-encoded array string** (e.g. `'["waterproof","compact"]'`), not a repeated form field.

### Frontend

- **Next.js 15 App Router, React 19, TypeScript, Tailwind 3.** No state library — `lib/auth.ts` reads/writes localStorage; `lib/credits.ts` is a small custom store; `lib/api.ts` wraps fetch with the bearer token.
- Pages under `app/`: `/` (landing + Google sign-in), `/dashboard`, `/generate?mode=...` (split-pane workspace), `/generate/listing-pack`, `/history`, `/topup`, `/mini-apps` (with `/mini-apps/fat-maker` and `/mini-apps/chess` sub-routes), `/growth-manager`.
- `components/GenerationsGallery.tsx` owns the polling loop that drives the right pane of `/generate`.
- Google sign-in uses `@react-oauth/google`; the ID token is POSTed to `/auth/google` and exchanged for the app JWT.

## Environment

Both env files must exist before `start.sh` will run:
- `backend/.env` (copy from `backend/.env.example`) — DB URL, JWT secret, Google client ID, Gemini/OpenAI keys, Supabase S3 creds + bucket names, CORS origins.
- `frontend/.env.local` (copy from `frontend/.env.local.example`) — `NEXT_PUBLIC_API_URL`, Google client ID.

## When extending

- New generation kinds: add to `GenerationType` enum + an Alembic migration that ALTERS the Postgres enum, a new route on `generate_router`, a service function that mirrors the existing background-task pattern (own session, status transitions, refund on failure), and a prompt block in `services/prompts.py` (or a sibling `*_prompts.py`).
- New API routes: register in `app/main.py` with the appropriate prefix and tag.
- New models: define in `app/models/`, import them at the bottom of `app/db/base.py`, then `alembic revision --autogenerate`.

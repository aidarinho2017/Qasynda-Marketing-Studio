# Qasynda Marketing Studio

AI image generation for Central Asian e-commerce sellers. Upload a product photo and get marketplace-ready cards (Wildberries / Ozon / Kaspi) and UGC-style lifestyle imagery — generated in parallel with `gemini-3-pro-image-preview`.

| | |
|---|---|
| **Backend** | Python 3.11 · FastAPI (async) · SQLAlchemy 2 + asyncpg · Alembic |
| **Frontend** | Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS |
| **Storage** | PostgreSQL via Supabase (pgBouncer pooler) · Supabase Storage (S3) |
| **Auth** | Google OAuth 2.0 → JWT (7 days, no refresh tokens) |
| **AI** | Google Gen AI SDK (`google-genai`) — `gemini-3-pro-image-preview` |
| **Jobs** | FastAPI `BackgroundTasks` (4-image generation in parallel via `asyncio.gather`) |

---

## Features

- **Google sign-in** — single-tap login, server-side ID-token verification.
- **Credit-based pricing** — every account starts with 5 credits. Bundled image counts:
  - 1 image → 5 credits · 2 → 9 (save 1) · 3 → 14 (save 1) · 4 → 17 (save 3)
- **Top-up packs** (demo / no real payment): 50 credits / $3 · 100 / $5 · 200 / $9.
- **Two generation modes**:
  - **Marketplace** — product cards styled for marketplaces (minimal / premium / bright / infographic).
  - **UGC** — realistic lifestyle photography (realistic / Instagram / TikTok looks).
- **Split-pane workspace** — form on the left, the user's generations stream into the right pane and update via smart polling.
- **History page** — full archive across both modes.

---

## Repository layout

```
.
├── backend/                FastAPI service (see backend/README.md for details)
│   ├── app/
│   │   ├── api/routes/     auth · users · generation
│   │   ├── core/           config · security · pricing
│   │   ├── db/             async engine + DeclarativeBase
│   │   ├── models/         User · Generation
│   │   ├── schemas/        Pydantic request/response shapes
│   │   └── services/       Google auth · Supabase Storage · Gemini calls · prompts
│   ├── alembic/            async-aware migrations
│   └── requirements.txt
├── frontend/               Next.js app
│   ├── app/                App-Router pages: / · /dashboard · /generate · /history · /topup
│   ├── components/         Navbar · GenerationsGallery · GenerationCard · UploadForm
│   └── lib/                api client · auth (localStorage) · credits store · types
├── start.sh                Launches both dev servers
└── README.md               (this file)
```

---

## Prerequisites

- Python **3.11+**, Node **20+**.
- A **Supabase** project with two **public** Storage buckets named `uploads` and `generations`, the connection-pooler URL (Database → Connection pooling → Transaction mode, port **6543**), and S3 credentials (Storage → S3 Connection).
- A **Google Cloud OAuth 2.0 Client ID** (Web application).
- A **Gemini API key** from [Google AI Studio](https://aistudio.google.com/).

---

## First-time setup

### 1. Clone and install

```bash
git clone <this-repo-url>
cd "Qasynda Marketing Studio"

# Backend
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..

# Frontend
cd frontend
npm install
cd ..
```

### 2. Configure environment

```bash
cp backend/.env.example  backend/.env
cp frontend/.env.local.example  frontend/.env.local
```

Fill in real values in both files (see comments inline).

### 3. Run database migrations

```bash
cd backend
.venv/bin/alembic upgrade head
cd ..
```

### 4. Start everything

```bash
./start.sh
```

| | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:8000 |
| Interactive API docs | http://localhost:8000/docs |

`Ctrl+C` stops both processes.

---

## How a generation works

```
User uploads photo + fills form
              │
              ▼
POST /generate/marketplace  (or /generate/ugc)   status: pending   credits charged
              │
              ▼
FastAPI BackgroundTask                            status: processing
              │
              ▼
4× gemini-3-pro-image-preview in parallel  →  upload to Supabase Storage
              │
              ▼
Generation row updated                            status: completed   image_urls populated
                                                  (or failed         error_message populated)
              │
              ▼
Frontend GET /generations?limit=50 polls every 5s while any item is pending/processing.
```

---

## API summary

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/auth/google` | Exchange a Google ID token for a JWT |
| `GET` | `/me` | Current user (incl. `credits_balance`) |
| `POST` | `/me/topup` | Add a top-up pack (`{ "pack_id": "small" \| "medium" \| "large" }`) |
| `GET` | `/pricing` | Public pricing — image bundles + top-up packs |
| `POST` | `/generate/marketplace` | Start a marketplace-card generation (multipart) |
| `POST` | `/generate/ugc` | Start a UGC-style generation (multipart) |
| `GET` | `/generations` | List the caller's generations (paginated) |
| `GET` | `/generations/{id}` | Single generation |
| `DELETE` | `/generations/{id}` | Hard-delete row + storage objects |
| `GET` | `/health` | Liveness probe |

See [`backend/README.md`](backend/README.md) for full payloads and `curl` examples.

---

## Frontend pages

| Route | What you see |
|---|---|
| `/` | Landing + Google sign-in |
| `/dashboard` | Post-login choice screen — Marketplace vs UGC |
| `/generate?mode=...` | Split-pane workspace: form left, live generations right |
| `/history` | All generations across both modes |
| `/topup` | Three top-up packs (demo — no real charge) |

---

## Notes on hosting / pgBouncer

The backend talks to Postgres through Supabase's **transaction-mode** connection pooler (port 6543). That mode is incompatible with prepared-statement caching, so the asyncpg driver is configured with `statement_cache_size=0`. Don't switch this off unless you also switch to a session-mode connection (port 5432).

---

## License

Private project — no license granted. All rights reserved.

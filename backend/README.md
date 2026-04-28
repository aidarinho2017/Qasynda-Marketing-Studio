# Qasynda Marketing Studio — Backend

Production-ready async FastAPI backend for AI-powered marketplace image generation.

## Stack

| Layer | Technology |
|---|---|
| Runtime | Python 3.11+ |
| Framework | FastAPI (async) |
| Database | PostgreSQL via Supabase (connection pooler, port 6543) |
| ORM | SQLAlchemy 2.x async + asyncpg |
| Migrations | Alembic (async) |
| Storage | Supabase Storage via aioboto3 (S3-compatible) |
| Auth | Google OAuth 2.0 → JWT (7-day, no refresh tokens) |
| AI | Google Gen AI SDK (`google-genai`) — model `gemini-3-pro-image-preview` |
| Background jobs | FastAPI `BackgroundTasks` |
| Config | pydantic-settings v2 |

---

## First-time setup

### 1. Prerequisites

- Python 3.11 or newer
- A Supabase project with:
  - Two **public** Storage buckets: `uploads` and `generations`
  - Connection pooler URL (Dashboard → Settings → Database → Connection pooling → **Transaction** mode, port **6543**)
  - S3 credentials (Dashboard → Storage → **S3 Connection** → generate keys)
- A Google Cloud OAuth 2.0 Client ID (Web application type)
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/)

### 2. Create virtual environment and install dependencies

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure environment

```bash
cp .env.example .env
# Open .env and fill in every value — see comments in the file
```

### 4. Run database migrations

```bash
# Generate the initial migration (only needed once)
alembic revision --autogenerate -m "init"

# Apply to the database
alembic upgrade head
```

### 5. Start the development server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Interactive docs are available at [http://localhost:8000/docs](http://localhost:8000/docs).

---

## API Overview

### Auth

```
POST /auth/google
Body: { "id_token": "<Google ID token from frontend>" }
Response: { "access_token": "...", "token_type": "bearer", "user": {...} }
```

### Users

```
GET /me                    → current user profile (JWT required)
```

### Marketplace generation

```
POST /generate/marketplace
Content-Type: multipart/form-data
Fields:
  image        UploadFile   JPEG/PNG/WebP, max 10 MB
  marketplace  str          wildberries | ozon | kaspi
  title        str          product name
  benefits     str          JSON array, e.g. ["waterproof","compact"]
  category     str          e.g. "skincare"
  style        str          minimal | premium | bright | infographic
  language     str          ru | kz

Response 202: { "generation_id": "...", "status": "pending" }
```

### UGC generation

```
POST /generate/ugc
Content-Type: multipart/form-data
Fields:
  image  UploadFile   JPEG/PNG/WebP, max 10 MB
  scene  str          kitchen | office | street | studio | hand | table
  style  str          realistic | instagram | tiktok

Response 202: { "generation_id": "...", "status": "pending" }
```

### Polling & management

```
GET    /generations             list (limit, offset query params)
GET    /generations/{id}        single generation
DELETE /generations/{id}        hard-delete row + storage objects
```

### Health

```
GET /health → { "status": "ok" }
```

---

## Generation lifecycle

```
POST /generate/... → status: pending
        ↓  (BackgroundTasks fires)
        ↓  status: processing
        ↓  (Gemini called 4× in parallel)
        ↓  (images uploaded to Supabase Storage)
        ↓  status: completed  →  image_urls populated
           or
           status: failed     →  error_message populated
```

Frontend polls `GET /generations/{id}` until status ∈ {completed, failed}.

---

## Testing

```bash
# Health check
curl http://localhost:8000/health

# Auth (replace TOKEN with a real Google ID token)
curl -X POST http://localhost:8000/auth/google \
  -H "Content-Type: application/json" \
  -d '{"id_token":"<GOOGLE_ID_TOKEN>"}'

# Marketplace generation (replace JWT)
curl -X POST http://localhost:8000/generate/marketplace \
  -H "Authorization: Bearer <JWT>" \
  -F "image=@/path/to/product.jpg" \
  -F "marketplace=wildberries" \
  -F 'title=Увлажняющий крем для лица' \
  -F 'benefits=["увлажняет 24 часа","гипоаллергенный","без парабенов"]' \
  -F "category=skincare" \
  -F "style=premium" \
  -F "language=ru"

# Poll result
curl http://localhost:8000/generations/<GENERATION_ID> \
  -H "Authorization: Bearer <JWT>"

# UGC generation
curl -X POST http://localhost:8000/generate/ugc \
  -H "Authorization: Bearer <JWT>" \
  -F "image=@/path/to/product.jpg" \
  -F "scene=kitchen" \
  -F "style=instagram"
```

---

## Project structure

```
backend/
├── app/
│   ├── main.py                 FastAPI app factory
│   ├── core/
│   │   ├── config.py           pydantic-settings (reads .env)
│   │   └── security.py         JWT create/decode
│   ├── db/
│   │   ├── base.py             DeclarativeBase + TimestampMixin + model imports
│   │   └── session.py          async engine + session factory
│   ├── models/
│   │   ├── user.py             User ORM model
│   │   └── generation.py       Generation ORM model + enums
│   ├── schemas/
│   │   ├── user.py             UserOut
│   │   ├── auth.py             GoogleAuthRequest, TokenResponse
│   │   └── generation.py       GenerationOut, GenerationStartResponse, …
│   ├── services/
│   │   ├── auth_service.py     Google token verification, user upsert, JWT issue
│   │   ├── storage_service.py  Supabase Storage via aioboto3
│   │   ├── image_service.py    Gemini calls + background task orchestration
│   │   └── prompts.py          Prompt templates per (marketplace, style) / (scene, style)
│   └── api/
│       ├── deps.py             get_db, get_current_user
│       └── routes/
│           ├── auth.py         POST /auth/google
│           ├── users.py        GET /me
│           └── generation.py   All generation endpoints
├── alembic/
│   ├── env.py                  Async-aware Alembic environment
│   ├── script.py.mako          Migration file template
│   └── versions/               Auto-generated migration files
├── alembic.ini
├── requirements.txt
├── .env.example
└── .gitignore
```

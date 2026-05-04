import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes.auth import router as auth_router
from app.api.routes.users import router as users_router
from app.api.routes.generation import generate_router, generations_router
from app.api.routes.coach import router as coach_router
from app.api.routes.leads import leads_router
from app.api.routes.catalogue import catalogue_router
from app.api.routes.admin import admin_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info(
        "Starting %s [environment=%s]",
        settings.APP_NAME,
        settings.ENVIRONMENT,
    )
    yield
    logger.info("Shutting down %s", settings.APP_NAME)


app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered marketing image generation for Central Asian marketplaces.",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(users_router, tags=["users"])
app.include_router(generate_router, prefix="/generate", tags=["generate"])
app.include_router(generations_router, prefix="/generations", tags=["generations"])
app.include_router(coach_router, prefix="/growth", tags=["growth"])
app.include_router(leads_router, prefix="/leads", tags=["leads"])
app.include_router(catalogue_router, prefix="/catalogue", tags=["catalogue"])
app.include_router(admin_router, prefix="/admin", tags=["admin"])


@app.get("/health", tags=["health"])
async def health() -> dict:
    """Liveness probe — returns 200 OK when the server is running."""
    return {"status": "ok"}

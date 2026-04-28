import asyncio
import uuid
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Load application settings and models before anything else
from app.core.config import settings  # noqa: E402
import app.db.base  # noqa: F401, E402
import app.models.user  # noqa: F401, E402 — registers models with Base.metadata
import app.models.generation  # noqa: F401, E402

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = app.db.base.Base.metadata


def run_migrations_offline() -> None:
    """Run migrations without a live DB connection (SQL script output mode)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:  # type: ignore[type-arg]
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations against a live database using an async engine.

    Uses DIRECT_DATABASE_URL when set (direct Supabase port 5432) to avoid
    pgBouncer transaction-mode prepared-statement errors during DDL.
    Falls back to DATABASE_URL with prepared-statement caching disabled.
    """
    migration_url = settings.DIRECT_DATABASE_URL or settings.DATABASE_URL
    cfg = config.get_section(config.config_ini_section, {})
    cfg["sqlalchemy.url"] = migration_url

    connect_args: dict = {}
    if not settings.DIRECT_DATABASE_URL:
        # pgBouncer transaction mode does not support cached prepared statements
        # AND can leak per-connection state across logical connections, so we
        # also randomise prepared-statement names to avoid name collisions on
        # the pooled backend.
        connect_args = {
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
            "prepared_statement_name_func": lambda: f"__asyncpg_{uuid.uuid4().hex}__",
        }

    connectable = async_engine_from_config(
        cfg,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())

import asyncio
import logging
from functools import partial

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_access_token  # noqa: F401 (re-exported implicitly)
from app.models.user import User

logger = logging.getLogger(__name__)

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


async def verify_google_token(google_id_token: str) -> dict:
    """Verify a Google ID token and return its decoded payload.

    Runs the blocking google-auth verification in a thread pool so the
    event loop is not stalled.

    Args:
        google_id_token: The raw ID token string sent by the frontend.

    Returns:
        Decoded token payload dict (contains sub, email, name, picture, …).

    Raises:
        ValueError: If the token is invalid, expired, or issued for a
            different client ID.
    """
    loop = asyncio.get_running_loop()
    try:
        payload: dict = await loop.run_in_executor(
            None,
            partial(
                id_token.verify_oauth2_token,
                google_id_token,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID,
            ),
        )
        return payload
    except Exception as exc:
        logger.warning("Google token verification failed: %s", exc)
        raise ValueError(f"Invalid Google ID token: {exc}") from exc


async def get_or_create_user(db: AsyncSession, google_payload: dict) -> User:
    """Upsert a User row keyed on google_sub.

    On first login the row is created; on subsequent logins email / name /
    avatar are kept in sync with whatever Google currently reports.

    Args:
        db: Active async database session.
        google_payload: Decoded Google ID token payload.

    Returns:
        The persisted User ORM instance.
    """
    google_sub: str = google_payload["sub"]
    email: str = google_payload.get("email", "").lower()
    name: str = google_payload.get("name", "")
    avatar: str | None = google_payload.get("picture")

    result = await db.execute(select(User).where(User.google_sub == google_sub))
    user = result.scalar_one_or_none()

    if user is None:
        # Reject if an email/password account already owns this email.
        existing = await db.scalar(select(User).where(User.email == email))
        if existing is not None:
            raise ValueError("EMAIL_TAKEN")

        user = User(google_sub=google_sub, email=email, name=name, avatar=avatar)
        db.add(user)
        await db.commit()
        await db.refresh(user)
        logger.info("Created new user %s (%s)", user.id, email)
    else:
        user.email = email
        user.name = name
        user.avatar = avatar
        await db.commit()
        await db.refresh(user)
        logger.info("Updated existing user %s (%s)", user.id, email)

    # Auto-elevate accounts listed in ADMIN_EMAILS.
    if email in settings.ADMIN_EMAILS and not user.is_admin:
        user.is_admin = True
        await db.commit()

    return user


async def register_email_user(
    db: AsyncSession,
    email: str,
    password: str,
    name: str,
) -> User:
    """Create a new email/password user. Raises ValueError('EMAIL_TAKEN') on collision."""
    normalized = email.lower()
    existing = await db.scalar(select(User).where(User.email == normalized))
    if existing is not None:
        raise ValueError("EMAIL_TAKEN")

    user = User(
        email=normalized,
        name=name,
        password_hash=hash_password(password),
        google_sub=None,
        avatar=None,
        is_admin=normalized in settings.ADMIN_EMAILS,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info("Registered new email user %s (%s)", user.id, normalized)
    return user


async def authenticate_email_user(
    db: AsyncSession,
    email: str,
    password: str,
) -> User | None:
    """Return the user iff email exists, has a password, and the password matches."""
    user = await db.scalar(select(User).where(User.email == email.lower()))
    if user is None or user.password_hash is None:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def create_user_access_token(user: User) -> str:
    """Issue a 7-day JWT for the given user.

    Args:
        user: Authenticated User ORM instance.

    Returns:
        Signed JWT string.
    """
    return create_access_token(sub=str(user.id))

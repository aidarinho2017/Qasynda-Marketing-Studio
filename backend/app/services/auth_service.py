import asyncio
import logging
from functools import partial

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_access_token
from app.models.user import User

logger = logging.getLogger(__name__)


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
    email: str = google_payload.get("email", "")
    name: str = google_payload.get("name", "")
    avatar: str | None = google_payload.get("picture")

    result = await db.execute(select(User).where(User.google_sub == google_sub))
    user = result.scalar_one_or_none()

    if user is None:
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

    return user


def create_user_access_token(user: User) -> str:
    """Issue a 7-day JWT for the given user.

    Args:
        user: Authenticated User ORM instance.

    Returns:
        Signed JWT string.
    """
    return create_access_token(sub=str(user.id))

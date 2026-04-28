from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.core.config import settings


def create_access_token(sub: str, expires_delta: timedelta | None = None) -> str:
    """Create a signed JWT with the given subject (user ID string).

    Args:
        sub: The JWT subject, expected to be the user UUID as a string.
        expires_delta: Override token lifetime. Defaults to JWT_EXPIRE_DAYS from settings.

    Returns:
        Encoded JWT string.
    """
    if expires_delta is None:
        expires_delta = timedelta(days=settings.JWT_EXPIRE_DAYS)

    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT, returning the payload dict.

    Args:
        token: Raw JWT string from the Authorization header.

    Returns:
        Decoded payload dict.

    Raises:
        ValueError: If the token is invalid, expired, or tampered with.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except JWTError as exc:
        raise ValueError("Invalid or expired token") from exc

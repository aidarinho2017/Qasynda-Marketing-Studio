import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.auth import GoogleAuthRequest, TokenResponse
from app.schemas.user import UserOut
from app.services import auth_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/google", response_model=TokenResponse)
async def google_auth(
    request: GoogleAuthRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Exchange a Google ID token for a Qasynda JWT.

    The frontend obtains the Google ID token via Google Sign-In and posts it
    here.  The server verifies it, upserts the user, and returns a 7-day JWT.

    Raises:
        400: If the Google ID token is invalid or expired.
    """
    try:
        payload = await auth_service.verify_google_token(request.id_token)
    except ValueError as exc:
        logger.warning("Auth failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    user = await auth_service.get_or_create_user(db, payload)
    access_token = auth_service.create_user_access_token(user)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )

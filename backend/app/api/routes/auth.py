import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.auth import (
    GoogleAuthRequest,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.user import UserOut
from app.services import auth_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/google", response_model=TokenResponse)
async def google_auth(
    request: GoogleAuthRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Exchange a Google ID token for a Qasynda JWT."""
    try:
        payload = await auth_service.verify_google_token(request.id_token)
    except ValueError as exc:
        logger.warning("Auth failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    try:
        user = await auth_service.get_or_create_user(db, payload)
    except ValueError as exc:
        if str(exc) == "EMAIL_TAKEN":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists. Please sign in with email and password.",
            )
        raise

    access_token = auth_service.create_user_access_token(user)
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Create a new email/password account and return a JWT."""
    full_name = f"{request.first_name.strip()} {request.last_name.strip()}"
    try:
        user = await auth_service.register_email_user(
            db=db,
            email=request.email,
            password=request.password,
            name=full_name,
        )
    except ValueError as exc:
        if str(exc) == "EMAIL_TAKEN":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already in use",
            )
        raise

    access_token = auth_service.create_user_access_token(user)
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Verify email/password and return a JWT."""
    user = await auth_service.authenticate_email_user(
        db=db,
        email=request.email,
        password=request.password,
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = auth_service.create_user_access_token(user)
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserOut.model_validate(user),
    )

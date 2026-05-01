import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.coach import CoachConversation, CoachMessage, CoachModule
from app.models.user import User
from app.schemas.coach import (
    AssistantTurnResponse,
    ConversationCreate,
    ConversationListResponse,
    ConversationOut,
    ConversationRename,
    ConversationSummary,
    MessageOut,
    MessageSend,
    NextAction,
)
from app.services.coach_service import send_turn

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── POST /growth/conversations ─────────────────────────────────────────────


@router.post("/conversations", response_model=ConversationOut, status_code=201)
async def create_conversation(
    body: ConversationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConversationOut:
    convo = CoachConversation(
        user_id=current_user.id,
        title=body.title or "New conversation",
        current_module=body.starting_module,
        context={},
    )
    db.add(convo)
    await db.commit()
    await db.refresh(convo)
    return ConversationOut.model_validate(convo)


# ─── GET /growth/conversations ──────────────────────────────────────────────


@router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConversationListResponse:
    total = (
        await db.execute(
            select(func.count(CoachConversation.id)).where(
                CoachConversation.user_id == current_user.id
            )
        )
    ).scalar_one()

    rows = (
        await db.execute(
            select(CoachConversation)
            .where(CoachConversation.user_id == current_user.id)
            .order_by(
                desc(
                    func.coalesce(
                        CoachConversation.last_message_at,
                        CoachConversation.created_at,
                    )
                )
            )
            .limit(50)
        )
    ).scalars().all()

    return ConversationListResponse(
        items=[ConversationSummary.model_validate(r) for r in rows],
        total=total,
    )


# ─── GET /growth/conversations/{id} ─────────────────────────────────────────


async def _load_conversation(
    db: AsyncSession, conversation_id: uuid.UUID, user_id: uuid.UUID
) -> CoachConversation:
    convo = (
        await db.execute(
            select(CoachConversation).where(
                CoachConversation.id == conversation_id,
                CoachConversation.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if convo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return convo


@router.get("/conversations/{conversation_id}", response_model=ConversationOut)
async def get_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConversationOut:
    convo = await _load_conversation(db, conversation_id, current_user.id)
    msgs = (
        await db.execute(
            select(CoachMessage)
            .where(CoachMessage.conversation_id == convo.id)
            .order_by(CoachMessage.created_at.asc())
        )
    ).scalars().all()
    out = ConversationOut.model_validate(convo)
    out.messages = [MessageOut.model_validate(m) for m in msgs]
    return out


# ─── PATCH /growth/conversations/{id} (rename) ──────────────────────────────


@router.patch("/conversations/{conversation_id}", response_model=ConversationSummary)
async def rename_conversation(
    conversation_id: uuid.UUID,
    body: ConversationRename,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConversationSummary:
    convo = await _load_conversation(db, conversation_id, current_user.id)
    convo.title = body.title.strip()
    await db.commit()
    await db.refresh(convo)
    return ConversationSummary.model_validate(convo)


# ─── DELETE /growth/conversations/{id} ──────────────────────────────────────


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    convo = await _load_conversation(db, conversation_id, current_user.id)
    await db.delete(convo)
    await db.commit()


# ─── POST /growth/conversations/{id}/messages (the turn) ────────────────────


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=AssistantTurnResponse,
)
async def post_message(
    conversation_id: uuid.UUID,
    body: MessageSend,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssistantTurnResponse:
    result: dict[str, Any] = await send_turn(
        db=db,
        user=current_user,
        conversation_id=conversation_id,
        user_message=body.message.strip(),
        module=body.module,
    )
    return AssistantTurnResponse(
        message=MessageOut.model_validate(result["message"]),
        reply=result["reply"],
        structured=result["structured"],
        context_updates=result["context_updates"],
        next_actions=[NextAction(**a) for a in result["next_actions"]],
        conversation_context=result["conversation_context"],
        credits_balance=result["credits_balance"],
    )

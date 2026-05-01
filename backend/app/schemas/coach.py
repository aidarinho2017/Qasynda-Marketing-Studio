from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.coach import CoachModule


# ─── Conversation-level ─────────────────────────────────────────────────────


class ConversationCreate(BaseModel):
    title: str | None = None  # auto-generated if omitted
    starting_module: CoachModule = CoachModule.foundation


class ConversationRename(BaseModel):
    title: str = Field(min_length=1, max_length=255)


class MessageOut(BaseModel):
    id: UUID
    role: Literal["user", "assistant"]
    content: str
    structured_output: dict | None = None
    module: CoachModule | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationOut(BaseModel):
    id: UUID
    title: str
    current_module: CoachModule
    context: dict
    last_message_at: datetime | None
    created_at: datetime
    updated_at: datetime
    messages: list[MessageOut] = []

    model_config = {"from_attributes": True}


class ConversationSummary(BaseModel):
    id: UUID
    title: str
    current_module: CoachModule
    last_message_at: datetime | None
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConversationListResponse(BaseModel):
    items: list[ConversationSummary]
    total: int


# ─── Send a turn ────────────────────────────────────────────────────────────


class MessageSend(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    module: CoachModule


class NextAction(BaseModel):
    label: str
    module: CoachModule
    prompt: str


class AssistantTurnResponse(BaseModel):
    """The full envelope returned to the frontend on a successful turn."""

    message: MessageOut
    reply: str
    structured: dict[str, Any]
    context_updates: dict[str, Any]
    next_actions: list[NextAction]
    conversation_context: dict[str, Any]
    credits_balance: float


# ─── v1 module-output validation models ─────────────────────────────────────


class FoundationICP(BaseModel):
    who: str = ""
    age_range: str = ""
    where: str = ""
    pains: list[str] = []
    jobs_to_be_done: list[str] = []


class FoundationOffer(BaseModel):
    headline: str = ""
    value_props: list[str] = []
    price_anchor: str = ""
    guarantee: str = ""


class FoundationStructured(BaseModel):
    product_summary: str = ""
    icp: FoundationICP = Field(default_factory=FoundationICP)
    offer: FoundationOffer = Field(default_factory=FoundationOffer)
    positioning_angle: str = ""
    validation_questions: list[str] = []


class AcquisitionAdHook(BaseModel):
    hook: str
    angle: str = ""
    format_hint: Literal["static", "video", "carousel"] = "static"


class AcquisitionStructured(BaseModel):
    ad_hooks: list[AcquisitionAdHook] = []
    primary_caption: str = ""
    short_caption: str = ""
    ctas: list[str] = []
    visual_brief: str = ""

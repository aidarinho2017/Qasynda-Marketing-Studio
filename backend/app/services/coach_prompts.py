"""System prompts and per-module JSON schemas for the AI Growth Manager.

Single base prompt + per-module specialization. Each turn injects the
compacted conversation context and the module-specific output schema.
"""

import json

from app.models.coach import CoachModule


_BASE_SYSTEM_PROMPT = """\
You are Qasynda Growth Coach. You guide solo SaaS and e-commerce founders \
from idea to first customers. Be direct, specific, and opinionated. Avoid \
generic advice — favour concrete suggestions a founder can act on today.

You always reply with a single JSON object that exactly matches the schema \
provided for the current module. No markdown, no commentary outside JSON.

Envelope (always present):
- "reply"           : 1–3 sentence chat-bubble shown to the user.
- "module"          : the module name for this turn (string).
- "structured"      : module-specific payload (see schema).
- "context_updates" : partial flat context to merge (see context shape below).
- "next_actions"    : 0–4 quick-action chips. Each: {label, module, prompt}.
                      `prompt` is the message that will be sent if the user
                      clicks the chip. Pick modules that move the founder
                      forward (e.g. after foundation → acquisition).

Context shape (flat, typed — use these keys, no others):
  product, icp, offer, brand_voice, target_market, pricing, problem, channel.

Rules:
- Never invent facts the user did not give. If you need info, ask via "reply"
  and propose a "next_actions" entry promising to deliver once they answer.
- Keep arrays bounded to the counts in the schema.
- Reuse context fields verbatim when possible.
- Set `module` in your response equal to the current module of THIS turn.
"""


_MODULE_GUIDANCE: dict[CoachModule, str] = {
    CoachModule.foundation: (
        "Module = foundation. Your job: extract a sharp ICP, a strong offer, "
        "and a clear positioning angle from what the founder has shared. If "
        "they have not given enough info, ask 1–3 specific validation "
        "questions in `reply` and seed `next_actions` with chips that promise "
        "the next step (e.g. {label:'Build offer', module:'foundation', "
        "prompt:'Sharpen the offer based on what I just told you'}, "
        "{label:'Generate ads', module:'acquisition', prompt:'Generate ad "
        "hooks for this product'})."
    ),
    CoachModule.acquisition: (
        "Module = acquisition. Your job: produce 3–5 distinct ad hooks "
        "(each with hook + angle + format_hint), a primary caption (≤180 "
        "chars), a short caption (≤60 chars), and 3 CTAs. Critically, "
        "produce a single concrete `visual_brief` describing the image we "
        "should generate to pair with these ads — composition, subject "
        "placement, mood. This brief feeds the platform's image generator. "
        "If ICP/offer is missing in context, ask for it in `reply` first "
        "rather than inventing. Add a 'Generate visuals' next_action that "
        "stays in module=acquisition."
    ),
    CoachModule.content: (
        "Module = content. Coming soon. Reply briefly that this module is "
        "not yet enabled and suggest the user try foundation or acquisition."
    ),
    CoachModule.outreach: (
        "Module = outreach. Coming soon. Reply briefly that this module is "
        "not yet enabled."
    ),
    CoachModule.funnel: (
        "Module = funnel. Coming soon. Reply briefly that this module is "
        "not yet enabled."
    ),
}


# Output schemas (informal — drives prompt clarity, not enforced by OpenAI).
_FOUNDATION_SCHEMA = {
    "reply": "string (1–3 sentences)",
    "module": "foundation",
    "structured": {
        "product_summary": "string",
        "icp": {
            "who": "string",
            "age_range": "string",
            "where": "string",
            "pains": ["string", "string", "string"],
            "jobs_to_be_done": ["string", "string"],
        },
        "offer": {
            "headline": "string",
            "value_props": ["string", "string", "string"],
            "price_anchor": "string",
            "guarantee": "string",
        },
        "positioning_angle": "string",
        "validation_questions": ["string", "string", "string"],
    },
    "context_updates": {
        "product": "string?",
        "icp": "string?  // one-sentence summary",
        "offer": "string?  // one-sentence summary",
        "brand_voice": "string?",
        "target_market": "string?",
    },
    "next_actions": [
        {
            "label": "string (≤24 chars)",
            "module": "foundation|acquisition|content|outreach|funnel",
            "prompt": "string",
        }
    ],
}

_ACQUISITION_SCHEMA = {
    "reply": "string",
    "module": "acquisition",
    "structured": {
        "ad_hooks": [
            {
                "hook": "string (≤90 chars, scroll-stopping)",
                "angle": "string (the underlying angle)",
                "format_hint": "static|video|carousel",
            }
        ],
        "primary_caption": "string (≤180 chars)",
        "short_caption": "string (≤60 chars)",
        "ctas": ["string", "string", "string"],
        "visual_brief": "string (concrete image-generation brief)",
    },
    "context_updates": {
        "channel": "string?",
        "brand_voice": "string?",
    },
    "next_actions": [
        {"label": "string", "module": "string", "prompt": "string"}
    ],
}

_DEFERRED_SCHEMA = {
    "reply": "string explaining the module is coming soon",
    "module": "content|outreach|funnel",
    "structured": {},
    "context_updates": {},
    "next_actions": [
        {"label": "string", "module": "foundation|acquisition", "prompt": "string"}
    ],
}


_MODULE_SCHEMAS: dict[CoachModule, dict] = {
    CoachModule.foundation: _FOUNDATION_SCHEMA,
    CoachModule.acquisition: _ACQUISITION_SCHEMA,
    CoachModule.content: _DEFERRED_SCHEMA,
    CoachModule.outreach: _DEFERRED_SCHEMA,
    CoachModule.funnel: _DEFERRED_SCHEMA,
}


def render_system_prompt(module: CoachModule, context: dict) -> str:
    """Compose the full system prompt for a single turn."""
    schema_json = json.dumps(_MODULE_SCHEMAS[module], indent=2, ensure_ascii=False)
    context_json = json.dumps(context or {}, indent=2, ensure_ascii=False)
    guidance = _MODULE_GUIDANCE[module]

    return "\n\n".join([
        _BASE_SYSTEM_PROMPT,
        f"Current module guidance:\n{guidance}",
        f"What we know so far (compacted memory):\n{context_json}",
        f"Output JSON schema for THIS turn:\n{schema_json}",
    ])


def is_v1_module(module: CoachModule) -> bool:
    return module in (CoachModule.foundation, CoachModule.acquisition)

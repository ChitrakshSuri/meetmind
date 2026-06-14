import json
import logging
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from app.agent.state import MeetingState

logger = logging.getLogger(__name__)

_PROMPT = """You are an engineering team lead reviewing a meeting transcript to decide whether Jira tickets should be created.

CREATE tickets if the meeting contains any of:
- Clear, assignable action items (someone committed to doing something)
- Bugs identified and acknowledged by the team
- Features or improvements agreed upon
- Decisions that require follow-up engineering work

DO NOT create tickets if the meeting was:
- A casual catch-up or social call with no work commitments
- Purely informational (updates shared, nothing assigned)
- A training session or demo with no follow-up tasks
- Only vague discussion with no concrete next steps

Meeting transcript:
{transcript}

Action items identified (may be empty):
{action_items}

Respond ONLY with valid JSON, no markdown fences:
{{"should_create_tickets": true, "reason": "one sentence explaining why"}}"""


def _clean_json(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]
    return text.strip()


async def decide_ticket_creation(state: MeetingState) -> dict:
    transcript = state.get("transcript", "")
    action_items = state.get("action_items", [])

    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    try:
        response = await llm.ainvoke([
            HumanMessage(
                content=_PROMPT.format(
                    transcript=transcript[:4000],
                    action_items=json.dumps(action_items, indent=2),
                )
            )
        ])
        data = json.loads(_clean_json(response.content))
        should_create = bool(data.get("should_create_tickets", True))
        reason = data.get("reason", "")
    except Exception as e:
        logger.error(f"decide_ticket_creation error (fail open): {e}")
        should_create = True
        reason = "Decision failed — defaulting to ticket creation."

    logger.info(f"Ticket creation decision: {should_create} — {reason}")
    return {"should_create_tickets": should_create, "decision_reason": reason}

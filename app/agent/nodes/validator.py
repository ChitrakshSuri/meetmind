import json
import logging
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from app.agent.state import MeetingState

logger = logging.getLogger(__name__)

_PROMPT = """You are a senior engineering manager reviewing Jira tickets before they go to a development team.

Review each ticket against the original meeting transcript and check for:
1. Clarity — is the title and description unambiguous?
2. Actionability — can a developer pick this up and start immediately?
3. Accuracy — does this reflect what was actually discussed? No hallucinations?
4. Duplicates — does this ticket overlap significantly with another?
5. Specificity — is the description concrete, not vague?

Original transcript:
{transcript}

Tickets to review:
{tickets}

Respond ONLY with valid JSON, no markdown fences:
{{
  "valid": true,
  "issues": [],
  "improved_tickets": [
    {{
      "title": "...",
      "description": "...",
      "ticket_type": "...",
      "priority": "...",
      "assignee": "..."
    }}
  ]
}}

Rules:
- Set valid=true only if every ticket is clear, actionable, and grounded in the transcript
- Set valid=false and list issues if any ticket has problems
- Always return improved_tickets with corrected wording even when valid=true
- improved_tickets must be the same length and in the same order as the input tickets"""

_PRESERVED_FIELDS = {"title", "description", "ticket_type", "priority", "assignee"}


def _clean_json(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]
    return text.strip()


async def validate_tickets(state: MeetingState) -> dict:
    tickets = state.get("tickets", [])
    transcript = state.get("transcript", "")
    attempts = state.get("validation_attempts", 0)

    if not tickets:
        return {"validation_passed": True, "validation_attempts": attempts + 1}

    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    try:
        response = await llm.ainvoke([
            HumanMessage(
                content=_PROMPT.format(
                    transcript=transcript[:4000],
                    tickets=json.dumps(
                        [
                            {
                                "title": t["title"],
                                "description": t["description"],
                                "ticket_type": t["ticket_type"],
                                "priority": t["priority"],
                                "assignee": t.get("assignee", "Unassigned"),
                            }
                            for t in tickets
                        ],
                        indent=2,
                    ),
                )
            )
        ])
        data = json.loads(_clean_json(response.content))
    except Exception as e:
        logger.error(f"validate_tickets error (fail open): {e}")
        return {"validation_passed": True, "validation_attempts": attempts + 1}

    is_valid = bool(data.get("valid", True))
    improved_raw = data.get("improved_tickets", [])

    # Merge improved fields onto originals — id and all extra fields are preserved
    improved_tickets = [
        {**original, **{k: v for k, v in (improved_raw[i] if i < len(improved_raw) else {}).items()
                        if k in _PRESERVED_FIELDS}}
        for i, original in enumerate(tickets)
    ]

    if is_valid:
        return {
            "tickets": improved_tickets,
            "validation_passed": True,
            "validation_attempts": attempts + 1,
        }

    if attempts >= 2:
        logger.warning(
            f"Validation failed after {attempts} attempt(s), forcing pass. "
            f"Issues: {data.get('issues', [])}"
        )
        return {
            "tickets": improved_tickets,
            "validation_passed": True,
            "validation_attempts": attempts + 1,
        }

    logger.info(f"Validation attempt {attempts + 1} failed: {data.get('issues', [])}")
    return {
        "tickets": improved_tickets,
        "validation_passed": False,
        "validation_attempts": attempts + 1,
    }

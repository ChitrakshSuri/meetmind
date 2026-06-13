import json
import logging
import uuid
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from app.agent.state import MeetingState

logger = logging.getLogger(__name__)


def _clean_json(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]
    return text.strip()


_PROMPT = """Convert these action items into Jira tickets.
Respond ONLY with valid JSON — no markdown, no preamble.

Rules:
- title: imperative verb phrase, max ~60 chars (e.g. "Fix memory leak on production server")
- description: 1-3 sentences with enough context for the developer to start work immediately
- ticket_type: Bug if it's a defect/regression, Task for everything else
- priority: High if it blocks others or has a near-term deadline, Low if it's nice-to-have, Medium otherwise
- assignee: use the name from the action item, or "Unassigned"

Example input:
[{{"description": "Investigate and fix memory leak on production server", "assignee": "Carol", "due_hint": "1-2 days"}}]

Example output:
{{"tickets": [{{"title": "Fix memory leak on production server", "description": "Production server is experiencing a memory leak causing degraded performance. Carol to investigate root cause and deploy a fix within 1-2 days.", "ticket_type": "Bug", "priority": "High", "assignee": "Carol"}}]}}

Now convert these action items:
{action_items}"""


async def generate_tickets(state: MeetingState) -> dict:
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    response = await llm.ainvoke(
        [
            HumanMessage(
                content=_PROMPT.format(
                    action_items=json.dumps(state["action_items"], indent=2)
                )
            )
        ]
    )
    try:
        data = json.loads(_clean_json(response.content))
        tickets = []
        for t in data.get("tickets", []):
            ticket_type = t.get("ticket_type", "Task")
            if ticket_type not in ("Bug", "Task"):
                ticket_type = "Task"
            tickets.append(
                {
                    "id": uuid.uuid4().hex[:8],
                    "title": t.get("title", ""),
                    "description": t.get("description", ""),
                    "ticket_type": ticket_type,
                    "priority": t.get("priority", "Medium"),
                    "assignee": t.get("assignee", "Unassigned"),
                    "approved": None,
                }
            )
        return {"tickets": tickets}
    except (json.JSONDecodeError, AttributeError) as e:
        logger.error(f"Failed to parse ticket_gen response: {e}\nRaw: {response.content!r}")
        return {"tickets": []}

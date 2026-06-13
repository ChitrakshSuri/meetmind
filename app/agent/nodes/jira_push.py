import base64
import logging
import httpx
from app.agent.state import MeetingState
from app.config import settings

logger = logging.getLogger(__name__)


def _basic_auth() -> str:
    raw = f"{settings.atlassian_email}:{settings.atlassian_api_token}"
    return base64.b64encode(raw.encode()).decode()


def _adf_paragraph(text: str) -> dict:
    return {
        "type": "doc",
        "version": 1,
        "content": [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": text}],
            }
        ],
    }


async def push_to_jira(state: MeetingState) -> dict:
    headers = {
        "Authorization": f"Basic {_basic_auth()}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    results = []
    async with httpx.AsyncClient() as client:
        for ticket in state["approved_tickets"]:
            payload: dict = {
                "fields": {
                    "project": {"key": settings.jira_project_key},
                    "summary": ticket["title"],
                    "description": _adf_paragraph(ticket["description"]),
                    "issuetype": {"name": ticket["ticket_type"]},
                    "priority": {"name": ticket["priority"]},
                }
            }
            if ticket.get("assignee") and ticket["assignee"] != "Unassigned":
                payload["fields"]["assignee"] = {"name": ticket["assignee"]}

            try:
                response = await client.post(
                    f"{settings.atlassian_base_url}/rest/api/3/issue",
                    headers=headers,
                    json=payload,
                )
                if not response.is_success:
                    logger.error(f"Jira API error {response.status_code}: {response.text}")
                    response.raise_for_status()
                jira_key = response.json()["key"]
                logger.info(f"Created Jira ticket {jira_key} for '{ticket['title']}'")
                results.append({**ticket, "jira_key": jira_key})
            except Exception as e:
                logger.error(f"Failed to create Jira ticket for '{ticket.get('title')}': {e}")
                results.append({**ticket, "jira_key": None})

    return {"approved_tickets": results}

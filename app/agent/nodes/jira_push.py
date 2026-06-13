import base64
import logging
import httpx
from app.agent.state import MeetingState
from app.config import settings

logger = logging.getLogger(__name__)

_issue_type_cache: dict | None = None


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


async def get_issue_type_map() -> dict:
    global _issue_type_cache
    if _issue_type_cache is not None:
        return _issue_type_cache

    url = f"{settings.atlassian_base_url}/rest/api/3/issue/createmeta/{settings.jira_project_key}/issuetypes"
    headers = {
        "Authorization": f"Basic {_basic_auth()}",
        "Accept": "application/json",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        issue_types = response.json().get("issueTypes", [])

    _issue_type_cache = {it["name"]: it["id"] for it in issue_types if not it.get("subtask")}
    return _issue_type_cache


async def get_valid_issue_types() -> list[str]:
    type_map = await get_issue_type_map()
    return list(type_map.keys())


async def push_to_jira(state: MeetingState) -> dict:
    headers = {
        "Authorization": f"Basic {_basic_auth()}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    issue_type_map = await get_issue_type_map()
    task_id = issue_type_map.get("Task")

    results = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        for ticket in state["approved_tickets"]:
            resolved_id = issue_type_map.get(ticket["ticket_type"], task_id)
            payload: dict = {
                "fields": {
                    "project": {"key": settings.jira_project_key},
                    "summary": ticket["title"],
                    "description": _adf_paragraph(ticket["description"]),
                    "issuetype": {"id": resolved_id},
                }
            }
            if ticket.get("assignee_account_id"):
                payload["fields"]["assignee"] = {"id": ticket["assignee_account_id"]}
            elif ticket.get("assignee") and ticket["assignee"] != "Unassigned":
                payload["fields"]["assignee"] = {"name": ticket["assignee"]}
            if ticket.get("due_date"):
                payload["fields"]["duedate"] = ticket["due_date"]
            if ticket.get("labels"):
                payload["fields"]["labels"] = ticket["labels"]
            if ticket.get("parent_epic"):
                payload["fields"]["parent"] = {"key": ticket["parent_epic"]}
            if ticket.get("sprint_id"):
                payload["fields"]["customfield_10020"] = ticket["sprint_id"]

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

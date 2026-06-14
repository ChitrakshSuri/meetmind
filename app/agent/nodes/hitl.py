import logging
from langgraph.types import interrupt
from app.agent.state import MeetingState

logger = logging.getLogger(__name__)


async def human_review(state: MeetingState) -> dict:
    logger.info(f"[AGENT] human_review — ⏸ pausing for human approval ({len(state['tickets'])} tickets)")
    human_decision = interrupt({"tickets": state["tickets"]})

    approved_ids = set(human_decision.get("approved_ids", []))
    edited_map = {t["id"]: t for t in human_decision.get("edited_tickets", [])}

    approved_tickets = []
    for ticket in state["tickets"]:
        if ticket["id"] in approved_ids:
            merged = {**ticket, **edited_map.get(ticket["id"], {}), "approved": True}
            approved_tickets.append(merged)

    logger.info(f"[AGENT] human_review — ▶ resumed, {len(approved_tickets)} tickets approved")
    return {"approved_tickets": approved_tickets}

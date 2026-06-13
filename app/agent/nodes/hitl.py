from langgraph.types import interrupt
from app.agent.state import MeetingState


async def human_review(state: MeetingState) -> dict:
    human_decision = interrupt({"tickets": state["tickets"]})

    approved_ids = set(human_decision.get("approved_ids", []))
    edited_map = {t["id"]: t for t in human_decision.get("edited_tickets", [])}

    approved_tickets = []
    for ticket in state["tickets"]:
        if ticket["id"] in approved_ids:
            merged = {**ticket, **edited_map.get(ticket["id"], {}), "approved": True}
            approved_tickets.append(merged)

    return {"approved_tickets": approved_tickets}

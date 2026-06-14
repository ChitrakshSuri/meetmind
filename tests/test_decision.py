import json
from unittest.mock import AsyncMock, MagicMock, patch


def _mock_llm(content: str) -> AsyncMock:
    response = MagicMock()
    response.content = content
    llm = AsyncMock()
    llm.ainvoke.return_value = response
    return llm


_STATE_WITH_ITEMS = {
    "transcript": "Alice: I'll fix the login bug by Friday. Bob: I'll review the PR.",
    "action_items": [
        {"description": "Fix login bug", "assignee": "Alice", "due_hint": "Friday"},
        {"description": "Review PR", "assignee": "Bob", "due_hint": None},
    ],
}

_STATE_CASUAL = {
    "transcript": "Alice: How was your weekend? Bob: Great, saw a movie.",
    "action_items": [],
}


async def test_decides_to_create_tickets_when_action_items_present():
    from app.agent.nodes.decision import decide_ticket_creation

    payload = json.dumps({
        "should_create_tickets": True,
        "reason": "Two engineers committed to specific deliverables with a deadline.",
    })

    with patch("app.agent.nodes.decision.ChatOpenAI", return_value=_mock_llm(payload)):
        result = await decide_ticket_creation(_STATE_WITH_ITEMS)

    assert result["should_create_tickets"] is True
    assert isinstance(result["decision_reason"], str)
    assert len(result["decision_reason"]) > 0


async def test_decides_no_tickets_for_casual_meeting():
    from app.agent.nodes.decision import decide_ticket_creation

    payload = json.dumps({
        "should_create_tickets": False,
        "reason": "Casual conversation with no work commitments or action items.",
    })

    with patch("app.agent.nodes.decision.ChatOpenAI", return_value=_mock_llm(payload)):
        result = await decide_ticket_creation(_STATE_CASUAL)

    assert result["should_create_tickets"] is False
    assert "casual" in result["decision_reason"].lower() or len(result["decision_reason"]) > 0


async def test_fails_open_on_parse_error():
    from app.agent.nodes.decision import decide_ticket_creation

    with patch("app.agent.nodes.decision.ChatOpenAI", return_value=_mock_llm("not valid json {{{")):
        result = await decide_ticket_creation(_STATE_WITH_ITEMS)

    assert result["should_create_tickets"] is True


async def test_fails_open_on_llm_error():
    from app.agent.nodes.decision import decide_ticket_creation

    llm = AsyncMock()
    llm.ainvoke.side_effect = Exception("OpenAI timeout")

    with patch("app.agent.nodes.decision.ChatOpenAI", return_value=llm):
        result = await decide_ticket_creation(_STATE_WITH_ITEMS)

    assert result["should_create_tickets"] is True

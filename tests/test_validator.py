import json
from unittest.mock import AsyncMock, MagicMock, patch


def _mock_llm(content: str) -> AsyncMock:
    response = MagicMock()
    response.content = content
    llm = AsyncMock()
    llm.ainvoke.return_value = response
    return llm


def _make_ticket(tid: str = "abc12345", **overrides) -> dict:
    return {
        "id": tid,
        "title": "Fix login bug",
        "description": "Users can't log in after password reset",
        "ticket_type": "Bug",
        "priority": "High",
        "assignee": "Alice",
        "approved": None,
        **overrides,
    }


async def test_validate_tickets_passes_valid_tickets():
    from app.agent.nodes.validator import validate_tickets

    ticket = _make_ticket("abc12345")
    payload = json.dumps({
        "valid": True,
        "issues": [],
        "improved_tickets": [{
            "title": "Fix login bug",
            "description": "Users cannot log in after a password reset due to a session token bug.",
            "ticket_type": "Bug",
            "priority": "High",
            "assignee": "Alice",
        }],
    })

    state = {
        "tickets": [ticket],
        "transcript": "Alice: We need to fix the login bug after password reset.",
        "validation_attempts": 0,
    }

    with patch("app.agent.nodes.validator.ChatOpenAI", return_value=_mock_llm(payload)):
        result = await validate_tickets(state)

    assert result["validation_passed"] is True
    assert result["validation_attempts"] == 1
    assert result["tickets"][0]["id"] == "abc12345"  # id preserved
    assert "session token bug" in result["tickets"][0]["description"]  # improved text applied


async def test_validate_tickets_retries_on_invalid():
    from app.agent.nodes.validator import validate_tickets

    ticket = _make_ticket("abc12345")
    payload = json.dumps({
        "valid": False,
        "issues": ["Description is too vague — doesn't specify what 'login bug' means"],
        "improved_tickets": [{
            "title": "Fix login bug",
            "description": "Users cannot log in after a password reset.",
            "ticket_type": "Bug",
            "priority": "High",
            "assignee": "Alice",
        }],
    })

    state = {
        "tickets": [ticket],
        "transcript": "Alice: Fix the login bug.",
        "validation_attempts": 0,
    }

    with patch("app.agent.nodes.validator.ChatOpenAI", return_value=_mock_llm(payload)):
        result = await validate_tickets(state)

    assert result["validation_passed"] is False
    assert result["validation_attempts"] == 1
    assert result["tickets"][0]["id"] == "abc12345"


async def test_validate_tickets_forces_pass_at_max_retries():
    from app.agent.nodes.validator import validate_tickets

    ticket = _make_ticket("abc12345")
    payload = json.dumps({
        "valid": False,
        "issues": ["Still vague"],
        "improved_tickets": [{
            "title": "Fix login bug",
            "description": "Still not specific enough.",
            "ticket_type": "Bug",
            "priority": "High",
            "assignee": "Alice",
        }],
    })

    state = {
        "tickets": [ticket],
        "transcript": "Alice: Fix the login bug.",
        "validation_attempts": 2,  # already at max
    }

    with patch("app.agent.nodes.validator.ChatOpenAI", return_value=_mock_llm(payload)):
        result = await validate_tickets(state)

    assert result["validation_passed"] is True  # forced pass regardless of LLM verdict
    assert result["validation_attempts"] == 3


async def test_validate_tickets_fails_open_on_parse_error():
    from app.agent.nodes.validator import validate_tickets

    ticket = _make_ticket("abc12345")

    state = {
        "tickets": [ticket],
        "transcript": "Alice: Fix the login bug.",
        "validation_attempts": 0,
    }

    with patch("app.agent.nodes.validator.ChatOpenAI", return_value=_mock_llm("not json {{{garbage")):
        result = await validate_tickets(state)

    assert result["validation_passed"] is True  # fail open — don't block on parse errors
    assert result["validation_attempts"] == 1

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# ── helpers ──────────────────────────────────────────────────────────────────

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
        "description": "Users can't log in",
        "ticket_type": "Bug",
        "priority": "High",
        "assignee": "Alice",
        "approved": None,
        **overrides,
    }


# ── analyzer ─────────────────────────────────────────────────────────────────

async def test_analyze_meeting_parses_llm_response():
    from app.agent.nodes.analyzer import analyze_meeting

    payload = '{"meeting_type": "standup", "topics": ["deploy", "bug fix"], "decisions": ["ship it"]}'
    with patch("app.agent.nodes.analyzer.ChatOpenAI", return_value=_mock_llm(payload)):
        result = await analyze_meeting({"transcript": "Alice: we should ship it today"})

    assert result["meeting_type"] == "standup"
    assert "deploy" in result["topics"]
    assert "ship it" in result["decisions"]


async def test_analyze_meeting_handles_bad_json():
    from app.agent.nodes.analyzer import analyze_meeting

    with patch("app.agent.nodes.analyzer.ChatOpenAI", return_value=_mock_llm("not json at all")):
        result = await analyze_meeting({"transcript": "some transcript"})

    assert result["meeting_type"] == "planning"
    assert result["topics"] == []
    assert result["decisions"] == []


# ── extractor ─────────────────────────────────────────────────────────────────

async def test_extract_action_items_returns_list():
    from app.agent.nodes.extractor import extract_action_items

    payload = '{"action_items": [{"description": "Write tests", "assignee": "Bob", "due_hint": "tomorrow"}]}'
    with patch("app.agent.nodes.extractor.ChatOpenAI", return_value=_mock_llm(payload)):
        result = await extract_action_items({"transcript": "Bob: I'll write tests tomorrow"})

    assert len(result["action_items"]) == 1
    assert result["action_items"][0]["assignee"] == "Bob"


async def test_extract_action_items_handles_bad_json():
    from app.agent.nodes.extractor import extract_action_items

    with patch("app.agent.nodes.extractor.ChatOpenAI", return_value=_mock_llm("garbage")):
        result = await extract_action_items({"transcript": "some transcript"})

    assert result["action_items"] == []


# ── ticket_gen ────────────────────────────────────────────────────────────────

async def test_generate_tickets_creates_correct_structure():
    from app.agent.nodes.ticket_gen import generate_tickets

    payload = '{"tickets": [{"title": "Fix login", "description": "desc", "ticket_type": "Bug", "priority": "High", "assignee": "Alice"}]}'
    action_items = [{"description": "Fix login", "assignee": "Alice", "due_hint": None}]

    with (
        patch("app.agent.nodes.ticket_gen.ChatOpenAI", return_value=_mock_llm(payload)),
        patch("app.agent.nodes.ticket_gen.get_valid_issue_types", new=AsyncMock(return_value=["Bug", "Task"])),
    ):
        result = await generate_tickets({"action_items": action_items})

    tickets = result["tickets"]
    assert len(tickets) == 1
    t = tickets[0]
    assert "id" in t and len(t["id"]) == 8
    assert t["title"] == "Fix login"
    assert t["ticket_type"] == "Bug"
    assert t["priority"] == "High"
    assert t["approved"] is None


async def test_generate_tickets_handles_bad_json():
    from app.agent.nodes.ticket_gen import generate_tickets

    with (
        patch("app.agent.nodes.ticket_gen.ChatOpenAI", return_value=_mock_llm("bad")),
        patch("app.agent.nodes.ticket_gen.get_valid_issue_types", new=AsyncMock(return_value=["Bug", "Task"])),
    ):
        result = await generate_tickets({"action_items": []})

    assert result["tickets"] == []


# ── hitl ──────────────────────────────────────────────────────────────────────

async def test_human_review_filters_approved_tickets():
    from app.agent.nodes.hitl import human_review

    tickets = [_make_ticket("aaa11111"), _make_ticket("bbb22222"), _make_ticket("ccc33333")]
    decision = {"approved_ids": ["aaa11111", "ccc33333"], "edited_tickets": []}

    with patch("app.agent.nodes.hitl.interrupt", return_value=decision):
        result = await human_review({"tickets": tickets})

    ids = [t["id"] for t in result["approved_tickets"]]
    assert "aaa11111" in ids
    assert "ccc33333" in ids
    assert "bbb22222" not in ids
    assert all(t["approved"] is True for t in result["approved_tickets"])


async def test_human_review_applies_edits():
    from app.agent.nodes.hitl import human_review

    tickets = [_make_ticket("aaa11111", priority="Low")]
    decision = {
        "approved_ids": ["aaa11111"],
        "edited_tickets": [{"id": "aaa11111", "priority": "High"}],
    }

    with patch("app.agent.nodes.hitl.interrupt", return_value=decision):
        result = await human_review({"tickets": tickets})

    assert result["approved_tickets"][0]["priority"] == "High"


async def test_human_review_empty_approval():
    from app.agent.nodes.hitl import human_review

    tickets = [_make_ticket("aaa11111"), _make_ticket("bbb22222")]
    decision = {"approved_ids": [], "edited_tickets": []}

    with patch("app.agent.nodes.hitl.interrupt", return_value=decision):
        result = await human_review({"tickets": tickets})

    assert result["approved_tickets"] == []


# ── jira_push ─────────────────────────────────────────────────────────────────

async def test_push_to_jira_sets_jira_key():
    from app.agent.nodes.jira_push import push_to_jira

    mock_response = MagicMock()
    mock_response.is_success = True
    mock_response.json.return_value = {"key": "PROJ-42"}

    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.post.return_value = mock_response

    approved = [_make_ticket("abc12345", approved=True)]

    with (
        patch("app.agent.nodes.jira_push.get_issue_type_map", new=AsyncMock(return_value={"Bug": "10001", "Task": "10002"})),
        patch("app.agent.nodes.jira_push.httpx.AsyncClient", return_value=mock_client),
    ):
        result = await push_to_jira({"approved_tickets": approved})

    assert result["approved_tickets"][0]["jira_key"] == "PROJ-42"


async def test_push_to_jira_handles_api_failure_gracefully():
    from app.agent.nodes.jira_push import push_to_jira

    mock_response = MagicMock()
    mock_response.is_success = False
    mock_response.status_code = 500
    mock_response.text = "Internal Server Error"
    mock_response.raise_for_status.side_effect = Exception("500 Server Error")

    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.post.return_value = mock_response

    approved = [
        _make_ticket("aaa11111", approved=True),
        _make_ticket("bbb22222", approved=True),
    ]

    with (
        patch("app.agent.nodes.jira_push.get_issue_type_map", new=AsyncMock(return_value={"Bug": "10001", "Task": "10002"})),
        patch("app.agent.nodes.jira_push.httpx.AsyncClient", return_value=mock_client),
    ):
        result = await push_to_jira({"approved_tickets": approved})

    assert len(result["approved_tickets"]) == 2
    assert all(t["jira_key"] is None for t in result["approved_tickets"])


# ── summarizer ────────────────────────────────────────────────────────────────

async def test_generate_summary_returns_text():
    from app.agent.nodes.summarizer import generate_summary

    summary_text = "The team discussed deployment and decided to ship by Friday."
    with patch("app.agent.nodes.summarizer.ChatOpenAI", return_value=_mock_llm(summary_text)):
        result = await generate_summary(
            {
                "topics": ["deployment"],
                "decisions": ["ship by Friday"],
                "approved_tickets": [_make_ticket()],
            }
        )

    assert result["summary"] == summary_text


async def test_generate_summary_handles_empty_state():
    from app.agent.nodes.summarizer import generate_summary

    with patch("app.agent.nodes.summarizer.ChatOpenAI", return_value=_mock_llm("Short meeting.")):
        result = await generate_summary({"topics": [], "decisions": [], "approved_tickets": []})

    assert result["summary"] == "Short meeting."

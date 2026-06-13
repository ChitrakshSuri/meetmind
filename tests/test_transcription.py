import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.transcription.meetingbaas_client import (
    send_bot_to_meeting,
    get_meeting_data,
    fetch_transcript,
    build_transcript_text,
)


def _mock_client(method: str, json_return: dict):
    """Helper: returns an AsyncClient mock that responds to the given HTTP method."""
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = json_return

    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    getattr(mock_client, method).return_value = mock_response
    return mock_client


async def test_send_bot_to_meeting_returns_bot_id():
    payload = {"data": {"bot_id": "bot-abc-123"}}
    mock_client = _mock_client("post", payload)

    with patch("app.transcription.meetingbaas_client.httpx.AsyncClient", return_value=mock_client):
        bot_id = await send_bot_to_meeting("https://meet.google.com/abc", "TestBot")

    assert bot_id == "bot-abc-123"
    mock_client.post.assert_called_once()
    call_kwargs = mock_client.post.call_args
    assert call_kwargs.kwargs["json"]["bot_name"] == "TestBot"
    assert call_kwargs.kwargs["json"]["transcription_config"]["provider"] == "gladia"


async def test_send_bot_to_meeting_raises_on_http_error():
    mock_response = MagicMock()
    mock_response.raise_for_status.side_effect = Exception("401 Unauthorized")

    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.post.return_value = mock_response

    with patch("app.transcription.meetingbaas_client.httpx.AsyncClient", return_value=mock_client):
        with pytest.raises(Exception, match="401 Unauthorized"):
            await send_bot_to_meeting("https://meet.google.com/abc")


async def test_get_meeting_data_returns_data():
    payload = {"data": {"status": "in_call_recording", "participants": []}}
    mock_client = _mock_client("get", payload)

    with patch("app.transcription.meetingbaas_client.httpx.AsyncClient", return_value=mock_client):
        data = await get_meeting_data("bot-abc-123")

    assert data["status"] == "in_call_recording"


async def test_fetch_transcript_returns_list():
    segments = [{"speaker": "Alice", "text": "Hello"}]
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = segments

    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.get.return_value = mock_response

    with patch("app.transcription.meetingbaas_client.httpx.AsyncClient", return_value=mock_client):
        result = await fetch_transcript("https://s3.example.com/transcript.json")

    assert result == segments


async def test_build_transcript_text_formats_speakers():
    meeting_data = {
        "status": "completed",
        "transcription": "https://s3.example.com/transcript.json",
    }
    segments = [
        {"speaker": "Alice", "text": "We need to fix the login bug."},
        {"speaker": "Bob", "text": "I will take that."},
        {"speaker": "Alice", "text": "  "},  # whitespace-only — should be skipped
    ]

    with (
        patch(
            "app.transcription.meetingbaas_client.get_meeting_data",
            new=AsyncMock(return_value=meeting_data),
        ),
        patch(
            "app.transcription.meetingbaas_client.fetch_transcript",
            new=AsyncMock(return_value=segments),
        ),
    ):
        text = await build_transcript_text("bot-abc-123")

    assert text == "Alice: We need to fix the login bug.\nBob: I will take that."


async def test_build_transcript_text_raises_if_not_completed():
    meeting_data = {"status": "in_call_recording"}

    with patch(
        "app.transcription.meetingbaas_client.get_meeting_data",
        new=AsyncMock(return_value=meeting_data),
    ):
        with pytest.raises(ValueError, match="Meeting not completed yet"):
            await build_transcript_text("bot-abc-123")


async def test_build_transcript_text_skips_empty_segments():
    meeting_data = {
        "status": "completed",
        "transcription": "https://s3.example.com/transcript.json",
    }
    segments = [
        {"speaker": "Alice", "text": ""},
        {},
        {"speaker": "Bob", "text": "Valid line."},
    ]

    with (
        patch(
            "app.transcription.meetingbaas_client.get_meeting_data",
            new=AsyncMock(return_value=meeting_data),
        ),
        patch(
            "app.transcription.meetingbaas_client.fetch_transcript",
            new=AsyncMock(return_value=segments),
        ),
    ):
        text = await build_transcript_text("bot-abc-123")

    assert text == "Bob: Valid line."

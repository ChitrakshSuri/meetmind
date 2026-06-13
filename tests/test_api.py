import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ping():
    response = client.get("/api/v1/ping")
    assert response.status_code == 200
    assert response.json() == {"message": "MeetMind API is running"}


def test_start_meeting_returns_bot_id():
    with patch(
        "app.api.routes.send_bot_to_meeting",
        new=AsyncMock(return_value="bot-xyz-999"),
    ):
        response = client.post(
            "/api/v1/meetings/start",
            json={"meeting_url": "https://meet.google.com/abc", "bot_name": "MeetMind AI"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["bot_id"] == "bot-xyz-999"
    assert data["status"] == "bot_created"


def test_start_meeting_uses_default_bot_name():
    with patch(
        "app.api.routes.send_bot_to_meeting",
        new=AsyncMock(return_value="bot-default"),
    ) as mock_send:
        client.post(
            "/api/v1/meetings/start",
            json={"meeting_url": "https://meet.google.com/abc"},
        )
        _, kwargs = mock_send.call_args
        assert mock_send.call_args.args[1] == "MeetMind AI"


def test_meeting_status_returns_status():
    with patch(
        "app.api.routes.get_meeting_data",
        new=AsyncMock(return_value={"status": "in_call_recording"}),
    ):
        response = client.get("/api/v1/meetings/bot-abc-123/status")

    assert response.status_code == 200
    assert response.json()["status"] == "in_call_recording"
    assert response.json()["bot_id"] == "bot-abc-123"


def test_webhook_missing_bot_id_returns_400():
    response = client.post("/api/v1/webhook/meetingbaas", json={"status": "completed"})
    assert response.status_code == 400


def test_webhook_non_completed_status_returns_200():
    response = client.post(
        "/api/v1/webhook/meetingbaas",
        json={"bot_id": "bot-abc-123", "status": "in_call_recording"},
    )
    assert response.status_code == 200
    assert response.json() == {"received": True}


def test_webhook_completed_triggers_background_task():
    with patch("app.api.routes._process_meeting", new=AsyncMock()) as mock_process:
        response = client.post(
            "/api/v1/webhook/meetingbaas",
            json={"bot_id": "bot-abc-123", "status": "completed"},
        )

    assert response.status_code == 200
    assert response.json() == {"received": True}

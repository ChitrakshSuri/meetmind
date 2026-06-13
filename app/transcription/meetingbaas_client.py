import httpx
from app.config import settings

MEETINGBAAS_URL = "https://api.meetingbaas.com/v2"


async def send_bot_to_meeting(meeting_url: str, bot_name: str = "MeetMind AI") -> str:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{MEETINGBAAS_URL}/bots",
            headers={
                "x-meeting-baas-api-key": settings.meetingbaas_api_key,
                "Content-Type": "application/json",
            },
            json={
                "meeting_url": meeting_url,
                "bot_name": bot_name,
                "recording_mode": "speaker_view",
                "transcription_enabled": True,
                "transcription_config": {"provider": "gladia"},
                "callback_enabled": True,
                "callback_config": {
                    "url": settings.webhook_base_url + "/api/v1/webhook/meetingbaas",
                    "method": "POST",
                },
            },
        )
        response.raise_for_status()
        data = response.json()
        return data["data"]["bot_id"]


async def get_meeting_data(bot_id: str) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{MEETINGBAAS_URL}/bots/{bot_id}",
            headers={"x-meeting-baas-api-key": settings.meetingbaas_api_key},
        )
        response.raise_for_status()
        return response.json()["data"]


async def fetch_transcript(transcript_url: str) -> list:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(transcript_url)
        response.raise_for_status()
        data = response.json()

        # MeetingBaaS Gladia format:
        # {"bot_id": "...", "provider": "gladia", "result": {"utterances": [...]}}
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            utterances = (
                data.get("result", {}).get("utterances")
                or data.get("utterances")
                or data.get("segments")
                or []
            )
            return utterances
        return []


async def build_transcript_text(bot_id: str) -> str:
    data = await get_meeting_data(bot_id)

    if data["status"] != "completed":
        raise ValueError(f"Meeting not completed yet. Status: {data['status']}")

    transcript_data = await fetch_transcript(data["transcription"])

    lines = []
    for segment in transcript_data:
        # Gladia utterances use "speaker" key
        speaker = segment.get("speaker", segment.get("channel", "Unknown"))
        text = segment.get("text", "").strip()
        if text:
            lines.append(f"{speaker}: {text}")

    return "\n".join(lines)

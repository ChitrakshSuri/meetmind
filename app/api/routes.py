import asyncio
import logging
from fastapi import APIRouter, HTTPException
from app.api.schemas import StartMeetingRequest, StartMeetingResponse, MeetingStatusResponse
from app.transcription.meetingbaas_client import send_bot_to_meeting, get_meeting_data, build_transcript_text

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/ping")
def ping():
    return {"message": "MeetMind API is running"}


@router.post("/meetings/start", response_model=StartMeetingResponse)
async def start_meeting(request: StartMeetingRequest):
    bot_id = await send_bot_to_meeting(request.meeting_url, request.bot_name)
    return StartMeetingResponse(bot_id=bot_id, status="bot_created")


@router.get("/meetings/{bot_id}/status", response_model=MeetingStatusResponse)
async def meeting_status(bot_id: str):
    data = await get_meeting_data(bot_id)
    return MeetingStatusResponse(bot_id=bot_id, status=data["status"])


@router.post("/webhook/meetingbaas")
async def meetingbaas_webhook(payload: dict):
    bot_id = payload.get("bot_id")
    status = payload.get("status")

    if not bot_id:
        raise HTTPException(status_code=400, detail="Missing bot_id in payload")

    if status == "completed":
        logger.info(f"Meeting {bot_id} completed — fetching transcript")
        # Agent pipeline hooked in here in Phase 3
        asyncio.create_task(_process_meeting(bot_id))

    return {"received": True}


async def _process_meeting(bot_id: str):
    try:
        transcript = await build_transcript_text(bot_id)
        logger.info(f"Transcript ready for {bot_id} ({len(transcript)} chars)")
        # TODO Phase 3: await start_agent_pipeline(bot_id, transcript)
    except Exception as e:
        logger.error(f"Failed to process meeting {bot_id}: {e}")

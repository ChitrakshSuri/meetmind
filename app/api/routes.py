import asyncio
import logging
from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select
from app.api.schemas import (
    StartMeetingRequest,
    StartMeetingResponse,
    MeetingStatusResponse,
    ApproveTicketsRequest,
)
from app.transcription.meetingbaas_client import (
    send_bot_to_meeting,
    get_meeting_data,
    fetch_transcript,
)
from app.db.base import AsyncSessionLocal
from app.db.models import Meeting
from app.agent.graph import get_graph
from app.agent.state import MeetingState
from langgraph.types import Command

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


@router.get("/meetings/{bot_id}/tickets")
async def get_tickets(bot_id: str, request: Request):
    graph = get_graph(request.app)
    if graph is None:
        raise HTTPException(status_code=503, detail="Agent not available")
    config = {"configurable": {"thread_id": bot_id}}
    state = await graph.aget_state(config)
    return {"tickets": state.values.get("tickets", [])}


@router.get("/meetings/{bot_id}/summary")
async def get_summary(bot_id: str, request: Request):
    graph = get_graph(request.app)
    if graph is None:
        raise HTTPException(status_code=503, detail="Agent not available")
    config = {"configurable": {"thread_id": bot_id}}
    state = await graph.aget_state(config)
    return {
        "summary": state.values.get("summary", ""),
        "voice_summary_path": state.values.get("voice_summary_path", ""),
    }


@router.post("/meetings/{bot_id}/approve")
async def approve_tickets(bot_id: str, payload: ApproveTicketsRequest, request: Request):
    graph = get_graph(request.app)
    if graph is None:
        raise HTTPException(status_code=503, detail="Agent not available")

    config = {"configurable": {"thread_id": bot_id}}
    human_decision = {
        "approved_ids": payload.approved_ids,
        "edited_tickets": payload.edited_tickets,
    }
    final_state = await graph.ainvoke(Command(resume=human_decision), config=config)

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Meeting).where(Meeting.bot_id == bot_id))
        meeting = result.scalar_one_or_none()
        if meeting:
            meeting.status = "completed"
            meeting.summary = final_state.get("summary", "")
            meeting.voice_summary_path = final_state.get("voice_summary_path", "")
            await db.commit()
            logger.info(f"Meeting {bot_id} marked completed in DB")

    return {"status": "pipeline_complete"}


@router.post("/webhook/meetingbaas")
async def meetingbaas_webhook(payload: dict, request: Request):
    bot_id = payload.get("bot_id")
    status = payload.get("status")

    if not bot_id:
        raise HTTPException(status_code=400, detail="Missing bot_id in payload")

    if status == "completed":
        logger.info(f"Meeting {bot_id} completed — starting agent pipeline")
        asyncio.create_task(_process_meeting(bot_id, request.app))

    return {"received": True}


async def _process_meeting(bot_id: str, app) -> None:
    try:
        meeting_data = await get_meeting_data(bot_id)
        meeting_url = meeting_data.get("meeting_url", "")

        transcript_segments = await fetch_transcript(meeting_data["transcription"])
        transcript = "\n".join(
            f"{seg.get('speaker', 'Unknown')}: {seg.get('text', '').strip()}"
            for seg in transcript_segments
            if seg.get("text", "").strip()
        )
        logger.info(f"Transcript ready for {bot_id} ({len(transcript)} chars)")

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Meeting).where(Meeting.bot_id == bot_id))
            meeting = result.scalar_one_or_none()
            if meeting is None:
                meeting = Meeting(
                    bot_id=bot_id,
                    meeting_url=meeting_url,
                    status="agent_running",
                    transcript=transcript,
                )
                db.add(meeting)
            else:
                meeting.transcript = transcript
                meeting.status = "agent_running"
            await db.commit()

        graph = get_graph(app)
        if graph is None:
            logger.error(f"Graph not initialized, skipping agent for {bot_id}")
            return

        initial_state: MeetingState = {
            "messages": [],
            "bot_id": bot_id,
            "transcript": transcript,
            "meeting_type": "",
            "topics": [],
            "decisions": [],
            "action_items": [],
            "tickets": [],
            "approved_tickets": [],
            "summary": "",
            "voice_summary_path": "",
        }
        config = {"configurable": {"thread_id": bot_id}}
        await graph.ainvoke(initial_state, config=config)
        logger.info(f"Agent pipeline paused at human_review for {bot_id}")
    except Exception as e:
        logger.error(f"Failed to process meeting {bot_id}: {e}")

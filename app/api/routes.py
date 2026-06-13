import asyncio
import logging
import traceback
import httpx
from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select
from app.config import settings
from app.agent.nodes.jira_push import _basic_auth
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
    return {"summary": state.values.get("summary", "")}


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
            await db.commit()
            logger.info(f"Meeting {bot_id} marked completed in DB")

    return {"status": "pipeline_complete"}


@router.get("/jira/assignees")
async def get_jira_assignees():
    headers = {
        "Authorization": f"Basic {_basic_auth()}",
        "Accept": "application/json",
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{settings.atlassian_base_url}/rest/api/3/user/assignable/search",
            params={"project": settings.jira_project_key},
            headers=headers,
        )
        if not response.is_success:
            return []
        return response.json()


@router.post("/webhook/meetingbaas")
async def meetingbaas_webhook(payload: dict, request: Request):
    bot_id = payload.get("bot_id") or payload.get("data", {}).get("bot_id")
    event = payload.get("event", "")
    status = "completed" if event == "bot.completed" else payload.get("status") or payload.get("data", {}).get("status")

    if not bot_id:
        raise HTTPException(status_code=400, detail="Missing bot_id in payload")

    if status == "completed":
        logger.info(f"Meeting {bot_id} completed — starting agent pipeline")
        asyncio.create_task(_process_meeting(bot_id, request.app))

    return {"received": True}


async def _process_meeting(bot_id: str, app) -> None:
    try:
        logger.info(f"[{bot_id}] Fetching meeting data from MeetingBaaS")
        meeting_data = await get_meeting_data(bot_id)
        meeting_url = meeting_data.get("meeting_url", "")
        logger.info(f"[{bot_id}] Meeting data received — status={meeting_data.get('status')}, url={meeting_url!r}")

        transcription_url = meeting_data.get("transcription")
        if not transcription_url:
            logger.error(f"[{bot_id}] No transcription URL in meeting data: {meeting_data}")
            return

        logger.info(f"[{bot_id}] Fetching transcript from {transcription_url}")
        transcript_segments = await fetch_transcript(transcription_url)
        logger.info(f"[{bot_id}] Got {len(transcript_segments)} transcript segments")

        transcript = "\n".join(
            f"{seg.get('speaker', 'Unknown')}: {seg.get('text', '').strip()}"
            for seg in transcript_segments
            if seg.get("text", "").strip()
        )
        logger.info(f"[{bot_id}] Transcript built — {len(transcript)} chars")

        logger.info(f"[{bot_id}] Saving Meeting row to DB")
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
        logger.info(f"[{bot_id}] Meeting row saved")

        graph = get_graph(app)
        if graph is None:
            logger.error(f"[{bot_id}] Graph not initialized — checkpointer may have failed at startup")
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
        }
        config = {"configurable": {"thread_id": bot_id}}
        logger.info(f"[{bot_id}] Invoking LangGraph agent")
        await graph.ainvoke(initial_state, config=config)
        logger.info(f"[{bot_id}] Agent paused at human_review — awaiting approval")
    except Exception as e:
        logger.error(f"[{bot_id}] Failed to process meeting: {e}\n{traceback.format_exc()}")

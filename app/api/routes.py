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


@router.get("/jira/metadata")
async def get_jira_metadata():
    headers = {"Authorization": f"Basic {_basic_auth()}", "Accept": "application/json"}
    base = settings.atlassian_base_url
    project = settings.jira_project_key

    async with httpx.AsyncClient(timeout=15.0) as client:
        board_r = await client.get(
            f"{base}/rest/agile/1.0/board",
            params={"projectKeyOrId": project},
            headers=headers,
        )
        board_id = None
        if not isinstance(board_r, Exception) and board_r.is_success:
            boards = board_r.json().get("values", [])
            if boards:
                board_id = boards[0]["id"]

        tasks = [
            client.get(f"{base}/rest/api/3/user/assignable/search",
                       params={"project": project, "maxResults": 50}, headers=headers),
            client.get(f"{base}/rest/api/3/priority", headers=headers),
            client.get(f"{base}/rest/api/3/issue/createmeta/{project}/issuetypes", headers=headers),
            client.get(f"{base}/rest/api/3/label", params={"maxResults": 100}, headers=headers),
            client.get(f"{base}/rest/api/3/search",
                       params={"jql": f"project={project} AND issuetype=Epic ORDER BY created DESC",
                               "maxResults": 20, "fields": "summary,status"},
                       headers=headers),
            client.get(f"{base}/rest/api/3/project/{project}/statuses", headers=headers),
        ]
        if board_id:
            tasks.append(
                client.get(
                    f"{base}/rest/agile/1.0/board/{board_id}/sprint",
                    params={"state": "active,future", "maxResults": 10},
                    headers=headers,
                )
            )

        results = await asyncio.gather(*tasks, return_exceptions=True)

    (assignees_r, priorities_r, issuetypes_r, labels_r, epics_r, statuses_r, *sprint_results) = results
    sprints_r = sprint_results[0] if sprint_results else None

    def ok(r):
        return not isinstance(r, Exception) and getattr(r, "is_success", False)

    seen_statuses: set[str] = set()
    statuses = []
    if ok(statuses_r):
        for issue_type_block in statuses_r.json():
            for s in issue_type_block.get("statuses", []):
                if s["name"] not in seen_statuses:
                    seen_statuses.add(s["name"])
                    cat = s.get("statusCategory", {})
                    statuses.append({
                        "id": s["id"],
                        "name": s["name"],
                        "category": cat.get("name", ""),
                        "categoryColor": cat.get("colorName", ""),
                    })

    return {
        "assignees": [
            {"accountId": u["accountId"], "displayName": u["displayName"],
             "avatar": u.get("avatarUrls", {}).get("24x24", "")}
            for u in (assignees_r.json() if ok(assignees_r) else [])
            if u.get("accountType") == "atlassian"
        ],
        "priorities": [
            {"id": p["id"], "name": p["name"]}
            for p in (priorities_r.json() if ok(priorities_r) else [])
        ],
        "issue_types": [
            {"id": t["id"], "name": t["name"], "hierarchyLevel": t.get("hierarchyLevel", 0)}
            for t in (issuetypes_r.json().get("issueTypes", []) if ok(issuetypes_r) else [])
            if not t.get("subtask")
        ],
        "labels": (labels_r.json().get("values", []) if ok(labels_r) else []),
        "epics": [
            {"key": i["key"], "summary": i["fields"]["summary"],
             "status": i["fields"].get("status", {}).get("name", "")}
            for i in (epics_r.json().get("issues", []) if ok(epics_r) else [])
        ],
        "statuses": statuses,
        "sprints": [
            {"id": s["id"], "name": s["name"], "state": s["state"]}
            for s in (sprints_r.json().get("values", []) if ok(sprints_r) else [])
        ],
        "board_id": board_id,
        "project_key": project,
    }


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
            "should_create_tickets": True,
            "decision_reason": "",
            "jira_push_failed_tickets": [],
        }
        config = {"configurable": {"thread_id": bot_id}}
        logger.info(f"[{bot_id}] Invoking LangGraph agent")
        await graph.ainvoke(initial_state, config=config)
        logger.info(f"[{bot_id}] Agent paused at human_review — awaiting approval")
    except Exception as e:
        logger.error(f"[{bot_id}] Failed to process meeting: {e}\n{traceback.format_exc()}")

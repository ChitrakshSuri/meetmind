from pydantic import BaseModel
from typing import Optional


class StartMeetingRequest(BaseModel):
    meeting_url: str
    bot_name: str = "MeetMind AI"


class StartMeetingResponse(BaseModel):
    bot_id: str
    status: str


class MeetingStatusResponse(BaseModel):
    bot_id: str
    status: str
    transcript: Optional[str] = None

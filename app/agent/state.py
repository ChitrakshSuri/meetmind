from typing import Annotated
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages


class MeetingState(TypedDict):
    messages: Annotated[list, add_messages]
    bot_id: str
    transcript: str
    meeting_type: str
    topics: list[str]
    decisions: list[str]
    action_items: list[dict]
    tickets: list[dict]
    approved_tickets: list[dict]
    summary: str
    voice_summary_path: str

from typing import Annotated
from typing_extensions import TypedDict, NotRequired
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
    validation_passed: NotRequired[bool]
    validation_attempts: NotRequired[int]
    should_create_tickets: NotRequired[bool]
    decision_reason: NotRequired[str]

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.base import BaseCheckpointSaver
from app.agent.state import MeetingState
from app.agent.nodes.analyzer import analyze_meeting
from app.agent.nodes.extractor import extract_action_items
from app.agent.nodes.decision import decide_ticket_creation
from app.agent.nodes.ticket_gen import generate_tickets
from app.agent.nodes.validator import validate_tickets
from app.agent.nodes.hitl import human_review
from app.agent.nodes.jira_push import push_to_jira
from app.agent.nodes.summarizer import generate_summary


def route_ticket_decision(state: MeetingState) -> str:
    if state.get("should_create_tickets", True):
        return "generate_tickets"
    return "generate_summary"


def should_retry_validation(state: MeetingState) -> str:
    if state.get("validation_passed", True):
        return "human_review"
    if state.get("validation_attempts", 0) >= 2:
        return "human_review"
    return "generate_tickets"


def build_graph(checkpointer: BaseCheckpointSaver):
    builder = StateGraph(MeetingState)

    builder.add_node("analyze_meeting", analyze_meeting)
    builder.add_node("extract_action_items", extract_action_items)
    builder.add_node("decide_ticket_creation", decide_ticket_creation)
    builder.add_node("generate_tickets", generate_tickets)
    builder.add_node("validate_tickets", validate_tickets)
    builder.add_node("human_review", human_review)
    builder.add_node("push_to_jira", push_to_jira)
    builder.add_node("generate_summary", generate_summary)

    builder.add_edge(START, "analyze_meeting")
    builder.add_edge("analyze_meeting", "extract_action_items")
    builder.add_edge("extract_action_items", "decide_ticket_creation")
    builder.add_conditional_edges("decide_ticket_creation", route_ticket_decision)
    builder.add_edge("generate_tickets", "validate_tickets")
    builder.add_conditional_edges("validate_tickets", should_retry_validation)
    builder.add_edge("human_review", "push_to_jira")
    builder.add_edge("push_to_jira", "generate_summary")
    builder.add_edge("generate_summary", END)

    return builder.compile(checkpointer=checkpointer)


def get_graph(app):
    return getattr(app.state, "graph", None)

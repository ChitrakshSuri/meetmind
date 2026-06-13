from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.base import BaseCheckpointSaver
from app.agent.state import MeetingState
from app.agent.nodes.analyzer import analyze_meeting
from app.agent.nodes.extractor import extract_action_items
from app.agent.nodes.ticket_gen import generate_tickets
from app.agent.nodes.hitl import human_review
from app.agent.nodes.jira_push import push_to_jira
from app.agent.nodes.summarizer import generate_summary


def build_graph(checkpointer: BaseCheckpointSaver):
    builder = StateGraph(MeetingState)

    builder.add_node("analyze_meeting", analyze_meeting)
    builder.add_node("extract_action_items", extract_action_items)
    builder.add_node("generate_tickets", generate_tickets)
    builder.add_node("human_review", human_review)
    builder.add_node("push_to_jira", push_to_jira)
    builder.add_node("generate_summary", generate_summary)

    builder.add_edge(START, "analyze_meeting")
    builder.add_edge("analyze_meeting", "extract_action_items")
    builder.add_edge("extract_action_items", "generate_tickets")
    builder.add_edge("generate_tickets", "human_review")
    builder.add_edge("human_review", "push_to_jira")
    builder.add_edge("push_to_jira", "generate_summary")
    builder.add_edge("generate_summary", END)

    return builder.compile(checkpointer=checkpointer)


def get_graph(app):
    return app.state.graph

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.base import BaseCheckpointSaver
from app.agent.state import MeetingState


def _noop(state: MeetingState) -> dict:
    return {}


def build_graph(checkpointer: BaseCheckpointSaver):
    builder = StateGraph(MeetingState)
    # Real nodes wired in Phase 3
    builder.add_node("noop", _noop)
    builder.add_edge(START, "noop")
    builder.add_edge("noop", END)
    return builder.compile(checkpointer=checkpointer)


def get_graph(app):
    return app.state.graph

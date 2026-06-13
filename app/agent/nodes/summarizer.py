import logging
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from app.agent.state import MeetingState

logger = logging.getLogger(__name__)

_PROMPT = """Write a 3-4 sentence meeting summary based on the information below.
Respond with plain text only — no JSON, no markdown, no bullet points.

Rules:
- Sentence 1: what the meeting was about and the main topics
- Sentence 2: key decisions made
- Sentence 3-4: what's happening next (action items and owners)
- Tone: professional but conversational, as if written by a senior engineer for their team

Example output:
"The team held a sprint planning session covering the upcoming auth refactor and API rate limiting work. It was decided that the rate limiter fix takes priority before Thursday's client demo. Bob will handle the rate limiter bug, Alice will update the API docs by end of week, and Carol is investigating the production memory leak. All three items have been logged as Jira tickets."

Now write a summary for:
Topics discussed: {topics}
Decisions made: {decisions}
Action items created: {ticket_titles}"""


async def generate_summary(state: MeetingState) -> dict:
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    topics = state.get("topics", [])
    decisions = state.get("decisions", [])
    ticket_titles = [t["title"] for t in state.get("approved_tickets", [])]

    response = await llm.ainvoke(
        [
            HumanMessage(
                content=_PROMPT.format(
                    topics=", ".join(topics) if topics else "Not specified",
                    decisions=", ".join(decisions) if decisions else "None",
                    ticket_titles=", ".join(ticket_titles) if ticket_titles else "None",
                )
            )
        ]
    )
    return {"summary": response.content.strip()}

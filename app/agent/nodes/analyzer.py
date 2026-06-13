import json
import logging
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from app.agent.state import MeetingState

logger = logging.getLogger(__name__)

_PROMPT = """Analyze this meeting transcript and respond ONLY with valid JSON — no markdown, no preamble.

Rules:
- meeting_type must be exactly one of: standup, client_call, planning
- topics: concrete subjects discussed (not vague like "general discussion")
- decisions: only things that were explicitly agreed upon, not maybes

Example input:
"Alice: We shipped the auth service yesterday. Bob: Nice. We still need to fix the rate limiter bug before the client demo on Thursday. Alice: Agreed, Bob owns that. Also we're moving standups to 9am starting Monday."

Example output:
{{"meeting_type": "standup", "topics": ["auth service deployment", "rate limiter bug", "standup time change"], "decisions": ["Bob will fix rate limiter before Thursday demo", "Standups move to 9am on Monday"]}}

Now analyze this transcript:
{transcript}"""


async def analyze_meeting(state: MeetingState) -> dict:
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    response = await llm.ainvoke(
        [HumanMessage(content=_PROMPT.format(transcript=state["transcript"]))]
    )
    try:
        data = json.loads(response.content)
        return {
            "meeting_type": data.get("meeting_type", "planning"),
            "topics": data.get("topics", []),
            "decisions": data.get("decisions", []),
        }
    except (json.JSONDecodeError, AttributeError) as e:
        logger.error(f"Failed to parse analyzer response: {e}\nRaw: {response.content!r}")
        return {"meeting_type": "planning", "topics": [], "decisions": []}

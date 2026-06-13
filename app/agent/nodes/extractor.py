import json
import logging
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from app.agent.state import MeetingState

logger = logging.getLogger(__name__)


def _clean_json(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]
    return text.strip()


_PROMPT = """Extract every action item from this meeting transcript.
Respond ONLY with valid JSON — no markdown, no preamble.

Rules:
- Capture every task, bug fix, follow-up, or commitment made by any speaker
- assignee: use the speaker's name if they volunteered or were assigned; otherwise "Unassigned"
- due_hint: exact phrase from the transcript if a deadline was mentioned, otherwise null
- description: be specific — include what, why, and any relevant context from the transcript

Example input:
"Alice: I'll update the API docs by end of week. Bob: We need someone to look into the memory leak on the prod server. Carol: I can take that, probably needs a day or two."

Example output:
{{"action_items": [{{"description": "Update API documentation", "assignee": "Alice", "due_hint": "end of week"}}, {{"description": "Investigate and fix memory leak on production server", "assignee": "Carol", "due_hint": "1-2 days"}}]}}

Now extract from this transcript:
{transcript}"""


async def extract_action_items(state: MeetingState) -> dict:
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    response = await llm.ainvoke(
        [HumanMessage(content=_PROMPT.format(transcript=state["transcript"]))]
    )
    try:
        data = json.loads(_clean_json(response.content))
        return {"action_items": data.get("action_items", [])}
    except (json.JSONDecodeError, AttributeError) as e:
        logger.error(f"Failed to parse extractor response: {e}\nRaw: {response.content!r}")
        return {"action_items": []}

# MeetMind

An AI-powered meeting assistant that joins your calls, transcribes the conversation, extracts action items, and creates Jira tickets — all with a human-in-the-loop review step before anything is pushed.

---

## How it works

```
Meeting call
     │
     ▼
MeetingBaaS bot joins & records
     │
     ▼ (webhook: bot.completed)
Transcript fetched (Gladia STT)
     │
     ▼
LangGraph pipeline
  ├─ analyze_meeting      → meeting type, topics, decisions
  ├─ extract_action_items → structured action items
  ├─ generate_tickets     → Jira tickets (types fetched live from Jira)
  ├─ human_review         → ⏸ HITL interrupt — user reviews/edits in UI
  ├─ push_to_jira         → creates issues via Jira REST API v3
  └─ generate_summary     → GPT-4o meeting summary
```

The pipeline pauses at `human_review` using LangGraph's `interrupt()`. The React UI lets you edit every ticket field — type, priority, assignee (with avatar search), sprint, labels, parent epic, start/due dates — before approving. Only then does the graph resume and push to Jira.

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | FastAPI + Python 3.12, async throughout |
| AI pipeline | LangGraph `StateGraph` with `AsyncPostgresSaver` checkpointing |
| LLM | GPT-4o via `langchain-openai` |
| Meeting recording | MeetingBaaS v2 API (Gladia transcription) |
| Database | PostgreSQL 16 + SQLAlchemy async + Alembic |
| Frontend | React 18 + Vite + Tailwind CSS |
| Observability | LangSmith tracing |
| Deployment | Docker Compose (multi-stage builds) |

---

## Prerequisites

- Docker & Docker Compose
- A public HTTPS URL for the MeetingBaaS webhook (ngrok works for local dev)
- API keys listed in the setup section below

---

## Setup

**1. Clone and copy env file**

```bash
git clone https://github.com/your-username/meetmind.git
cd meetmind
cp .env.example .env
```

**2. Fill in `.env`**

```env
# OpenAI
OPENAI_API_KEY=sk-...

# MeetingBaaS — joins and records your meetings (~$0.10/meeting)
# Get key at https://auth.meetingbaas.com
MEETINGBAAS_API_KEY=mb-...

# Jira / Atlassian
ATLASSIAN_BASE_URL=https://yourcompany.atlassian.net
ATLASSIAN_API_TOKEN=...          # Profile → Manage account → Security → API tokens
ATLASSIAN_EMAIL=you@company.com
JIRA_PROJECT_KEY=ENG             # The short key shown in your project URL

# LangSmith (optional but recommended)
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=ls__...
LANGCHAIN_PROJECT=meetmind

# Database (Docker Compose sets this automatically)
DATABASE_URL=postgresql+asyncpg://meetmind:meetmind@localhost:5432/meetmind

# Webhook — must be publicly reachable by MeetingBaaS
# Use ngrok: `ngrok http 8000` then paste the https URL here
WEBHOOK_BASE_URL=https://your-ngrok-url.ngrok.io
```

**3. Start everything**

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

**4. Run database migrations** (first time only)

```bash
docker compose exec backend alembic upgrade head
```

---

## Local development (without Docker)

```bash
# Backend
poetry install
poetry run uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev        # http://localhost:5173
```

The Vite dev server proxies `/api` to `localhost:8000`.

---

## Project structure

```
meetmind/
├── app/
│   ├── agent/
│   │   ├── graph.py              # LangGraph StateGraph definition
│   │   ├── state.py              # MeetingState TypedDict
│   │   └── nodes/
│   │       ├── analyzer.py       # meeting type, topics, decisions
│   │       ├── extractor.py      # action item extraction
│   │       ├── ticket_gen.py     # GPT-4o → Jira tickets (dynamic types)
│   │       ├── hitl.py           # human-in-the-loop interrupt
│   │       ├── jira_push.py      # Jira REST API v3 push + type cache
│   │       └── summarizer.py     # meeting summary
│   ├── api/
│   │   ├── routes.py             # FastAPI endpoints + webhook handler
│   │   └── schemas.py            # Pydantic request/response models
│   ├── db/
│   │   ├── models.py             # SQLAlchemy Meeting model
│   │   └── base.py               # async engine + session factory
│   ├── transcription/
│   │   └── meetingbaas_client.py # bot creation + transcript fetch
│   ├── config.py                 # Pydantic Settings (extra="ignore")
│   └── main.py                   # FastAPI app + async lifespan
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── MeetingInput.jsx  # step 1: enter meeting URL
│       │   ├── StatusPoller.jsx  # step 2: poll with exponential backoff
│       │   ├── TicketReview.jsx  # step 3: review + edit tickets
│       │   └── Summary.jsx       # step 4: summary + Jira link
│       └── api/client.js         # Axios API calls
├── tests/
├── alembic/                      # database migrations
├── docker-compose.yml
└── .env.example
```

---

## API reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/meetings/start` | Send bot to a meeting URL |
| `GET` | `/api/v1/meetings/{bot_id}/status` | Poll meeting status |
| `GET` | `/api/v1/meetings/{bot_id}/tickets` | Get generated tickets |
| `POST` | `/api/v1/meetings/{bot_id}/approve` | Resume pipeline with approved/edited tickets |
| `GET` | `/api/v1/meetings/{bot_id}/summary` | Get meeting summary |
| `GET` | `/api/v1/jira/metadata` | Live Jira metadata: assignees, issue types, sprints, epics, statuses |
| `POST` | `/api/v1/webhook/meetingbaas` | Receives `bot.completed`, triggers pipeline |
| `GET` | `/health` | Health check |

---

## Ticket editing

When reviewing tickets, every field is editable via a slide-in panel populated with live data from your Jira project:

- **Issue type** — button grid from your actual Jira issue types (never hardcoded)
- **Priority** — fetched from Jira, with emoji indicators
- **Assignee** — searchable dropdown with avatars
- **Sprint** — active and upcoming sprints, auto-discovered via Agile API
- **Parent epic** — recent epics with status; hidden when editing an Epic-level type
- **Labels** — chip input with autocomplete from existing labels, free-text creation with Enter
- **Start date / Due date** — date pickers
- **Description** — full text edit

Tickets can be approved or rejected individually. Rejected tickets are skipped during push. You can also end the session without pushing to Jira at all.

---

## Notes

- **Webhook**: `WEBHOOK_BASE_URL` must be reachable by MeetingBaaS. For local dev use [ngrok](https://ngrok.com): `ngrok http 8000`.
- **Persistence**: LangGraph state lives in Postgres via `AsyncPostgresSaver`, so the pipeline survives restarts and the HITL pause can last indefinitely.
- **Issue type caching**: valid Jira issue type IDs are fetched from `createmeta` on first use and cached in-process. Restart the backend to invalidate the cache.
- **STT errors**: the LLM prompts are written to handle garbled speech-to-text output — technical names are corrected from context rather than transcribed literally.

---

## Running tests

```bash
poetry run pytest
```

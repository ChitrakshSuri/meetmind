<div align="center">

# 🧠 MeetMind

### AI-powered meeting assistant that joins your meetings, transcribes them, and automatically creates Jira tickets — with human-in-the-loop approval before pushing anything.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-meetmind--green.vercel.app-6366f1?style=for-the-badge&logo=vercel)](https://meetmind-green.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-ChitrakshSuri%2Fmeetmind-181717?style=for-the-badge&logo=github)](https://github.com/ChitrakshSuri/meetmind)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-Agent-FF6B35?style=for-the-badge)](https://langchain-ai.github.io/langgraph/)

🌐 **Live Demo:** [meetmind-green.vercel.app](https://meetmind-green.vercel.app) &nbsp;|&nbsp; 📚 **API Docs:** [meetmind-wgo0.onrender.com/docs](https://meetmind-wgo0.onrender.com/docs)

</div>

---

![MeetMind Demo](docs/demo.gif)

---

## ✨ Key Features

- 🤖 **Auto-joins Google Meet / Zoom** via MeetingBaaS bot — no manual recording needed
- 🎙️ **Real-time transcription** via Gladia STT with speaker labeling
- 🧠 **LangGraph agent with 7 nodes:** analyze → decide → extract → generate → validate → HITL → push
- ✅ **Human-in-the-loop approval** — every ticket is reviewed and editable before anything hits Jira
- 🔄 **Corrective RAG** — agent validates its own tickets and self-corrects before showing to humans
- 🚦 **Conditional routing** — agent decides if tickets are even needed (skips for casual meetings)
- 🔁 **Exponential backoff retry** on Jira API failures (3 attempts: 5s → 15s → 30s)
- 🎯 **Dynamic Jira metadata** — fetches issue types, priorities, assignees, sprints, epics at runtime
- 📊 **LangSmith observability** for full agent tracing and token usage
- 🐳 **Fully dockerized** with Docker Compose and Postgres checkpointing

---

## 🏗️ Architecture

```
Google Meet / Zoom
       ↓
MeetingBaaS Bot (joins + records)
       ↓
Gladia STT (transcription)
       ↓
Webhook → FastAPI Backend
       ↓
┌─────────────────────────────────────┐
│           LangGraph Agent           │
│                                     │
│  analyze_meeting                    │
│       ↓                             │
│  extract_action_items               │
│       ↓                             │
│  decide_ticket_creation ──→ summary │
│       ↓ (yes)                       │
│  generate_tickets                   │
│       ↓                             │
│  validate_tickets (corrective RAG)  │
│       ↓                             │
│  human_review (HITL pause) ⏸       │
│       ↓ (approved)                  │
│  push_to_jira (retry loop)          │
│       ↓                             │
│  generate_summary                   │
└─────────────────────────────────────┘
       ↓
React Frontend (review + approve)
       ↓
Jira Board (tickets created)
```

The pipeline **pauses at `human_review`** using LangGraph's `interrupt()`. LangGraph state is persisted in Postgres via `AsyncPostgresSaver`, so the pause survives server restarts and can last indefinitely.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Meeting Bot | MeetingBaaS v2 |
| Transcription | Gladia (via MeetingBaaS) |
| Agent Framework | LangGraph |
| LLM | GPT-4o |
| Backend | FastAPI + Python 3.12 |
| Database | PostgreSQL + SQLAlchemy async |
| Migrations | Alembic |
| Frontend | React 18 + Vite + Tailwind CSS |
| Jira Integration | Atlassian REST API v3 |
| Observability | LangSmith |
| Containerization | Docker + Docker Compose |
| Deployment | Render (backend) + Vercel (frontend) |

---

## 🚀 Quick Start

```bash
git clone https://github.com/ChitrakshSuri/meetmind
cd meetmind
cp .env.example .env
# Fill in your API keys in .env
docker compose up --build
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000/docs
```

---

## 🔑 Environment Variables

```
OPENAI_API_KEY          # GPT-4o for all agent nodes
MEETINGBAAS_API_KEY     # Meeting bot + Gladia transcription
ATLASSIAN_API_TOKEN     # Jira ticket creation (API token, not password)
ATLASSIAN_EMAIL         # Your Atlassian account email
ATLASSIAN_BASE_URL      # https://yoursite.atlassian.net
JIRA_PROJECT_KEY        # e.g. KAN
LANGCHAIN_API_KEY       # LangSmith observability (optional)
DATABASE_URL            # PostgreSQL connection string
WEBHOOK_BASE_URL        # Public URL for MeetingBaaS webhook callback
FRONTEND_URL            # Frontend URL for CORS
WEBHOOK_SECRET          # Shared secret to validate incoming webhooks (optional)
```

See [`.env.example`](.env.example) for all options with descriptions.

> **Local webhook**: MeetingBaaS needs to reach your `WEBHOOK_BASE_URL`. For local dev use [ngrok](https://ngrok.com): `ngrok http 8000`.

---

## ⚙️ How It Works

1. Paste your Google Meet or Zoom URL in the UI
2. MeetMind sends an AI bot to join your meeting
3. Bot records and transcribes in real-time using Gladia STT
4. When the meeting ends, MeetingBaaS fires a webhook to your backend
5. LangGraph agent analyzes the transcript and decides if tickets are needed
6. If yes: generates tickets → validates them (corrective RAG) → pauses for human review
7. You review, edit, approve or reject each ticket in the UI
8. Approved tickets are pushed to Jira with full metadata (sprint, assignee, labels, epic)
9. Meeting summary is generated and displayed

---

## 🎫 Ticket Editing

Every field is editable in the review UI, populated with live data from your Jira project:

- **Issue type** — button grid from your actual Jira issue types (never hardcoded)
- **Priority** — fetched from Jira, with emoji indicators
- **Assignee** — searchable dropdown with avatars
- **Sprint** — active and upcoming sprints, auto-discovered via Agile API
- **Parent epic** — recent epics with status; hidden when editing an Epic-level type
- **Labels** — chip input with autocomplete from existing labels, free-text creation with Enter
- **Start date / Due date** — date pickers
- **Description** — full text edit

---

## 📁 Project Structure

```
meetmind/
├── app/
│   ├── agent/
│   │   ├── graph.py              # LangGraph StateGraph definition
│   │   ├── state.py              # MeetingState TypedDict
│   │   └── nodes/
│   │       ├── analyzer.py       # meeting type, topics, decisions
│   │       ├── extractor.py      # action item extraction
│   │       ├── decision.py       # conditional routing node
│   │       ├── ticket_gen.py     # GPT-4o → Jira tickets
│   │       ├── validator.py      # corrective RAG validation
│   │       ├── hitl.py           # human-in-the-loop interrupt
│   │       ├── jira_push.py      # Jira REST API v3 + retry loop
│   │       └── summarizer.py     # meeting summary
│   ├── api/
│   │   ├── routes.py             # FastAPI endpoints + webhook handler
│   │   └── schemas.py            # Pydantic request/response models
│   ├── db/
│   │   ├── models.py             # SQLAlchemy Meeting + Ticket models
│   │   └── base.py               # async engine + session factory
│   ├── transcription/
│   │   └── meetingbaas_client.py # bot creation + transcript fetch
│   ├── config.py                 # Pydantic Settings
│   └── main.py                   # FastAPI app + async lifespan
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── MeetingInput.jsx  # step 1: enter meeting URL
│       │   ├── StatusPoller.jsx  # step 2: poll with exponential backoff
│       │   ├── TicketReview.jsx  # step 3: review + edit tickets
│       │   └── Summary.jsx       # step 4: summary + Jira link
│       └── api/client.js         # Axios API client
├── tests/                        # 43 tests
├── alembic/                      # database migrations
├── docker-compose.yml
└── .env.example
```

---

## 🧪 Testing

```bash
poetry run pytest tests/ -v
# 43 tests passing
```

Tests cover all agent nodes (with mocked LLMs), API endpoints, DB models, and transcription client.

---

## 📡 API Reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/meetings/start` | Send bot to a meeting URL |
| `GET` | `/api/v1/meetings/{bot_id}/status` | Poll meeting status |
| `GET` | `/api/v1/meetings/{bot_id}/tickets` | Get generated tickets |
| `POST` | `/api/v1/meetings/{bot_id}/approve` | Resume pipeline with approved/edited tickets |
| `GET` | `/api/v1/meetings/{bot_id}/summary` | Get meeting summary |
| `GET` | `/api/v1/jira/metadata` | Live Jira metadata: assignees, types, sprints, epics |
| `POST` | `/api/v1/webhook/meetingbaas` | Receives `bot.completed`, triggers pipeline |
| `GET` | `/health` | Health check |

---

## 📄 License

MIT

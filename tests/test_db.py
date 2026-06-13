import pytest
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from app.db.models import Base, Meeting, Ticket

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def engine():
    _engine = create_async_engine(TEST_DB_URL)
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield _engine
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await _engine.dispose()


@pytest.fixture
async def session(engine):
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as s:
        yield s


async def test_meeting_create_and_query(session):
    meeting = Meeting(
        bot_id="bot-test-001",
        meeting_url="https://meet.google.com/abc-defg-hij",
        status="processing",
    )
    session.add(meeting)
    await session.commit()
    await session.refresh(meeting)

    assert meeting.id is not None
    assert meeting.bot_id == "bot-test-001"
    assert meeting.status == "processing"
    assert meeting.transcript is None
    assert meeting.created_at is not None


async def test_meeting_query_by_bot_id(session):
    meeting = Meeting(
        bot_id="bot-test-002",
        meeting_url="https://meet.google.com/xyz",
        status="completed",
        transcript="Alice: Hello\nBob: Hi",
    )
    session.add(meeting)
    await session.commit()

    result = await session.execute(select(Meeting).where(Meeting.bot_id == "bot-test-002"))
    fetched = result.scalar_one()

    assert fetched.status == "completed"
    assert fetched.transcript == "Alice: Hello\nBob: Hi"


async def test_ticket_fk_to_meeting(session):
    meeting = Meeting(
        bot_id="bot-test-003",
        meeting_url="https://meet.google.com/ticket-test",
        status="completed",
    )
    session.add(meeting)
    await session.commit()
    await session.refresh(meeting)

    ticket = Ticket(
        meeting_id=meeting.id,
        title="Fix login bug",
        description="Users can't log in after password reset",
        ticket_type="Bug",
        priority="High",
    )
    session.add(ticket)
    await session.commit()
    await session.refresh(ticket)

    assert ticket.id is not None
    assert ticket.meeting_id == meeting.id
    assert ticket.approved is None
    assert ticket.jira_key is None


async def test_ticket_approval_states(session):
    meeting = Meeting(
        bot_id="bot-test-004",
        meeting_url="https://meet.google.com/approval-test",
        status="completed",
    )
    session.add(meeting)
    await session.commit()

    pending = Ticket(
        meeting_id=meeting.id, title="T1", description="d", ticket_type="Task", priority="Low"
    )
    approved = Ticket(
        meeting_id=meeting.id,
        title="T2",
        description="d",
        ticket_type="Story",
        priority="Medium",
        approved=True,
        jira_key="PROJ-42",
    )
    rejected = Ticket(
        meeting_id=meeting.id,
        title="T3",
        description="d",
        ticket_type="Bug",
        priority="High",
        approved=False,
    )
    session.add_all([pending, approved, rejected])
    await session.commit()

    result = await session.execute(select(Ticket).where(Ticket.meeting_id == meeting.id))
    tickets = result.scalars().all()

    assert len(tickets) == 3
    states = {t.title: t.approved for t in tickets}
    assert states["T1"] is None
    assert states["T2"] is True
    assert states["T3"] is False

    jira_ticket = next(t for t in tickets if t.jira_key)
    assert jira_ticket.jira_key == "PROJ-42"


async def test_meeting_tickets_relationship(session):
    meeting = Meeting(
        bot_id="bot-test-005",
        meeting_url="https://meet.google.com/rel-test",
        status="completed",
    )
    session.add(meeting)
    await session.commit()
    await session.refresh(meeting)

    for i in range(3):
        session.add(
            Ticket(
                meeting_id=meeting.id,
                title=f"Ticket {i}",
                description="desc",
                ticket_type="Task",
                priority="Low",
            )
        )
    await session.commit()

    result = await session.execute(
        select(Meeting).where(Meeting.id == meeting.id)
    )
    fetched = result.scalar_one()
    await session.refresh(fetched, ["tickets"])

    assert len(fetched.tickets) == 3

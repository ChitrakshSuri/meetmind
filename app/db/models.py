import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Boolean, DateTime, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    bot_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    meeting_url: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="processing")
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    voice_summary_path: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    tickets: Mapped[list["Ticket"]] = relationship("Ticket", back_populates="meeting")


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    meeting_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("meetings.id"), index=True
    )
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text)
    ticket_type: Mapped[str] = mapped_column(String)
    priority: Mapped[str] = mapped_column(String)
    assignee: Mapped[str | None] = mapped_column(String, nullable=True)
    approved: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    jira_key: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="tickets")

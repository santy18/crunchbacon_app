from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Voice(Base):
    __tablename__ = "voices"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    file_path: Mapped[str] = mapped_column(String(1024))
    description: Mapped[str | None] = mapped_column(String(1024), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=utcnow)

    generations: Mapped[list["Generation"]] = relationship(back_populates="voice")
    transcriptions: Mapped[list["Transcription"]] = relationship(back_populates="voice")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    data: Mapped[str | None] = mapped_column(Text, default=None)  # JSON string
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=utcnow)


class Generation(Base):
    __tablename__ = "generations"

    id: Mapped[int] = mapped_column(primary_key=True)
    text: Mapped[str] = mapped_column(Text)
    voice_id: Mapped[int | None] = mapped_column(ForeignKey("voices.id", ondelete="SET NULL"), default=None)
    ref_text: Mapped[str | None] = mapped_column(Text, default=None)
    audio_path: Mapped[str | None] = mapped_column(String(1024), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    voice: Mapped["Voice | None"] = relationship(back_populates="generations")


class Script(Base):
    __tablename__ = "scripts"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    content: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=utcnow)


class Transcription(Base):
    __tablename__ = "transcriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    text: Mapped[str] = mapped_column(Text)
    voice_id: Mapped[int | None] = mapped_column(ForeignKey("voices.id", ondelete="SET NULL"), default=None)
    source: Mapped[str | None] = mapped_column(String(255), default=None)
    audio_path: Mapped[str | None] = mapped_column(String(1024), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    voice: Mapped["Voice | None"] = relationship(back_populates="transcriptions")


class Setting(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    value: Mapped[str | None] = mapped_column(Text, default=None)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=utcnow)

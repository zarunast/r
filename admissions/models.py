from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def now():
    return datetime.now(timezone.utc)


class Quota(str, Enum):
    SPECIAL = "special"
    SEPARATE = "separate"
    TARGET = "target"
    GENERAL = "general"
    PAID = "paid"


class Applicant(Base):
    __tablename__ = "applicants"
    number: Mapped[str] = mapped_column(String(64), primary_key=True)
    surname: Mapped[str] = mapped_column(default="", index=True)
    first_name: Mapped[str] = mapped_column(default="")
    patronymic: Mapped[str] = mapped_column(default="")
    profile: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (
        UniqueConstraint("applicant_number", "year", "campaign", "direction", "study_form", "quota"),
        Index("ix_ranking", "year", "direction", "quota", "status", "total_score"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    applicant_number: Mapped[str] = mapped_column(ForeignKey("applicants.number"), index=True)
    year: Mapped[int]
    campaign: Mapped[str]
    direction: Mapped[str]
    study_form: Mapped[str]
    quota: Mapped[str]
    priority: Mapped[int] = mapped_column(default=1)
    status: Mapped[str] = mapped_column(default="participating")
    total_score: Mapped[int] = mapped_column(default=0)
    achievements: Mapped[int] = mapped_column(default=0)
    exams: Mapped[dict] = mapped_column(JSON, default=dict)
    consent: Mapped[bool] = mapped_column(Boolean, default=False)
    enrolled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source: Mapped[dict] = mapped_column(JSON, default=dict)


class SeatPlan(Base):
    __tablename__ = "seat_plans"
    __table_args__ = (UniqueConstraint("year", "campaign", "direction", "study_form", "quota"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    year: Mapped[int]
    campaign: Mapped[str]
    direction: Mapped[str]
    study_form: Mapped[str]
    quota: Mapped[str]
    seats: Mapped[int]


class Contract(Base):
    __tablename__ = "contracts"
    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[str] = mapped_column(unique=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), unique=True)
    location: Mapped[str] = mapped_column(default="admissions")
    stage: Mapped[str] = mapped_column(default="draft")
    paid: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ContractEvent(Base):
    __tablename__ = "contract_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    contract_id: Mapped[int] = mapped_column(ForeignKey("contracts.id"), index=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    actor: Mapped[str]
    changes: Mapped[dict] = mapped_column(JSON)


class Call(Base):
    __tablename__ = "calls"
    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), index=True)
    result: Mapped[str]
    comment: Mapped[str] = mapped_column(default="")
    actor: Mapped[str]
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    login: Mapped[str] = mapped_column(unique=True)
    password_hash: Mapped[str]
    active: Mapped[bool] = mapped_column(default=True)

# backend/models.py
# type: ignore[arg-type]
import enum
from datetime import datetime
from sqlalchemy import Index, text
from .extensions import db

class RoleEnum(enum.Enum):
    STUDENT = "student"
    MENTOR = "mentor"
    ADMIN = "admin"

class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    role = db.Column(db.Enum(RoleEnum), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(120), nullable=False)
    # Common optional fields
    phone = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Student‑specific fields
    student_id = db.Column(db.String(20), unique=True)
    department = db.Column(db.String(80))
    academic_year = db.Column(db.String(10))
    semester = db.Column(db.String(10))

    # Mentor‑specific fields
    employee_id = db.Column(db.String(20), unique=True)
    mentor_approved = db.Column(db.Boolean, nullable=False, default=False)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    # Relation tables for later features (subjects, availability, etc.) can be added here.

    # type: ignore[arg-type]


class MentorAssignment(db.Model):
    __tablename__ = "mentor_assignments"
    id = db.Column(db.Integer, primary_key=True)
    mentor_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    active = db.Column(db.Boolean, nullable=False, default=True)
    assigned_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    ended_at = db.Column(db.DateTime)

    __table_args__ = (
        Index(
            "uq_mentor_assignments_active_student",
            "student_id",
            unique=True,
            postgresql_where=text("active = true"),
            sqlite_where=text("active = 1"),
        ),
        Index("ix_mentor_assignments_mentor_active", "mentor_id", "active"),
    )


class PermanentMentorAssignment(db.Model):
    __tablename__ = "permanent_mentor_assignments"
    student_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="RESTRICT"),
        primary_key=True,
    )
    mentor_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    assignment_id = db.Column(
        db.Integer,
        db.ForeignKey("mentor_assignments.id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
    )
    assigned_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)


class Backlog(db.Model):
    __tablename__ = "backlogs"
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_name = db.Column(db.String(160), nullable=False)
    subject_code = db.Column(db.String(40), nullable=False, default="")
    semester = db.Column(db.String(20), nullable=False)
    exam_date = db.Column(db.Date)
    priority = db.Column(db.String(20), nullable=False, default="Medium")
    notes = db.Column(db.Text, nullable=False, default="")
    progress = db.Column(db.Integer, nullable=False, default=0)
    status = db.Column(db.String(20), nullable=False, default="Not Started")
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_backlogs_student_status", "student_id", "status"),
        Index("ix_backlogs_student_exam_created", "student_id", "exam_date", "created_at"),
    )


class Message(db.Model):
    __tablename__ = "messages"
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    receiver_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content = db.Column(db.Text, nullable=False)
    sent_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    read_at = db.Column(db.DateTime)

    __table_args__ = (
        Index("ix_messages_sender_receiver_sent", "sender_id", "receiver_id", "sent_at"),
        Index("ix_messages_receiver_sender_sent", "receiver_id", "sender_id", "sent_at"),
    )


class Notification(db.Model):
    __tablename__ = "notifications"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = db.Column(db.String(160), nullable=False)
    body = db.Column(db.String(500), nullable=False)
    kind = db.Column(db.String(40), nullable=False, default="system")
    event_key = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    read_at = db.Column(db.DateTime)

    __table_args__ = (
        Index("uq_notifications_user_event", "user_id", "event_key", unique=True),
        Index("ix_notifications_user_created", "user_id", "created_at"),
    )


class MentorFeedback(db.Model):
    __tablename__ = "mentor_feedback"
    id = db.Column(db.Integer, primary_key=True)
    mentor_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_mentor_feedback_pair_created", "mentor_id", "student_id", "created_at"),
    )


class FollowUpRecord(db.Model):
    __tablename__ = "follow_up_records"
    id = db.Column(db.Integer, primary_key=True)
    mentor_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    scheduled_for = db.Column(db.Date, nullable=False)
    notes = db.Column(db.String(500), nullable=False, default="")
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_followups_pair_scheduled", "mentor_id", "student_id", "scheduled_for"),
    )


class StudentProgress(db.Model):
    __tablename__ = "student_progress"
    student_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    data = db.Column(db.JSON, nullable=False, default=dict)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

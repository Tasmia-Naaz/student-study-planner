"""Add assignments, backlogs, messaging, notifications and progress snapshots."""

from alembic import op
from backend.extensions import db
from backend.models import (
    Backlog,
    FollowUpRecord,
    MentorAssignment,
    MentorFeedback,
    Message,
    Notification,
    StudentProgress,
)

revision = "20261107_03"
down_revision = "20261107_02"
branch_labels = None
depends_on = None

TABLES = [
    MentorAssignment.__table__,
    Backlog.__table__,
    Message.__table__,
    Notification.__table__,
    MentorFeedback.__table__,
    FollowUpRecord.__table__,
    StudentProgress.__table__,
]


def upgrade():
    db.metadata.create_all(bind=op.get_bind(), tables=TABLES, checkfirst=True)


def downgrade():
    db.metadata.drop_all(bind=op.get_bind(), tables=list(reversed(TABLES)), checkfirst=True)

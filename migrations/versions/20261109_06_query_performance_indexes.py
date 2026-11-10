"""Add indexes for dashboard, conversation, and user-scoped list queries."""

from alembic import op
import sqlalchemy as sa

revision = "20261109_06"
down_revision = "20261109_05"
branch_labels = None
depends_on = None

INDEXES = (
    ("mentor_assignments", "ix_mentor_assignments_mentor_active", ["mentor_id", "active"]),
    ("backlogs", "ix_backlogs_student_status", ["student_id", "status"]),
    ("backlogs", "ix_backlogs_student_exam_created", ["student_id", "exam_date", "created_at"]),
    ("messages", "ix_messages_sender_receiver_sent", ["sender_id", "receiver_id", "sent_at"]),
    ("messages", "ix_messages_receiver_sender_sent", ["receiver_id", "sender_id", "sent_at"]),
    ("notifications", "ix_notifications_user_created", ["user_id", "created_at"]),
    ("mentor_feedback", "ix_mentor_feedback_pair_created", ["mentor_id", "student_id", "created_at"]),
    ("follow_up_records", "ix_followups_pair_scheduled", ["mentor_id", "student_id", "scheduled_for"]),
)


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for table_name, index_name, columns in INDEXES:
        if not inspector.has_table(table_name):
            continue
        existing = {index["name"] for index in inspector.get_indexes(table_name)}
        if index_name not in existing:
            op.create_index(index_name, table_name, columns)
            inspector = sa.inspect(bind)


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for table_name, index_name, _ in reversed(INDEXES):
        if not inspector.has_table(table_name):
            continue
        existing = {index["name"] for index in inspector.get_indexes(table_name)}
        if index_name in existing:
            op.drop_index(index_name, table_name=table_name)
            inspector = sa.inspect(bind)

"""Enforce one active mentor assignment per student."""

from alembic import op
import sqlalchemy as sa

revision = "20261109_05"
down_revision = "20261107_04"
branch_labels = None
depends_on = None

INDEX_NAME = "uq_mentor_assignments_active_student"


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("mentor_assignments"):
        return

    bind.execute(sa.text("""
        UPDATE mentor_assignments
        SET active = false, ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP)
        WHERE id IN (
            SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (
                    PARTITION BY student_id
                    ORDER BY assigned_at DESC, id DESC
                ) AS assignment_rank
                FROM mentor_assignments
                WHERE active = true
            ) ranked
            WHERE assignment_rank > 1
        )
    """))

    indexes = {index["name"] for index in inspector.get_indexes("mentor_assignments")}
    if INDEX_NAME not in indexes:
        op.create_index(
            INDEX_NAME,
            "mentor_assignments",
            ["student_id"],
            unique=True,
            postgresql_where=sa.text("active = true"),
            sqlite_where=sa.text("active = 1"),
        )


def downgrade():
    bind = op.get_bind()
    if sa.inspect(bind).has_table("mentor_assignments"):
        indexes = {index["name"] for index in sa.inspect(bind).get_indexes("mentor_assignments")}
        if INDEX_NAME in indexes:
            op.drop_index(INDEX_NAME, table_name="mentor_assignments")

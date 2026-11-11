"""Record each student's first and permanent mentor assignment."""

from alembic import op
import sqlalchemy as sa

revision = "20261111_07"
down_revision = "20261109_06"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("users") or not inspector.has_table("mentor_assignments"):
        raise RuntimeError("Users and mentor_assignments tables are required for this migration.")

    if not inspector.has_table("permanent_mentor_assignments"):
        op.create_table(
            "permanent_mentor_assignments",
            sa.Column(
                "student_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="RESTRICT"),
                primary_key=True,
            ),
            sa.Column(
                "mentor_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="RESTRICT"),
                nullable=False,
            ),
            sa.Column(
                "assignment_id",
                sa.Integer(),
                sa.ForeignKey("mentor_assignments.id", ondelete="RESTRICT"),
                nullable=False,
                unique=True,
            ),
            sa.Column("assigned_at", sa.DateTime(), nullable=False),
        )

    bind.execute(sa.text("""
        INSERT INTO permanent_mentor_assignments
            (student_id, mentor_id, assignment_id, assigned_at)
        SELECT student_id, mentor_id, id, assigned_at
        FROM (
            SELECT
                student_id,
                mentor_id,
                id,
                assigned_at,
                ROW_NUMBER() OVER (
                    PARTITION BY student_id
                    ORDER BY assigned_at ASC, id ASC
                ) AS assignment_rank
            FROM mentor_assignments
        ) earliest
        WHERE assignment_rank = 1
          AND NOT EXISTS (
              SELECT 1
              FROM permanent_mentor_assignments claimed
              WHERE claimed.student_id = earliest.student_id
          )
    """))


def downgrade():
    if sa.inspect(op.get_bind()).has_table("permanent_mentor_assignments"):
        op.drop_table("permanent_mentor_assignments")

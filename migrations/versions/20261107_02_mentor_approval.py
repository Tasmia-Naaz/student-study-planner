"""Track whether a mentor account has been approved by an admin."""

from alembic import op
import sqlalchemy as sa

revision = "20261107_02"
down_revision = "20261107_01"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "mentor_approved" not in columns:
        with op.batch_alter_table("users") as batch_op:
            batch_op.add_column(
                sa.Column(
                    "mentor_approved",
                    sa.Boolean(),
                    nullable=False,
                    server_default=sa.false(),
                )
            )


def downgrade():
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "mentor_approved" in columns:
        with op.batch_alter_table("users") as batch_op:
            batch_op.drop_column("mentor_approved")

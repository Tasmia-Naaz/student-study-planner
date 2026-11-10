"""Track whether an account is active."""

from alembic import op
import sqlalchemy as sa

revision = "20261107_04"
down_revision = "20261107_03"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "is_active" not in columns:
        with op.batch_alter_table("users") as batch_op:
            batch_op.add_column(sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade():
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("users")}
    if "is_active" in columns:
        with op.batch_alter_table("users") as batch_op:
            batch_op.drop_column("is_active")

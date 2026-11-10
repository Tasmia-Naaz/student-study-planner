"""Create the users table when it does not already exist."""

from alembic import op
import sqlalchemy as sa

revision = "20261107_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("users"):
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "role",
                sa.Enum("STUDENT", "MENTOR", "ADMIN", name="roleenum"),
                nullable=False,
            ),
            sa.Column("email", sa.String(length=120), nullable=False, unique=True),
            sa.Column("password_hash", sa.String(length=255), nullable=False),
            sa.Column("full_name", sa.String(length=120), nullable=False),
            sa.Column("phone", sa.String(length=20)),
            sa.Column("created_at", sa.DateTime()),
            sa.Column("student_id", sa.String(length=20), unique=True),
            sa.Column("department", sa.String(length=80)),
            sa.Column("academic_year", sa.String(length=10)),
            sa.Column("semester", sa.String(length=10)),
            sa.Column("employee_id", sa.String(length=20), unique=True),
        )
    else:
        columns = {column["name"]: column for column in inspector.get_columns("users")}
        password_hash = columns.get("password_hash")
        password_length = getattr(password_hash["type"], "length", None) if password_hash else None
        if password_length is not None and password_length < 255:
            with op.batch_alter_table("users") as batch_op:
                batch_op.alter_column(
                    "password_hash",
                    existing_type=password_hash["type"],
                    type_=sa.String(length=255),
                    existing_nullable=False,
                )


def downgrade():
    # Keep user data and password hashes intact when rolling back application code.
    pass

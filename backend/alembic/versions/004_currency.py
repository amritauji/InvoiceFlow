"""Add currency column to invoices.

Revision ID: 004_currency
Revises: 003_notifications
Create Date: 2026-08-04
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "004_currency"
down_revision: Union[str, None] = "003_notifications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "invoices",
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
    )
    op.create_check_constraint(
        "valid_currency",
        "invoices",
        "currency IN ('INR','USD')",
    )


def downgrade() -> None:
    op.drop_constraint("valid_currency", "invoices", type_="check")
    op.drop_column("invoices", "currency")

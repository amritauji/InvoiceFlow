"""Add statement_transaction_id FK to invoices.

Revision ID: 008_invoice_statement_link
Revises: 007_statements
Create Date: 2026-08-17
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "008_invoice_statement_link"
down_revision: Union[str, None] = "007_statements"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "invoices",
        sa.Column("statement_transaction_id", UUID(as_uuid=True), sa.ForeignKey("statement_transactions.id", ondelete="SET NULL"), nullable=True, index=True),
    )


def downgrade() -> None:
    op.drop_index("ix_invoices_statement_transaction_id", table_name="invoices")
    op.drop_column("invoices", "statement_transaction_id")

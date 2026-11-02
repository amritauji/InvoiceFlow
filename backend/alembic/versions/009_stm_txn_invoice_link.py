"""Add has_invoice and invoice_id to statement_transactions.

Revision ID: 009_stm_txn_invoice_link
Revises: 008_invoice_statement_link
Create Date: 2026-08-17
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "009_stm_txn_invoice_link"
down_revision: Union[str, None] = "008_invoice_statement_link"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "statement_transactions",
        sa.Column("has_invoice", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "statement_transactions",
        sa.Column("invoice_id", UUID(as_uuid=True), sa.ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_stm_txn_invoice_id", "statement_transactions", ["invoice_id"])


def downgrade() -> None:
    op.drop_index("ix_stm_txn_invoice_id", table_name="statement_transactions")
    op.drop_column("statement_transactions", "invoice_id")
    op.drop_column("statement_transactions", "has_invoice")

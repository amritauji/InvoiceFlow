"""Drop has_invoice/invoice_id from statement_transactions.

Invoice linkage is now derived from invoices.statement_transaction_id, which
allows any number of invoices per transaction. The single-value columns on
statement_transactions are dead weight and misleading.

Revision ID: 011_multi_invoice_per_txn
Revises: 010_statement_name
Create Date: 2026-09-28
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "011_multi_invoice_per_txn"
down_revision: Union[str, None] = "010_statement_name"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("statement_transactions", "invoice_id")
    op.drop_column("statement_transactions", "has_invoice")


def downgrade() -> None:
    op.add_column(
        "statement_transactions",
        sa.Column("has_invoice", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "statement_transactions",
        sa.Column("invoice_id", sa.Uuid(), nullable=True),
    )

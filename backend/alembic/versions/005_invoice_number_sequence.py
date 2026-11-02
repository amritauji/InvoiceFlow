"""Add sequence for concurrency-safe invoice number generation.

Revision ID: 005_invoice_number_sequence
Revises: 004_currency
Create Date: 2026-08-11
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "005_invoice_number_sequence"
down_revision: Union[str, None] = "004_currency"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Atomic counter shared by all requests — eliminates the read-then-increment
    # race that caused duplicate invoice numbers under concurrent creation.
    op.execute("CREATE SEQUENCE IF NOT EXISTS invoice_number_seq")
    # Seed the sequence so new numbers continue after existing data.
    op.execute(
        """
        SELECT setval(
            'invoice_number_seq',
            GREATEST(
                COALESCE(
                    (SELECT MAX(CAST(split_part(invoice_number, '-', 3) AS INTEGER))
                     FROM invoices WHERE invoice_number ~ '^INV-[0-9]{4}-[0-9]+$'),
                    0
                ),
                1
            )
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP SEQUENCE IF EXISTS invoice_number_seq")

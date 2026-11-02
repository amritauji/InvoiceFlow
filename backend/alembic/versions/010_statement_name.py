"""Add statement_name to statements table.

Revision ID: 010_statement_name
Revises: 009_stm_txn_invoice_link
Create Date: 2026-08-18
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "010_statement_name"
down_revision: Union[str, None] = "009_stm_txn_invoice_link"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("statements", sa.Column("statement_name", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("statements", "statement_name")

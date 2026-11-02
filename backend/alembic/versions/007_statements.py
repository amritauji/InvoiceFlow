"""Add statements tables for bank statement uploads.

Revision ID: 007_statements
Revises: 006_unique_approval_index
Create Date: 2026-08-12
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "007_statements"
down_revision: Union[str, None] = "006_unique_approval_index"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- statement_number sequence ---
    op.execute("CREATE SEQUENCE IF NOT EXISTS statement_number_seq START 1")

    # --- statements ---
    op.execute(
        """
        CREATE TABLE statements (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            statement_number VARCHAR(30) NOT NULL UNIQUE,
            card_last_four VARCHAR(4),
            card_holder_name VARCHAR(200),
            billing_period VARCHAR(100),
            total_amount_due NUMERIC(12, 2),
            total_transactions INTEGER NOT NULL DEFAULT 0,
            status VARCHAR(30) NOT NULL DEFAULT 'submitted',
            remarks TEXT,
            submitted_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
            submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT valid_statement_status CHECK (status IN ('submitted','under_review','verified','rejected'))
        )
        """
    )
    op.create_index("ix_statements_statement_number", "statements", ["statement_number"], unique=True)
    op.create_index("ix_statements_status", "statements", ["status"])

    # --- statement_transactions ---
    op.execute(
        """
        CREATE TABLE statement_transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            statement_id UUID NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
            transaction_date VARCHAR(20) NOT NULL,
            description TEXT NOT NULL,
            amount NUMERIC(12, 2) NOT NULL,
            is_verified BOOLEAN NOT NULL DEFAULT false,
            verified_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
            verified_at TIMESTAMPTZ,
            row_index INTEGER NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.create_index("ix_statement_transactions_statement_id", "statement_transactions", ["statement_id"])

    # --- statement_files ---
    op.execute(
        """
        CREATE TABLE statement_files (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            statement_id UUID NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
            storage_path TEXT NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            file_size INTEGER,
            mime_type VARCHAR(50),
            uploaded_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.create_index("ix_statement_files_statement_id", "statement_files", ["statement_id"])


def downgrade() -> None:
    op.drop_table("statement_files")
    op.drop_table("statement_transactions")
    op.drop_table("statements")
    op.execute("DROP SEQUENCE IF EXISTS statement_number_seq")

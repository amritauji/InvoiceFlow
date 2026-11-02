"""Add partial unique index to prevent duplicate approvals per actor.

Revision ID: 006_unique_approval_index
Revises: 005_invoice_number_sequence
Create Date: 2026-08-11
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "006_unique_approval_index"
down_revision: Union[str, None] = "005_invoice_number_sequence"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Clean up duplicates produced by the pre-fix approval race: keep the
    # earliest 'approve' action per (invoice, actor), drop the rest.
    op.execute(
        """
        DELETE FROM approval_actions a
        USING approval_actions b
        WHERE a.action = 'approve'
          AND b.action = 'approve'
          AND a.invoice_id = b.invoice_id
          AND a.actor_id = b.actor_id
          AND a.id > b.id
        """
    )
    # DB-level guard: an actor can approve a given invoice at most once per
    # submission cycle. The service deletes approval actions on resubmit, so a
    # fresh cycle gets a fresh allowance.
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_approval_actions_actor_approve
        ON approval_actions (invoice_id, actor_id)
        WHERE action = 'approve'
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_approval_actions_actor_approve")

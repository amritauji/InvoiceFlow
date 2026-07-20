"""
Approval action service.
Handles approve, reject, return, and comment actions on invoices.
Integrates with workflow_engine for state transitions and audit_service for logging.
"""

import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.invoice import Invoice
from app.models.approval import ApprovalAction
from app.models.user import UserProfile
from app.core.dependencies import UserContext, UserRole
from app.core.exceptions import NotFoundException, BadRequestException
from app.services.workflow_engine import (
    validate_approval, validate_rejection, validate_return,
    get_first_stage, WORKFLOW_STAGES, ROLE_TO_STAGE_ORDER,
)
from app.services.audit_service import AuditService
from app.services.invoice_service import resolve_invoice_id


class ApprovalService:
    """Business logic for approval actions on invoices."""

    @staticmethod
    def _get_stage_order_for_invoice(invoice: Invoice) -> int | None:
        """Determine the current stage order for an invoice based on workflow stage IDs."""
        if invoice.current_stage_id is None:
            return None
        # MVP: stage_id is a UUID we assign sequentially
        # Map stage_id to order by comparing with what we'd have set
        # Since we store stage as a UUID, we need to figure out the order
        # For MVP, we store the stage order as a fixed UUID pattern
        # Actually, let's use a simpler approach: store stage_order in a comment or derive from status
        # For now, we'll check the approval_actions to determine which stage we're at
        return None  # Will be resolved by caller using _determine_stage_order

    @staticmethod
    async def _determine_stage_order(db: AsyncSession, invoice: Invoice) -> int | None:
        """Determine which stage the invoice is at by looking at approval history."""
        if invoice.status in ("draft", "submitted"):
            return None
        if invoice.status == "returned":
            return None

        # Count how many approvals have been recorded
        result = await db.execute(
            select(func.count(ApprovalAction.id))
            .where(
                ApprovalAction.invoice_id == invoice.id,
                ApprovalAction.action == "approve",
            )
        )
        approval_count = result.scalar() or 0

        # Each approval moves to next stage. First approval = stage 1 done → now at stage 2
        # If status is "under_review" and we have N approvals, we're at stage N+1
        if invoice.status == "under_review":
            stage_order = approval_count + 1
            if stage_order > len(WORKFLOW_STAGES):
                return None
            return stage_order

        return None

    @staticmethod
    async def _get_actor_stage_order(actor: UserContext) -> int | None:
        """Get the stage order that the actor's role corresponds to."""
        return ROLE_TO_STAGE_ORDER.get(actor.role)

    @staticmethod
    async def approve(
        db: AsyncSession,
        invoice_id: str,
        *,
        actor: UserContext,
        comment: Optional[str] = None,
    ) -> dict:
        """Approve an invoice and advance the workflow."""
        # Fetch invoice (supports UUID or invoice_number)
        inv_uuid = await resolve_invoice_id(db, invoice_id)
        result = await db.execute(
            select(Invoice).where(Invoice.id == inv_uuid)
        )
        invoice = result.scalar_one_or_none()
        if not invoice:
            raise NotFoundException("Invoice", invoice_id)

        # Prevent duplicate approval by same actor
        existing = await db.execute(
            select(ApprovalAction).where(
                ApprovalAction.invoice_id == invoice.id,
                ApprovalAction.actor_id == uuid.UUID(actor.id),
                ApprovalAction.action == "approve",
            )
        )
        if existing.scalar_one_or_none():
            raise BadRequestException("You have already approved this invoice")

        old_status = invoice.status
        old_stage_id = invoice.current_stage_id

        # Determine current stage order
        stage_order = await ApprovalService._determine_stage_order(db, invoice)

        # Validate and get transition
        transition = validate_approval(actor.role, invoice.status, stage_order)

        # Apply transition
        invoice.status = transition["new_status"]
        if transition["new_stage_order"] is not None:
            # Assign a deterministic stage UUID for MVP
            invoice.current_stage_id = uuid.uuid5(
                uuid.UUID("00000000-0000-0000-0000-000000000001"),
                f"stage-{transition['new_stage_order']}"
            )
        else:
            invoice.current_stage_id = None  # Final approval — no more stages
        invoice.version += 1

        # Record approval action
        action = ApprovalAction(
            invoice_id=invoice.id,
            stage_id=old_stage_id,
            actor_id=uuid.UUID(actor.id),
            action="approve",
            comment=comment,
            from_status=old_status,
            to_status=invoice.status,
            from_stage_id=old_stage_id,
            to_stage_id=invoice.current_stage_id,
        )
        db.add(action)

        # Audit log
        await AuditService.log(
            db,
            invoice_id=invoice.id,
            actor=actor,
            action="invoice.approved" if transition["is_final"] else "invoice.stage_advanced",
            resource_type="invoice",
            resource_id=str(invoice.id),
            details={
                "from_status": old_status,
                "to_status": invoice.status,
                "stage_order": transition["new_stage_order"],
                "is_final": transition["is_final"],
                "comment": comment,
            },
        )

        stage_name = transition.get("new_stage_name")
        next_approver = transition.get("next_approver")
        return {
            "invoice_id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "action": "approve",
            "from_status": old_status,
            "to_status": invoice.status,
            "current_stage": stage_name,
            "is_final_approval": transition["is_final"],
            "next_approver": next_approver,
            "version": invoice.version,
        }

    @staticmethod
    async def reject(
        db: AsyncSession,
        invoice_id: str,
        *,
        actor: UserContext,
        comment: Optional[str] = None,
    ) -> dict:
        """Reject an invoice (terminal state)."""
        inv_uuid = await resolve_invoice_id(db, invoice_id)
        result = await db.execute(
            select(Invoice).where(Invoice.id == inv_uuid)
        )
        invoice = result.scalar_one_or_none()
        if not invoice:
            raise NotFoundException("Invoice", invoice_id)

        old_status = invoice.status
        old_stage_id = invoice.current_stage_id
        stage_order = await ApprovalService._determine_stage_order(db, invoice)

        validate_rejection(actor.role, invoice.status, stage_order)

        invoice.status = "rejected"
        invoice.current_stage_id = None
        invoice.version += 1

        action = ApprovalAction(
            invoice_id=invoice.id,
            stage_id=old_stage_id,
            actor_id=uuid.UUID(actor.id),
            action="reject",
            comment=comment,
            from_status=old_status,
            to_status="rejected",
            from_stage_id=old_stage_id,
            to_stage_id=None,
        )
        db.add(action)

        await AuditService.log(
            db,
            invoice_id=invoice.id,
            actor=actor,
            action="invoice.rejected",
            resource_type="invoice",
            resource_id=str(invoice.id),
            details={
                "from_status": old_status,
                "to_status": "rejected",
                "comment": comment,
            },
        )

        return {
            "invoice_id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "action": "reject",
            "from_status": old_status,
            "to_status": "rejected",
            "version": invoice.version,
        }

    @staticmethod
    async def return_invoice(
        db: AsyncSession,
        invoice_id: str,
        *,
        actor: UserContext,
        comment: Optional[str] = None,
    ) -> dict:
        """Return an invoice to the submitter for corrections."""
        inv_uuid = await resolve_invoice_id(db, invoice_id)
        result = await db.execute(
            select(Invoice).where(Invoice.id == inv_uuid)
        )
        invoice = result.scalar_one_or_none()
        if not invoice:
            raise NotFoundException("Invoice", invoice_id)

        old_status = invoice.status
        old_stage_id = invoice.current_stage_id
        stage_order = await ApprovalService._determine_stage_order(db, invoice)

        validate_return(actor.role, invoice.status, stage_order)

        invoice.status = "returned"
        invoice.current_stage_id = None
        invoice.version += 1

        action = ApprovalAction(
            invoice_id=invoice.id,
            stage_id=old_stage_id,
            actor_id=uuid.UUID(actor.id),
            action="return",
            comment=comment,
            from_status=old_status,
            to_status="returned",
            from_stage_id=old_stage_id,
            to_stage_id=None,
        )
        db.add(action)

        await AuditService.log(
            db,
            invoice_id=invoice.id,
            actor=actor,
            action="invoice.returned",
            resource_type="invoice",
            resource_id=str(invoice.id),
            details={
                "from_status": old_status,
                "to_status": "returned",
                "comment": comment,
            },
        )

        return {
            "invoice_id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "action": "return",
            "from_status": old_status,
            "to_status": "returned",
            "version": invoice.version,
        }

    @staticmethod
    async def add_comment(
        db: AsyncSession,
        invoice_id: str,
        *,
        actor: UserContext,
        comment: str,
    ) -> dict:
        """Add a comment to an invoice without changing status."""
        inv_uuid = await resolve_invoice_id(db, invoice_id)
        result = await db.execute(
            select(Invoice).where(Invoice.id == inv_uuid)
        )
        invoice = result.scalar_one_or_none()
        if not invoice:
            raise NotFoundException("Invoice", invoice_id)

        action = ApprovalAction(
            invoice_id=invoice.id,
            stage_id=invoice.current_stage_id,
            actor_id=uuid.UUID(actor.id),
            action="comment",
            comment=comment,
            from_status=invoice.status,
            to_status=invoice.status,
            from_stage_id=invoice.current_stage_id,
            to_stage_id=invoice.current_stage_id,
        )
        db.add(action)

        return {
            "invoice_id": str(invoice.id),
            "action": "comment",
            "comment": comment,
        }

    @staticmethod
    async def get_comments(
        db: AsyncSession,
        invoice_id: str,
    ) -> list[dict]:
        """Get all comments for an invoice."""
        inv_uuid = await resolve_invoice_id(db, invoice_id)
        result = await db.execute(
            select(ApprovalAction, UserProfile.full_name)
            .join(UserProfile, ApprovalAction.actor_id == UserProfile.id)
            .where(
                ApprovalAction.invoice_id == inv_uuid,
                ApprovalAction.action == "comment",
            )
            .order_by(ApprovalAction.created_at.asc())
        )
        rows = result.all()

        return [
            {
                "id": str(action.id),
                "actor_id": str(action.actor_id),
                "actor_name": actor_name,
                "comment": action.comment,
                "created_at": action.created_at.isoformat() if action.created_at else None,
            }
            for action, actor_name in rows
        ]

    @staticmethod
    async def get_action_history(
        db: AsyncSession,
        invoice_id: str,
    ) -> list[dict]:
        """Get full action history for an invoice (all actions, not just comments)."""
        from app.services.invoice_service import InvoiceService
        invoice = await InvoiceService.get_invoice(db, invoice_id)
        result = await db.execute(
            select(ApprovalAction, UserProfile.full_name)
            .join(UserProfile, ApprovalAction.actor_id == UserProfile.id)
            .where(ApprovalAction.invoice_id == invoice.id)
            .order_by(ApprovalAction.created_at.asc())
        )
        rows = result.all()

        return [
            {
                "id": str(action.id),
                "actor_id": str(action.actor_id),
                "actor_name": actor_name,
                "action": action.action,
                "comment": action.comment,
                "from_status": action.from_status,
                "to_status": action.to_status,
                "created_at": action.created_at.isoformat() if action.created_at else None,
            }
            for action, actor_name in rows
        ]

    @staticmethod
    async def get_pending_queue(
        db: AsyncSession,
        *,
        actor: UserContext,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """
        Get invoices pending the actor's approval.
        For accountant_1: invoices with status 'submitted' or 'returned'
        For accountant_2: invoices at stage 1 (under_review, after 1 approval)
        For manager: invoices at stage 2
        For ceo: invoices at stage 3
        For admin: all non-terminal invoices
        """
        # Determine which statuses/stages to filter by
        if actor.role == UserRole.ADMIN:
            # Admin sees everything non-terminal
            query = (
                select(Invoice, UserProfile.full_name)
                .join(UserProfile, Invoice.submitted_by == UserProfile.id)
                .where(Invoice.status.in_(["submitted", "under_review"]))
            )
        elif actor.role == UserRole.ACCOUNTANT_1:
            # Accountant 1 sees submitted invoices
            query = (
                select(Invoice, UserProfile.full_name)
                .join(UserProfile, Invoice.submitted_by == UserProfile.id)
                .where(Invoice.status == "submitted")
            )
        else:
            # Approver roles (accountant_2, manager, ceo): see under_review invoices at their stage
            stage_order = ROLE_TO_STAGE_ORDER.get(actor.role)
            if stage_order is None:
                return [], 0

            # We need to find invoices where the number of approvals = stage_order - 1
            # and status is "under_review"
            approvals_subquery = (
                select(
                    ApprovalAction.invoice_id,
                    func.count(ApprovalAction.id).label("approval_count"),
                )
                .where(ApprovalAction.action == "approve")
                .group_by(ApprovalAction.invoice_id)
            ).subquery()

            query = (
                select(Invoice, UserProfile.full_name)
                .join(UserProfile, Invoice.submitted_by == UserProfile.id)
                .outerjoin(approvals_subquery, Invoice.id == approvals_subquery.c.invoice_id)
                .where(
                    Invoice.status == "under_review",
                    func.coalesce(approvals_subquery.c.approval_count, 0) == stage_order - 1,
                )
            )

        # Count
        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()

        # Fetch page
        result = await db.execute(
            query.order_by(Invoice.submitted_at.desc()).limit(limit).offset(offset)
        )
        rows = result.all()

        invoices = []
        for inv, submitter_name in rows:
            invoices.append({
                "id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "vendor_name": inv.vendor_name,
                "amount": float(inv.amount),
                "status": inv.status,
                "submitted_by": str(inv.submitted_by),
                "submitter_name": submitter_name,
                "submitted_at": inv.submitted_at.isoformat() if inv.submitted_at else None,
                "version": inv.version,
            })

        return invoices, total

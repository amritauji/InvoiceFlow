"""
Approval action service.
Handles approve, reject, return, and comment actions on invoices.
Integrates with workflow_engine for state transitions and audit_service for logging.
"""

import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.invoice import Invoice
from app.models.approval import ApprovalAction
from app.models.user import UserProfile
from app.models.department import Department
from app.core.dependencies import UserContext, UserRole
from app.core.exceptions import NotFoundException, BadRequestException, ForbiddenException
from app.services.workflow_engine import (
    validate_approval, validate_rejection, validate_return,
    get_first_stage, WORKFLOW_STAGES, ROLE_TO_STAGE_ORDER,
)
from app.services.audit_service import AuditService
from app.services.invoice_service import resolve_invoice_id
from app.services.notification_service import NotificationService


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
    async def _notify_review_started(
        db: AsyncSession,
        invoice: Invoice,
        old_status: str,
        actor: UserContext,
    ) -> None:
        """Notify the submitter when Accountant 1 (or Admin) begins reviewing.

        Fires once per submission cycle: only when the invoice was still in
        'submitted' status (i.e. no approver has acted on it yet).
        """
        if old_status != "submitted":
            return
        if actor.role not in (UserRole.ACCOUNTANT_1, UserRole.ADMIN):
            return

        await NotificationService.create(
            db,
            user_id=str(invoice.submitted_by),
            invoice_id=str(invoice.id),
            type="review_started",
            title=f"Review started on {invoice.invoice_number}",
            message=(
                f"Your invoice {invoice.invoice_number} ({invoice.vendor_name}) "
                f"is now being reviewed by {actor.full_name}."
            ),
        )

    @staticmethod
    def _can_self_approve(actor: UserContext) -> bool:
        """Accountants and admins may approve/reject/return invoices they submitted."""
        return actor.role in (
            UserRole.ACCOUNTANT_1,
            UserRole.ACCOUNTANT_2,
            UserRole.ADMIN,
        )

    @staticmethod
    async def approve(
        db: AsyncSession,
        invoice_id: str,
        *,
        actor: UserContext,
        comment: Optional[str] = None,
    ) -> dict:
        """Approve an invoice and advance the workflow."""
        # Fetch invoice with a row lock so concurrent approvals/rejects/returns
        # are serialized — the first writer wins and later requests see the new
        # status and are rejected by workflow validation (prevents double-advance).
        inv_uuid = await resolve_invoice_id(db, invoice_id)
        result = await db.execute(
            select(Invoice).where(Invoice.id == inv_uuid).with_for_update()
        )
        invoice = result.scalar_one_or_none()
        if not invoice:
            raise NotFoundException("Invoice", invoice_id)

        # Prevent conflict of interest: a submitter cannot act on their own invoice
        if str(invoice.submitted_by) == actor.id and not ApprovalService._can_self_approve(actor):
            raise ForbiddenException("You cannot approve your own submitted invoice")

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

        # Check if this is a statement-linked invoice (single-step approval)
        is_statement_invoice = invoice.statement_transaction_id is not None

        # Validate and get transition
        transition = validate_approval(actor.role, invoice.status, stage_order, is_statement_invoice=is_statement_invoice)

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

        await ApprovalService._notify_review_started(db, invoice, old_status, actor)

        # Auto-tick the statement transaction checkbox when approved
        if is_statement_invoice and invoice.status == "approved":
            from app.models.statement import StatementTransaction
            txn = await db.get(StatementTransaction, invoice.statement_transaction_id)
            if txn and not txn.is_verified:
                txn.is_verified = True
                txn.verified_by = uuid.UUID(actor.id)
                txn.verified_at = datetime.utcnow()

            # Embed narration as a page appended to the PDF
            if invoice.remarks:
                from app.services.file_service import FileService
                from app.services.pdf_service import PDFService
                try:
                    original_data = await FileService.get_original_file_for_invoice(db, str(invoice.id))
                    if original_data:
                        original_bytes, _ = original_data
                        merged_bytes = PDFService.append_narration_to_pdf(original_bytes, invoice.remarks)
                        await FileService.upload_approved_pdf(
                            db,
                            invoice_id=str(invoice.id),
                            file_bytes=merged_bytes,
                            filename=f"approved_{invoice.invoice_number}.pdf",
                        )
                except Exception:
                    pass  # Non-critical: narration embedding failure should not block approval

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
            select(Invoice).where(Invoice.id == inv_uuid).with_for_update()
        )
        invoice = result.scalar_one_or_none()
        if not invoice:
            raise NotFoundException("Invoice", invoice_id)

        # Prevent conflict of interest: a submitter cannot act on their own invoice
        if str(invoice.submitted_by) == actor.id and not ApprovalService._can_self_approve(actor):
            raise ForbiddenException("You cannot reject your own submitted invoice")

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

        await ApprovalService._notify_review_started(db, invoice, old_status, actor)

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
            select(Invoice).where(Invoice.id == inv_uuid).with_for_update()
        )
        invoice = result.scalar_one_or_none()
        if not invoice:
            raise NotFoundException("Invoice", invoice_id)

        # Prevent conflict of interest: a submitter cannot act on their own invoice
        if str(invoice.submitted_by) == actor.id and not ApprovalService._can_self_approve(actor):
            raise ForbiddenException("You cannot return your own submitted invoice")

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

        await ApprovalService._notify_review_started(db, invoice, old_status, actor)

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
            query = (
                select(Invoice, UserProfile.full_name, Department.name.label("department_name"))
                .join(UserProfile, Invoice.submitted_by == UserProfile.id)
                .outerjoin(Department, Invoice.department_id == Department.id)
                .where(Invoice.status.in_(["submitted", "under_review"]))
            )
        elif actor.role == UserRole.ACCOUNTANT_1:
            query = (
                select(Invoice, UserProfile.full_name, Department.name.label("department_name"))
                .join(UserProfile, Invoice.submitted_by == UserProfile.id)
                .outerjoin(Department, Invoice.department_id == Department.id)
                .where(Invoice.status == "submitted")
            )
        else:
            stage_order = ROLE_TO_STAGE_ORDER.get(actor.role)
            if stage_order is None:
                return [], 0

            approvals_subquery = (
                select(
                    ApprovalAction.invoice_id,
                    func.count(ApprovalAction.id).label("approval_count"),
                )
                .where(ApprovalAction.action == "approve")
                .group_by(ApprovalAction.invoice_id)
            ).subquery()

            query = (
                select(Invoice, UserProfile.full_name, Department.name.label("department_name"))
                .join(UserProfile, Invoice.submitted_by == UserProfile.id)
                .outerjoin(Department, Invoice.department_id == Department.id)
                .outerjoin(approvals_subquery, Invoice.id == approvals_subquery.c.invoice_id)
                .where(
                    Invoice.status == "under_review",
                    func.coalesce(approvals_subquery.c.approval_count, 0) == stage_order - 1,
                )
            )

        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()

        result = await db.execute(
            query.order_by(Invoice.submitted_at.desc()).limit(limit).offset(offset)
        )
        rows = result.all()

        invoices = []
        for inv, submitter_name, department_name in rows:
            invoices.append({
                "id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "vendor_name": inv.vendor_name,
                "amount": float(inv.amount),
                "currency": inv.currency,
                "remarks": inv.remarks,
                "status": inv.status,
                "department_name": department_name,
                "submitted_by": str(inv.submitted_by),
                "submitter_name": submitter_name,
                "submitted_at": inv.submitted_at.isoformat() if inv.submitted_at else None,
                "version": inv.version,
            })

        return invoices, total

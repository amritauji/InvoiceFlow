import uuid
import re
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from sqlalchemy.orm import selectinload

from app.models.invoice import Invoice, InvoiceFile
from app.models.user import UserProfile
from app.core.dependencies import UserContext, UserRole
from app.core.exceptions import NotFoundException, BadRequestException, ForbiddenException

_UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)


async def resolve_invoice_id(db: AsyncSession, invoice_id: str) -> uuid.UUID:
    """Resolve an invoice identifier (UUID or invoice_number) to a UUID."""
    raw = str(invoice_id)
    if _UUID_RE.match(raw):
        return uuid.UUID(raw)
    result = await db.execute(
        select(Invoice.id).where(Invoice.invoice_number == raw)
    )
    inv_id = result.scalar_one_or_none()
    if not inv_id:
        raise NotFoundException("Invoice", raw)
    return inv_id


class InvoiceService:
    """Business logic for invoice CRUD and state management."""

    # MVP fixed workflow stage IDs (will be configurable later)
    # Stage 1: Accountant 1 Verification (accountant_1)
    # Stage 2: Accountant 2 Verification (accountant_2)
    # Stage 3: Manager Approval (manager)
    # Stage 4: CEO Final Approval (ceo)
    MVP_WORKFLOW_STAGES = [
        {"order": 1, "name": "Accountant 1 Verification", "role": "accountant_1"},
        {"order": 2, "name": "Accountant 2 Verification", "role": "accountant_2"},
        {"order": 3, "name": "Manager Approval", "role": "manager"},
        {"order": 4, "name": "CEO Final Approval", "role": "ceo"},
    ]

    @staticmethod
    async def generate_invoice_number(db: AsyncSession) -> str:
        """Generate next sequential invoice number: INV-2026-0001.

        Uses a PostgreSQL sequence (invoice_number_seq) so concurrent requests
        each receive a unique number atomically — no read-then-increment race.
        """
        year = datetime.utcnow().year
        result = await db.execute(text("SELECT nextval('invoice_number_seq')"))
        seq = result.scalar()

        return f"INV-{year}-{int(seq):04d}"

    @staticmethod
    async def create_invoice(
        db: AsyncSession,
        *,
        vendor_name: str,
        amount: float,
        currency: str = "INR",
        remarks: Optional[str],
        department_id: Optional[str] = None,
        actor: UserContext,
        statement_transaction_id: Optional[uuid.UUID] = None,
    ) -> Invoice:
        """Create and submit a new invoice."""
        invoice_number = await InvoiceService.generate_invoice_number(db)

        dept_uuid = None
        if department_id:
            try:
                dept_uuid = uuid.UUID(department_id)
            except ValueError:
                pass

        invoice = Invoice(
            invoice_number=invoice_number,
            vendor_name=vendor_name,
            amount=amount,
            currency=currency,
            remarks=remarks,
            department_id=dept_uuid,
            status="submitted",
            submitted_by=uuid.UUID(actor.id),
            submitted_at=datetime.utcnow(),
            version=1,
            statement_transaction_id=statement_transaction_id,
        )
        db.add(invoice)
        await db.flush()  # Get the invoice.id

        return invoice

    @staticmethod
    async def get_invoice(db: AsyncSession, invoice_id: str) -> Invoice:
        """Get invoice by ID (UUID) or invoice_number."""
        inv_uuid = await resolve_invoice_id(db, invoice_id)
        result = await db.execute(
            select(Invoice).where(Invoice.id == inv_uuid)
        )
        invoice = result.scalar_one_or_none()
        if not invoice:
            raise NotFoundException("Invoice", invoice_id)
        return invoice

    @staticmethod
    async def get_invoice_with_submitter(db: AsyncSession, invoice_id: str) -> tuple[Invoice, str]:
        """Get invoice with submitter name by ID or invoice_number."""
        invoice = await InvoiceService.get_invoice(db, invoice_id)
        result = await db.execute(
            select(UserProfile.full_name).where(UserProfile.id == invoice.submitted_by)
        )
        submitter_name = result.scalar_one_or_none() or "Unknown"
        return invoice, submitter_name

    @staticmethod
    def assert_can_view(actor: UserContext, invoice: Invoice) -> None:
        """Department users can only view their own invoices.
        Statement-linked invoices are restricted to accountant_1 and admin."""
        if actor.role == UserRole.DEPARTMENT_USER and str(invoice.submitted_by) != actor.id:
            raise ForbiddenException("You can only view your own invoices")
        if invoice.statement_transaction_id is not None and actor.role not in (UserRole.ACCOUNTANT_1, UserRole.ADMIN):
            raise ForbiddenException("You do not have permission to view this invoice")

    @staticmethod
    async def list_invoices(
        db: AsyncSession,
        *,
        actor: UserContext,
        status: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """List invoices based on user role."""
        query = (
            select(Invoice, UserProfile.full_name)
            .join(UserProfile, Invoice.submitted_by == UserProfile.id)
        )

        # Role-based filtering
        if actor.role == UserRole.DEPARTMENT_USER:
            query = query.where(Invoice.submitted_by == uuid.UUID(actor.id))

        # Statement-linked invoices are only visible to accountant_1 and admin
        if actor.role not in (UserRole.ACCOUNTANT_1, UserRole.ADMIN):
            query = query.where(Invoice.statement_transaction_id.is_(None))

        if status:
            query = query.where(Invoice.status == status)

        # Count total
        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()

        # Fetch page
        result = await db.execute(
            query.order_by(Invoice.created_at.desc()).limit(limit).offset(offset)
        )
        rows = result.all()

        invoices = []
        for inv, submitter_name in rows:
            invoices.append({
                "id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "vendor_name": inv.vendor_name,
                "amount": float(inv.amount),
                "currency": inv.currency,
                "remarks": inv.remarks,
                "status": inv.status,
                "submitted_by": str(inv.submitted_by),
                "submitter_name": submitter_name,
                "submitted_at": inv.submitted_at.isoformat() if inv.submitted_at else None,
                "current_stage_id": str(inv.current_stage_id) if inv.current_stage_id else None,
                "version": inv.version,
                "created_at": inv.created_at.isoformat() if inv.created_at else None,
                "updated_at": inv.updated_at.isoformat() if inv.updated_at else None,
            })

        return invoices, total

    @staticmethod
    async def update_invoice(
        db: AsyncSession,
        invoice_id: str,
        *,
        vendor_name: Optional[str] = None,
        amount: Optional[float] = None,
        currency: Optional[str] = None,
        remarks: Optional[str] = None,
        actor: UserContext,
    ) -> Invoice:
        """Update a draft or returned invoice."""
        invoice = await InvoiceService.get_invoice(db, invoice_id)

        # Only submitter can update, and only in draft/returned status
        if str(invoice.submitted_by) != actor.id and actor.role != UserRole.ADMIN:
            raise ForbiddenException("You can only update your own invoices")
        if invoice.status not in ("draft", "returned"):
            raise BadRequestException(f"Cannot update invoice in '{invoice.status}' status")

        if vendor_name is not None:
            invoice.vendor_name = vendor_name
        if amount is not None:
            invoice.amount = amount
        if currency is not None:
            invoice.currency = currency
        if remarks is not None:
            invoice.remarks = remarks

        invoice.version += 1
        return invoice

    @staticmethod
    async def delete_invoice(
        db: AsyncSession,
        invoice_id: str,
        *,
        actor: UserContext,
    ) -> None:
        """Delete an invoice. Only Accountant 1 can delete any invoice regardless of status."""
        invoice = await InvoiceService.get_invoice(db, invoice_id)

        if actor.role != UserRole.ACCOUNTANT_1:
            raise ForbiddenException("Only Accountant 1 can delete invoices")

        await db.delete(invoice)

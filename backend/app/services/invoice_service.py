import uuid
import re
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.models.invoice import Invoice, InvoiceFile
from app.models.user import UserProfile
from app.core.dependencies import UserContext, UserRole
from app.core.exceptions import NotFoundException, BadRequestException, ForbiddenException

_UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)


async def resolve_invoice_id(db: AsyncSession, invoice_id: str) -> uuid.UUID:
    """Resolve an invoice identifier (UUID or invoice_number) to a UUID."""
    if _UUID_RE.match(invoice_id):
        return uuid.UUID(invoice_id)
    result = await db.execute(
        select(Invoice.id).where(Invoice.invoice_number == invoice_id)
    )
    inv_id = result.scalar_one_or_none()
    if not inv_id:
        raise NotFoundException("Invoice", invoice_id)
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
        """Generate next sequential invoice number: INV-2024-0001."""
        year = datetime.utcnow().year
        prefix = f"INV-{year}-"

        result = await db.execute(
            select(Invoice.invoice_number)
            .where(Invoice.invoice_number.like(f"{prefix}%"))
            .order_by(Invoice.invoice_number.desc())
            .limit(1)
        )
        last_number = result.scalar_one_or_none()

        if last_number:
            seq = int(last_number.split("-")[-1]) + 1
        else:
            seq = 1

        return f"{prefix}{seq:04d}"

    @staticmethod
    async def create_invoice(
        db: AsyncSession,
        *,
        vendor_name: str,
        amount: float,
        remarks: Optional[str],
        department_id: Optional[str] = None,
        actor: UserContext,
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
            remarks=remarks,
            department_id=dept_uuid,
            status="submitted",
            submitted_by=uuid.UUID(actor.id),
            submitted_at=datetime.utcnow(),
            version=1,
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
        """Delete an invoice. Accountant 1 and Admin can delete any invoice."""
        invoice = await InvoiceService.get_invoice(db, invoice_id)

        if actor.role not in (UserRole.ADMIN, UserRole.ACCOUNTANT_1):
            raise ForbiddenException("Only Admin or Accountant 1 can delete invoices")
        if invoice.status not in ("submitted", "returned", "rejected"):
            raise BadRequestException(f"Cannot delete invoice in '{invoice.status}' status")

        await db.delete(invoice)

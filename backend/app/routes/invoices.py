from typing import Optional
from io import BytesIO
from fastapi import APIRouter, Depends, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, delete

from app.database import get_db
from app.schemas import InvoiceCreate
from app.services.invoice_service import InvoiceService, resolve_invoice_id
from app.services.file_service import FileService
from app.services.audit_service import AuditService
from app.core.dependencies import get_current_user, require_role, require_permission, UserContext, UserRole
from app.core.exceptions import BadRequestException, NotFoundException

router = APIRouter(prefix="/invoices", tags=["Invoices"])


@router.post("")
async def create_invoice(
    vendor_name: str = Form(...),
    amount: float = Form(...),
    currency: str = Form("INR"),
    remarks: Optional[str] = Form(None),
    department_id: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(require_role(
        UserRole.DEPARTMENT_USER, UserRole.ACCOUNTANT_1, UserRole.ACCOUNTANT_2, UserRole.ADMIN
    )),
):
    """Create and submit a new invoice with file attachment."""
    if amount <= 0:
        raise BadRequestException("Amount must be greater than zero")
    if currency not in ("INR", "USD"):
        raise BadRequestException("Currency must be INR or USD")

    # Read file content
    file_bytes = await file.read()

    # Create invoice
    invoice = await InvoiceService.create_invoice(
        db,
        vendor_name=vendor_name,
        amount=amount,
        currency=currency,
        remarks=remarks,
        department_id=department_id,
        actor=actor,
    )

    # Upload file
    file_record = await FileService.upload_file(
        db,
        invoice_id=str(invoice.id),
        file_bytes=file_bytes,
        file_name=file.filename or "unnamed.pdf",
        file_size=len(file_bytes),
        mime_type=file.content_type or "application/pdf",
        actor=actor,
    )

    # Audit log
    await AuditService.log(
        db,
        invoice_id=invoice.id,
        actor=actor,
        action="invoice.submitted",
        resource_type="invoice",
        resource_id=str(invoice.id),
        details={
            "vendor_name": vendor_name,
            "amount": amount,
            "currency": currency,
            "invoice_number": invoice.invoice_number,
        },
    )

    return {
        "success": True,
        "data": {
            "id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "vendor_name": invoice.vendor_name,
            "amount": float(invoice.amount),
            "currency": invoice.currency,
            "department_id": str(invoice.department_id) if invoice.department_id else None,
            "status": invoice.status,
            "submitted_at": invoice.submitted_at.isoformat() if invoice.submitted_at else None,
            "file": {
                "id": str(file_record.id),
                "file_name": file_record.file_name,
                "file_size": file_record.file_size,
            },
        },
    }


@router.get("")
async def list_invoices(
    status: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(get_current_user),
):
    """List invoices filtered by role and optional status."""
    invoices, total = await InvoiceService.list_invoices(
        db, actor=actor, status=status, limit=limit, offset=offset,
    )
    return {
        "success": True,
        "data": invoices,
        "meta": {"total": total, "limit": limit, "offset": offset},
    }


@router.get("/search")
async def search_invoices(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(get_current_user),
):
    """Search invoices by invoice number, vendor name, or submitter name.
    
    DEPARTMENT_USER can only search their own invoices.
    All other roles can search all invoices.
    """
    from app.models.invoice import Invoice
    from app.models.user import UserProfile
    from app.models.department import Department

    term = f"%{q}%"

    query = (
        select(Invoice, UserProfile.full_name, Department.name.label("department_name"))
        .join(UserProfile, Invoice.submitted_by == UserProfile.id)
        .outerjoin(Department, Invoice.department_id == Department.id)
        .where(
            or_(
                Invoice.invoice_number.ilike(term),
                Invoice.vendor_name.ilike(term),
                UserProfile.full_name.ilike(term),
            )
        )
    )

    # Scope search to user's own invoices for DEPARTMENT_USER
    if actor.role == UserRole.DEPARTMENT_USER:
        query = query.where(Invoice.submitted_by == actor.id)

    # Statement-linked invoices only visible to accountant_1 and admin
    if actor.role not in (UserRole.ACCOUNTANT_1, UserRole.ADMIN):
        query = query.where(Invoice.statement_transaction_id.is_(None))

    # Count total matches before pagination
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = total_result.scalar() or 0

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

    return {
        "success": True,
        "data": invoices,
        "meta": {"total": total, "query": q, "limit": limit, "offset": offset},
    }


@router.get("/queue/pending")
async def get_pending_queue(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(get_current_user),
):
    """Get invoices pending the current user's approval based on their role and workflow stage."""
    from app.services.approval_service import ApprovalService
    invoices, total = await ApprovalService.get_pending_queue(
        db, actor=actor, limit=limit, offset=offset,
    )
    return {
        "success": True,
        "data": invoices,
        "meta": {"total": total, "limit": limit, "offset": offset},
    }


@router.get("/{invoice_id}")
async def get_invoice(
    invoice_id: str,
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(get_current_user),
):
    """Get invoice details with submitter info and department name in a single query."""
    from app.models.department import Department
    from sqlalchemy import select as sa_select

    invoice, submitter_name = await InvoiceService.get_invoice_with_submitter(db, invoice_id)

    # Department users can only view their own invoices
    InvoiceService.assert_can_view(actor, invoice)

    # Get files
    files = await FileService.list_files_for_invoice(db, invoice_id)

    # Get department name via single query (avoids N+1)
    department_name = None
    if invoice.department_id:
        dept_result = await db.execute(
            sa_select(Department.name).where(Department.id == invoice.department_id)
        )
        department_name = dept_result.scalar_one_or_none()

    return {
        "success": True,
        "data": {
            "id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "vendor_name": invoice.vendor_name,
            "amount": float(invoice.amount),
            "currency": invoice.currency,
            "remarks": invoice.remarks,
            "status": invoice.status,
            "submitted_by": str(invoice.submitted_by),
            "submitter_name": submitter_name,
            "department_id": str(invoice.department_id) if invoice.department_id else None,
            "department_name": department_name,
            "submitted_at": invoice.submitted_at.isoformat() if invoice.submitted_at else None,
            "current_stage_id": str(invoice.current_stage_id) if invoice.current_stage_id else None,
            "version": invoice.version,
            "created_at": invoice.created_at.isoformat() if invoice.created_at else None,
            "files": [
                {
                    "id": str(f.id),
                    "file_type": f.file_type,
                    "file_name": f.file_name,
                    "file_size": f.file_size,
                    "mime_type": f.mime_type,
                    "created_at": f.created_at.isoformat() if f.created_at else None,
                }
                for f in files
            ],
        },
    }


@router.patch("/{invoice_id}")
async def update_invoice(
    invoice_id: str,
    vendor_name: Optional[str] = Form(None),
    amount: Optional[float] = Form(None),
    currency: Optional[str] = Form(None),
    remarks: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(require_permission("invoice:update_own")),
):
    """Update a draft or returned invoice."""
    if currency is not None and currency not in ("INR", "USD"):
        raise BadRequestException("Currency must be INR or USD")
    invoice = await InvoiceService.update_invoice(
        db, invoice_id,
        vendor_name=vendor_name,
        amount=amount,
        currency=currency,
        remarks=remarks,
        actor=actor,
    )
    return {
        "success": True,
        "data": {
            "id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "vendor_name": invoice.vendor_name,
            "amount": float(invoice.amount),
            "currency": invoice.currency,
            "remarks": invoice.remarks,
            "status": invoice.status,
            "version": invoice.version,
        },
    }


@router.delete("/{invoice_id}")
async def delete_invoice(
    invoice_id: str,
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(require_permission("invoice:delete")),
):
    """Delete an invoice. Only Accountant 1 can delete."""
    await InvoiceService.delete_invoice(db, invoice_id, actor=actor)
    return {"success": True, "data": {"message": "Invoice deleted successfully"}}


@router.post("/{invoice_id}/upload")
async def upload_additional_file(
    invoice_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(require_permission("file:upload")),
):
    """Upload an additional file to an existing invoice."""
    file_bytes = await file.read()

    # Department users can only attach files to their own invoices
    invoice = await InvoiceService.get_invoice(db, invoice_id)
    InvoiceService.assert_can_view(actor, invoice)

    file_record = await FileService.upload_file(
        db,
        invoice_id=invoice_id,
        file_bytes=file_bytes,
        file_name=file.filename or "unnamed.pdf",
        file_size=len(file_bytes),
        mime_type=file.content_type or "application/pdf",
        actor=actor,
    )

    return {
        "success": True,
        "data": {
            "id": str(file_record.id),
            "file_name": file_record.file_name,
            "file_size": file_record.file_size,
            "file_type": file_record.file_type,
        },
    }


@router.get("/{invoice_id}/files")
async def list_invoice_files(
    invoice_id: str,
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(get_current_user),
):
    """List all files for an invoice."""
    invoice = await InvoiceService.get_invoice(db, invoice_id)
    InvoiceService.assert_can_view(actor, invoice)

    files = await FileService.list_files_for_invoice(db, invoice_id)
    return {
        "success": True,
        "data": [
            {
                "id": str(f.id),
                "file_type": f.file_type,
                "file_name": f.file_name,
                "file_size": f.file_size,
                "mime_type": f.mime_type,
                "created_at": f.created_at.isoformat() if f.created_at else None,
            }
            for f in files
        ],
    }


@router.post("/{invoice_id}/resubmit")
async def resubmit_invoice(
    invoice_id: str,
    vendor_name: Optional[str] = Form(None),
    amount: Optional[float] = Form(None),
    currency: Optional[str] = Form(None),
    remarks: Optional[str] = Form(None),
    file: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(require_role(
        UserRole.DEPARTMENT_USER, UserRole.ACCOUNTANT_1, UserRole.ACCOUNTANT_2, UserRole.ADMIN
    )),
):
    """Resubmit a returned invoice with optional updated fields and/or new file."""
    from app.models.invoice import Invoice
    inv_uuid = await resolve_invoice_id(db, invoice_id)
    result = await db.execute(
        select(Invoice).where(Invoice.id == inv_uuid).with_for_update()
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise NotFoundException("Invoice", invoice_id)

    # Only owner can resubmit, only if returned
    if str(invoice.submitted_by) != actor.id and actor.role != UserRole.ADMIN:
        raise BadRequestException("You can only resubmit your own invoices")
    if invoice.status != "returned":
        raise BadRequestException(f"Can only resubmit returned invoices (current: {invoice.status})")

    # Update fields if provided
    if vendor_name is not None:
        invoice.vendor_name = vendor_name
    if amount is not None:
        if amount <= 0:
            raise BadRequestException("Amount must be greater than zero")
        invoice.amount = amount
    if currency is not None:
        if currency not in ("INR", "USD"):
            raise BadRequestException("Currency must be INR or USD")
        invoice.currency = currency
    if remarks is not None:
        invoice.remarks = remarks

    # Upload new file if provided
    file_record = None
    if file:
        file_bytes = await file.read()
        file_record = await FileService.upload_file(
            db,
            invoice_id=str(invoice.id),
            file_bytes=file_bytes,
            file_name=file.filename or "unnamed.pdf",
            file_size=len(file_bytes),
            mime_type=file.content_type or "application/pdf",
            actor=actor,
        )

    # Transition: returned → submitted (new submission cycle)
    old_status = invoice.status

    # Clear the previous cycle's approval actions so stage tracking and the
    # duplicate-approval guard start fresh. The full audit trail is preserved
    # in audit_logs.
    from app.models.approval import ApprovalAction
    await db.execute(
        delete(ApprovalAction).where(ApprovalAction.invoice_id == invoice.id)
    )

    invoice.status = "submitted"
    invoice.current_stage_id = None
    invoice.version += 1

    # Audit log
    await AuditService.log(
        db,
        invoice_id=invoice.id,
        actor=actor,
        action="invoice.resubmitted",
        resource_type="invoice",
        resource_id=str(invoice.id),
        details={
            "from_status": old_status,
            "to_status": "submitted",
            "invoice_number": invoice.invoice_number,
        },
    )

    return {
        "success": True,
        "data": {
            "id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "vendor_name": invoice.vendor_name,
            "amount": float(invoice.amount),
            "currency": invoice.currency,
            "status": invoice.status,
            "version": invoice.version,
            "file": {
                "id": str(file_record.id),
                "file_name": file_record.file_name,
            } if file_record else None,
        },
    }


@router.get("/files/{file_id}/download")
async def download_file(
    file_id: str,
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(require_permission("file:download")),
):
    """Get a signed download URL for a file."""
    signed_url = await FileService.get_signed_url(db, file_id, actor=actor)
    return {
        "success": True,
        "data": {
            "signed_url": signed_url,
            "expires_in": 3600,
        },
    }


@router.get("/{invoice_id}/print-pdf")
async def print_invoice_pdf(
    invoice_id: str,
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(require_role(UserRole.ACCOUNTANT_1, UserRole.ADMIN)),
):
    """Generate a PDF of the approved invoice with approval summary overlaid on the original.
    Restricted to Accountant 1 (and admin)."""
    from fastapi.responses import StreamingResponse
    from app.services.approval_service import ApprovalService
    from app.services.pdf_service import PDFService

    invoice, submitter_name = await InvoiceService.get_invoice_with_submitter(db, invoice_id)

    InvoiceService.assert_can_view(actor, invoice)

    if invoice.status != "approved":
        from app.core.exceptions import BadRequestException
        raise BadRequestException("Only approved invoices can be printed")

    # Get original file bytes
    original_data = await FileService.get_original_file_for_invoice(db, invoice_id)
    if not original_data:
        from app.core.exceptions import NotFoundException
        raise NotFoundException("File", f"original file for invoice {invoice_id}")

    original_bytes, mime_type = original_data

    # Non-PDF originals (image uploads) are converted into a PDF page first
    if mime_type != "application/pdf":
        original_bytes = PDFService.image_to_pdf(original_bytes, mime_type)
    else:
        # Corrupt/fake PDFs already in storage must fail cleanly, not crash pypdf
        FileService.validate_pdf_content(original_bytes)

    # Statement invoices: only append narration page, skip approval stamp
    if invoice.statement_transaction_id:
        merged_bytes = original_bytes
        if invoice.remarks:
            merged_bytes = PDFService.append_narration_to_pdf(original_bytes, invoice.remarks)
    else:
        # Get approval history
        history = await ApprovalService.get_action_history(db, invoice_id)

        # Build approval chain
        approval_chain = PDFService.build_approval_chain_from_history(history)

        # Submitted date
        from datetime import timezone, timedelta
        _IST = timezone(timedelta(hours=5, minutes=30))
        submitted_at = ""
        if invoice.submitted_at:
            submitted_at = invoice.submitted_at.astimezone(_IST).strftime("%d %b %Y, %I:%M %p")

        # Build approved PDF with space-aware stamp placement (same page if space,
        # otherwise embedded on the back page)
        merged_bytes = PDFService.build_approved_pdf(
            original_bytes=original_bytes,
            invoice_number=invoice.invoice_number,
            vendor_name=invoice.vendor_name,
            amount=float(invoice.amount),
            currency=invoice.currency or "INR",
            approval_chain=approval_chain,
            submitted_at=submitted_at,
            remarks=invoice.remarks or "",
        )

    return StreamingResponse(
        BytesIO(merged_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{invoice.invoice_number}_approved.pdf"',
        },
    )

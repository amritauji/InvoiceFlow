from typing import Optional
from fastapi import APIRouter, Depends, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import InvoiceCreate
from app.services.invoice_service import InvoiceService
from app.services.file_service import FileService
from app.services.audit_service import AuditService
from app.core.dependencies import get_current_user, require_role, require_permission, UserContext, UserRole
from app.core.exceptions import BadRequestException

router = APIRouter(prefix="/invoices", tags=["Invoices"])


@router.post("")
async def create_invoice(
    vendor_name: str = Form(...),
    amount: float = Form(...),
    remarks: Optional[str] = Form(None),
    department_id: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(require_role(UserRole.DEPARTMENT_USER, UserRole.ADMIN)),
):
    """Create and submit a new invoice with file attachment."""
    if amount <= 0:
        raise BadRequestException("Amount must be greater than zero")

    # Read file content
    file_bytes = await file.read()

    # Create invoice
    invoice = await InvoiceService.create_invoice(
        db,
        vendor_name=vendor_name,
        amount=amount,
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
    """Get invoice details with submitter info."""
    invoice, submitter_name = await InvoiceService.get_invoice_with_submitter(db, invoice_id)

    # Get files
    files = await FileService.list_files_for_invoice(db, invoice_id)

    return {
        "success": True,
        "data": {
            "id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "vendor_name": invoice.vendor_name,
            "amount": float(invoice.amount),
            "remarks": invoice.remarks,
            "status": invoice.status,
            "submitted_by": str(invoice.submitted_by),
            "submitter_name": submitter_name,
            "department_id": str(invoice.department_id) if invoice.department_id else None,
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
    remarks: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(get_current_user),
):
    """Update a draft or returned invoice."""
    invoice = await InvoiceService.update_invoice(
        db, invoice_id,
        vendor_name=vendor_name,
        amount=amount,
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
            "remarks": invoice.remarks,
            "status": invoice.status,
            "version": invoice.version,
        },
    }


@router.post("/{invoice_id}/upload")
async def upload_additional_file(
    invoice_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(require_permission("file:upload")),
):
    """Upload an additional file to an existing invoice."""
    file_bytes = await file.read()

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
    remarks: Optional[str] = Form(None),
    file: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(require_role(UserRole.DEPARTMENT_USER, UserRole.ADMIN)),
):
    """Resubmit a returned invoice with optional updated fields and/or new file."""
    invoice = await InvoiceService.get_invoice(db, invoice_id)

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

    # Transition: returned → submitted
    old_status = invoice.status
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
    actor: UserContext = Depends(get_current_user),
):
    """Generate a PDF of the approved invoice with approval summary overlaid on the original."""
    from fastapi.responses import StreamingResponse
    from app.services.approval_service import ApprovalService
    from app.services.pdf_service import PDFService

    invoice, submitter_name = await InvoiceService.get_invoice_with_submitter(db, invoice_id)

    if invoice.status != "approved":
        from app.core.exceptions import BadRequestException
        raise BadRequestException("Only approved invoices can be printed")

    # Get original file bytes
    original_data = await FileService.get_original_file_for_invoice(db, invoice_id)
    if not original_data:
        from app.core.exceptions import NotFoundException
        raise NotFoundException("File", f"original file for invoice {invoice_id}")

    original_bytes, mime_type = original_data

    # If original is not PDF, we can't overlay — return it as-is
    if mime_type != "application/pdf":
        from fastapi.responses import Response
        return Response(content=original_bytes, media_type=mime_type)

    # Get approval history
    history = await ApprovalService.get_action_history(db, invoice_id)

    # Build approval chain
    approval_chain = PDFService.build_approval_chain_from_history(history)

    # Get original PDF page dimensions
    from PyPDF2 import PdfReader
    from io import BytesIO
    reader = PdfReader(BytesIO(original_bytes))
    last_page = reader.pages[-1]
    box = last_page.mediabox
    page_width = float(box.width) * 25.4 / 72  # PDF points to mm
    page_height = float(box.height) * 25.4 / 72

    # Submitted date
    from datetime import timezone, timedelta
    _IST = timezone(timedelta(hours=5, minutes=30))
    submitted_at = ""
    if invoice.submitted_at:
        submitted_at = invoice.submitted_at.astimezone(_IST).strftime("%d %b %Y, %I:%M %p")

    # Generate overlay
    overlay_bytes = PDFService.generate_approval_overlay_pdf(
        page_width=page_width,
        page_height=page_height,
        invoice_number=invoice.invoice_number,
        approval_chain=approval_chain,
        submitted_at=submitted_at,
        remarks=invoice.remarks or "",
    )

    # Merge overlay onto original
    merged_bytes = PDFService.overlay_on_original_pdf(original_bytes, overlay_bytes)

    return StreamingResponse(
        BytesIO(merged_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{invoice.invoice_number}_approved.pdf"',
        },
    )

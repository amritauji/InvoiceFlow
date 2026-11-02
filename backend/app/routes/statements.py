import os
import uuid
import tempfile
from typing import Optional
from fastapi import APIRouter, Depends, Query, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.core.dependencies import get_current_user, require_role, UserContext, UserRole
from app.core.exceptions import BadRequestException, NotFoundException
from app.services.statement_service import StatementService
from app.services.file_service import FileService
from app.services.invoice_service import InvoiceService
from app.services.audit_service import AuditService
from app.services.notification_service import NotificationService
from app.models.statement import StatementTransaction
from app.models.invoice import Invoice
from app.models.user import UserProfile

router = APIRouter(prefix="/statements", tags=["Statements"])


@router.post("/parse-preview")
async def parse_preview(
    file: UploadFile = File(...),
    actor: UserContext = Depends(require_role(
        UserRole.ACCOUNTANT_1,
    )),
):
    """Parse a statement PDF and return extracted transactions without saving to DB."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise BadRequestException("Only PDF files are accepted.")

    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise BadRequestException("File is too large. Maximum size is 10MB.")

    # Write to temp file for pypdf parsing
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        text = StatementService.extract_text(tmp_path)
        meta = StatementService.parse_metadata(text)
        transactions = StatementService.parse_transactions(text)
    finally:
        os.unlink(tmp_path)

    if not transactions:
        raise BadRequestException("No transactions found in the uploaded statement.")

    return {
        "success": True,
        "data": {
            "meta": meta,
            "transactions": transactions,
            "file_name": file.filename,
            "file_size": len(file_bytes),
        },
    }


@router.post("")
async def create_statement(
    file: UploadFile = File(...),
    statement_name: Optional[str] = Form(None),
    remarks: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(require_role(
        UserRole.ACCOUNTANT_1,
    )),
):
    """Upload a statement PDF, extract transactions, and save to DB."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise BadRequestException("Only PDF files are accepted.")

    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise BadRequestException("File is too large. Maximum size is 10MB.")

    mime_type = file.content_type or "application/pdf"

    # Write to temp file for parsing
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        text = StatementService.extract_text(tmp_path)
        transactions = StatementService.parse_transactions(text)
    finally:
        os.unlink(tmp_path)

    if not transactions:
        raise BadRequestException("No transactions found in the uploaded statement.")

    # Store file (use local path for now; Supabase storage integration is optional)
    storage_path = f"statements/{actor.id}/{file.filename}"

    statement = await StatementService.create(
        db,
        user_id=actor.id,
        text=text,
        file_path=storage_path,
        file_name=file.filename,
        file_size=len(file_bytes),
        mime_type=mime_type,
        statement_name=statement_name,
        remarks=remarks,
    )

    return {
        "success": True,
        "data": {
            "id": str(statement.id),
            "statement_number": statement.statement_number,
            "statement_name": statement.statement_name,
            "total_transactions": statement.total_transactions,
            "status": statement.status,
            "created_at": statement.created_at.isoformat(),
        },
    }


@router.get("")
async def list_statements(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(get_current_user),
):
    """List all statements with unverified transaction counts."""
    stmts, total = await StatementService.list_all_with_counts(db, limit=limit, offset=offset)
    return {
        "success": True,
        "data": [
            {
                "id": str(s.stmt.id),
                "statement_number": s.stmt.statement_number,
                "statement_name": s.stmt.statement_name,
                "card_last_four": s.stmt.card_last_four,
                "card_holder_name": s.stmt.card_holder_name,
                "billing_period": s.stmt.billing_period,
                "total_amount_due": float(s.stmt.total_amount_due) if s.stmt.total_amount_due else None,
                "total_transactions": s.stmt.total_transactions,
                "unverified_count": s.unverified_count,
                "invoiced_count": s.invoiced_count,
                "status": s.stmt.status,
                "submitted_at": s.stmt.submitted_at.isoformat(),
            }
            for s in stmts
        ],
        "meta": {"total": total, "limit": limit, "offset": offset},
    }


@router.get("/{statement_id}")
async def get_statement(
    statement_id: str,
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(get_current_user),
):
    """Get a statement with its extracted transactions."""
    statement, transactions = await StatementService.get_with_transactions(db, statement_id)

    # Compute invoice counts per transaction dynamically
    txn_ids = [t.id for t in transactions]
    invoice_counts = {}
    if txn_ids:
        count_result = await db.execute(
            select(Invoice.statement_transaction_id, func.count(Invoice.id))
            .where(Invoice.statement_transaction_id.in_(txn_ids))
            .group_by(Invoice.statement_transaction_id)
        )
        invoice_counts = {row[0]: row[1] for row in count_result.all()}

    return {
        "success": True,
        "data": {
            "id": str(statement.id),
            "statement_number": statement.statement_number,
            "statement_name": statement.statement_name,
            "card_last_four": statement.card_last_four,
            "card_holder_name": statement.card_holder_name,
            "billing_period": statement.billing_period,
            "total_amount_due": float(statement.total_amount_due) if statement.total_amount_due else None,
            "total_transactions": statement.total_transactions,
            "status": statement.status,
            "remarks": statement.remarks,
            "submitted_by": str(statement.submitted_by),
            "submitted_at": statement.submitted_at.isoformat(),
            "transactions": [
                {
                    "id": str(t.id),
                    "transaction_date": t.transaction_date,
                    "description": t.description,
                    "amount": float(t.amount),
                    "is_verified": t.is_verified,
                    "verified_by": str(t.verified_by) if t.verified_by else None,
                    "verified_at": t.verified_at.isoformat() if t.verified_at else None,
                    "row_index": t.row_index,
                    "has_invoice": invoice_counts.get(t.id, 0) > 0,
                    "invoice_count": invoice_counts.get(t.id, 0),
                }
                for t in transactions
            ],
        },
    }


@router.get("/{statement_id}/unverified")
async def get_unverified_transactions(
    statement_id: str,
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(get_current_user),
):
    """Get only unverified (unchecked) transactions for a statement.
    Used by non-accountant-1 roles to see which transactions still need invoices."""
    statement, transactions = await StatementService.get_with_transactions(db, statement_id)

    # Compute invoice counts per transaction dynamically
    txn_ids = [t.id for t in transactions]
    invoice_counts = {}
    if txn_ids:
        count_result = await db.execute(
            select(Invoice.statement_transaction_id, func.count(Invoice.id))
            .where(Invoice.statement_transaction_id.in_(txn_ids))
            .group_by(Invoice.statement_transaction_id)
        )
        invoice_counts = {row[0]: row[1] for row in count_result.all()}

    unverified = [t for t in transactions if not t.is_verified]
    return {
        "success": True,
        "data": {
            "id": str(statement.id),
            "statement_number": statement.statement_number,
            "statement_name": statement.statement_name,
            "card_last_four": statement.card_last_four,
            "card_holder_name": statement.card_holder_name,
            "billing_period": statement.billing_period,
            "transactions": [
                {
                    "id": str(t.id),
                    "transaction_date": t.transaction_date,
                    "description": t.description,
                    "amount": float(t.amount),
                    "row_index": t.row_index,
                    "has_invoice": invoice_counts.get(t.id, 0) > 0,
                    "invoice_count": invoice_counts.get(t.id, 0),
                }
                for t in unverified
            ],
        },
    }


@router.post("/{transaction_id}/submit-invoice")
async def submit_invoice_from_statement(
    transaction_id: str,
    narration: Optional[str] = Form(None),
    department_id: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(require_role(
        UserRole.DEPARTMENT_USER, UserRole.ACCOUNTANT_1, UserRole.ACCOUNTANT_2,
        UserRole.ACCOUNTS_TEAM, UserRole.ACCOUNTS_HEAD, UserRole.MANAGER, UserRole.CEO, UserRole.ADMIN,
    )),
):
    """Submit an invoice linked to a statement transaction.
    Amount, date, and vendor_name are auto-filled from the transaction.
    A notification is sent to Accountant 1 for verification."""
    from datetime import datetime as dt

    # Fetch the statement transaction
    txn = await db.get(StatementTransaction, uuid.UUID(transaction_id))
    if not txn:
        raise NotFoundException("Statement transaction", transaction_id)

    # Read file
    file_bytes = await file.read()
    if len(file_bytes) > 10 * 10 * 1024 * 1024:
        raise BadRequestException("File is too large.")

    # Create invoice with auto-filled fields from transaction
    invoice = await InvoiceService.create_invoice(
        db,
        vendor_name=txn.description[:200],
        amount=float(txn.amount),
        currency="INR",
        remarks=narration,
        department_id=department_id,
        actor=actor,
        statement_transaction_id=txn.id,
    )

    # Upload file
    file_record = await FileService.upload_file(
        db,
        invoice_id=str(invoice.id),
        file_bytes=file_bytes,
        file_name=file.filename or "invoice.pdf",
        file_size=len(file_bytes),
        mime_type=file.content_type or "application/pdf",
        actor=actor,
    )

    # Audit log
    await AuditService.log(
        db,
        invoice_id=invoice.id,
        actor=actor,
        action="invoice.submitted_from_statement",
        resource_type="invoice",
        resource_id=str(invoice.id),
        details={
            "statement_transaction_id": str(txn.id),
            "vendor_name": txn.description[:200],
            "amount": float(txn.amount),
        },
    )

    # Notify all accountant_1 users
    acct1_result = await db.execute(
        select(UserProfile.id).where(UserProfile.role == "accountant_1", UserProfile.is_active.is_(True))
    )
    acct1_ids = [row[0] for row in acct1_result.all()]
    for uid in acct1_ids:
        await NotificationService.create(
            db,
            user_id=uid,
            invoice_id=invoice.id,
            type="statement_invoice_submitted",
            title="Invoice Submitted from Statement",
            message=f"An invoice ({invoice.invoice_number}) has been submitted against statement transaction: {txn.description[:80]} for ₹{float(txn.amount):,.2f}. Please verify and tick the transaction.",
        )

    return {
        "success": True,
        "data": {
            "invoice_id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "vendor_name": invoice.vendor_name,
            "amount": float(invoice.amount),
            "status": invoice.status,
            "statement_transaction_id": str(txn.id),
        },
    }


@router.patch("/{transaction_id}/toggle-verify")
async def toggle_verify(
    transaction_id: str,
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(require_role(
        UserRole.ACCOUNTANT_1,
    )),
):
    """Toggle the verification checkmark on a single transaction row."""
    txn = await StatementService.toggle_verified(db, transaction_id, actor.id)
    return {
        "success": True,
        "data": {
            "id": str(txn.id),
            "is_verified": txn.is_verified,
            "verified_at": txn.verified_at.isoformat() if txn.verified_at else None,
        },
    }


@router.patch("/{statement_id}/verify-all")
async def verify_all(
    statement_id: str,
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(require_role(
        UserRole.ACCOUNTANT_1,
    )),
):
    """Mark all transactions in a statement as verified."""
    count = await StatementService.verify_all(db, statement_id, actor.id)
    return {
        "success": True,
        "data": {"verified_count": count},
    }

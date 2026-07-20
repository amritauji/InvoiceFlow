from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from io import BytesIO

from app.database import get_db
from app.services.dashboard_service import DashboardService
from app.services.report_service import ReportService
from app.services.pdf_service import PDFService
from app.services.invoice_service import InvoiceService
from app.core.dependencies import get_current_user, require_permission, UserContext

router = APIRouter(tags=["Dashboard & Reports"])


@router.get("/dashboard/stats")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(get_current_user),
):
    """Get dashboard statistics (counts, amounts, trends)."""
    stats = await DashboardService.get_stats(db, actor=actor)
    return {"success": True, "data": stats}


@router.get("/reports/summary")
async def get_summary_report(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    department_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(require_permission("audit:read")),
):
    """Generate a summary report by date range and/or department."""
    report = await ReportService.summary_report(
        db,
        start_date=start_date,
        end_date=end_date,
        department_id=department_id,
    )
    return {"success": True, "data": report}


@router.get("/reports/detailed")
async def get_detailed_report(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    status: Optional[str] = Query(None),
    department_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(require_permission("audit:read")),
):
    """Generate a detailed invoice list report."""
    invoices, total = await ReportService.detailed_report(
        db,
        start_date=start_date,
        end_date=end_date,
        status=status,
        department_id=department_id,
        limit=limit,
        offset=offset,
    )
    return {
        "success": True,
        "data": invoices,
        "meta": {"total": total, "limit": limit, "offset": offset},
    }


@router.get("/invoices/{invoice_id}/pdf")
async def generate_invoice_pdf(
    invoice_id: str,
    include_stamp: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(get_current_user),
):
    """Generate and download a PDF for an invoice."""
    invoice, submitter_name = await InvoiceService.get_invoice_with_submitter(db, invoice_id)

    # Get department name
    from app.models.user import UserProfile
    from app.models.department import Department
    from sqlalchemy import select

    dept_result = await db.execute(
        select(Department.name)
        .join(UserProfile, UserProfile.department_id == Department.id)
        .where(UserProfile.id == invoice.submitted_by)
    )
    dept_row = dept_result.first()
    department = dept_row[0] if dept_row else ""

    # Status stamp
    stamp_map = {
        "approved": ("APPROVED", "approved"),
        "rejected": ("REJECTED", "rejected"),
        "under_review": ("UNDER REVIEW", "under_review"),
    }

    stamp_text, stamp_color = "", ""
    if invoice.status in stamp_map:
        stamp_text, stamp_color = stamp_map[invoice.status]

    pdf_bytes = PDFService.generate_invoice_pdf(
        invoice_number=invoice.invoice_number,
        vendor_name=invoice.vendor_name,
        amount=float(invoice.amount),
        status=invoice.status,
        submitted_at=invoice.submitted_at.strftime("%Y-%m-%d") if invoice.submitted_at else "",
        submitter_name=submitter_name,
        department=department,
        remarks=invoice.remarks or "",
        stamp_text=stamp_text,
        stamp_color=stamp_color,
    )

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{invoice.invoice_number}.pdf"'
        },
    )

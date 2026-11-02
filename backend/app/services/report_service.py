"""
Reports service.
Generates summary reports by date range, department, and status.
Exports as JSON data for frontend rendering or PDF download.
"""

from datetime import datetime, date
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract

from app.models.invoice import Invoice
from app.models.user import UserProfile
from app.models.department import Department
from app.core.dependencies import UserContext, UserRole


class ReportService:
    """Generate summary and detailed reports."""

    @staticmethod
    async def summary_report(
        db: AsyncSession,
        *,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        department_id: Optional[str] = None,
    ) -> dict:
        """Generate a summary report of all invoices in a date range."""
        import uuid as _uuid

        # Base filters
        filters = []
        if start_date:
            filters.append(Invoice.created_at >= datetime.combine(start_date, datetime.min.time()))
        if end_date:
            filters.append(Invoice.created_at <= datetime.combine(end_date, datetime.max.time()))

        # Overall stats
        stats_query = select(
            func.count(Invoice.id).label("total_count"),
            func.sum(Invoice.amount).label("total_amount"),
            func.avg(Invoice.amount).label("avg_amount"),
            func.min(Invoice.amount).label("min_amount"),
            func.max(Invoice.amount).label("max_amount"),
        )
        for f in filters:
            stats_query = stats_query.where(f)

        result = await db.execute(stats_query)
        stats = result.one()

        # By status
        status_query = select(
            Invoice.status,
            func.count(Invoice.id).label("count"),
            func.sum(Invoice.amount).label("total_amount"),
        )
        for f in filters:
            status_query = status_query.where(f)
        status_query = status_query.group_by(Invoice.status)

        result = await db.execute(status_query)
        by_status = [
            {
                "status": row.status,
                "count": row.count,
                "total_amount": float(row.total_amount or 0),
            }
            for row in result.all()
        ]

        # By department
        dept_filters = list(filters)
        if department_id:
            dept_filters.append(UserProfile.department_id == _uuid.UUID(department_id))

        dept_query = (
            select(
                Department.name,
                Department.code,
                func.count(Invoice.id).label("count"),
                func.sum(Invoice.amount).label("total_amount"),
            )
            .join(UserProfile, Invoice.submitted_by == UserProfile.id)
            .join(Department, UserProfile.department_id == Department.id)
        )
        for f in dept_filters:
            dept_query = dept_query.where(f)
        dept_query = dept_query.group_by(Department.name, Department.code).order_by(
            func.count(Invoice.id).desc()
        )

        result = await db.execute(dept_query)
        by_department = [
            {
                "department": row.name,
                "code": row.code,
                "count": row.count,
                "total_amount": float(row.total_amount or 0),
            }
            for row in result.all()
        ]

        # Top vendors
        vendor_query = select(
            Invoice.vendor_name,
            func.count(Invoice.id).label("count"),
            func.sum(Invoice.amount).label("total_amount"),
        )
        for f in filters:
            vendor_query = vendor_query.where(f)
        vendor_query = (
            vendor_query.group_by(Invoice.vendor_name)
            .order_by(func.sum(Invoice.amount).desc())
            .limit(10)
        )

        result = await db.execute(vendor_query)
        top_vendors = [
            {
                "vendor": row.vendor_name,
                "count": row.count,
                "total_amount": float(row.total_amount or 0),
            }
            for row in result.all()
        ]

        # Monthly breakdown
        monthly_query = select(
            extract("year", Invoice.created_at).label("year"),
            extract("month", Invoice.created_at).label("month"),
            func.count(Invoice.id).label("count"),
            func.sum(Invoice.amount).label("total_amount"),
        )
        for f in filters:
            monthly_query = monthly_query.where(f)
        monthly_query = monthly_query.group_by(
            extract("year", Invoice.created_at),
            extract("month", Invoice.created_at),
        ).order_by(
            extract("year", Invoice.created_at),
            extract("month", Invoice.created_at),
        )

        result = await db.execute(monthly_query)
        monthly = [
            {
                "year": int(row.year),
                "month": int(row.month),
                "count": row.count,
                "total_amount": float(row.total_amount or 0),
            }
            for row in result.all()
        ]

        return {
            "report_type": "summary",
            "generated_at": datetime.utcnow().isoformat(),
            "filters": {
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
                "department_id": department_id,
            },
            "overall": {
                "total_count": stats.total_count or 0,
                "total_amount": float(stats.total_amount or 0),
                "average_amount": float(stats.avg_amount or 0),
                "min_amount": float(stats.min_amount or 0),
                "max_amount": float(stats.max_amount or 0),
            },
            "by_status": by_status,
            "by_department": by_department,
            "top_vendors": top_vendors,
            "monthly_breakdown": monthly,
        }

    @staticmethod
    async def detailed_report(
        db: AsyncSession,
        *,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        status: Optional[str] = None,
        department_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """Generate a detailed list report of invoices."""
        import uuid as _uuid

        query = (
            select(Invoice, UserProfile.full_name, Department.name)
            .join(UserProfile, Invoice.submitted_by == UserProfile.id)
            .outerjoin(Department, UserProfile.department_id == Department.id)
        )

        if start_date:
            query = query.where(Invoice.created_at >= datetime.combine(start_date, datetime.min.time()))
        if end_date:
            query = query.where(Invoice.created_at <= datetime.combine(end_date, datetime.max.time()))
        if status:
            query = query.where(Invoice.status == status)
        if department_id:
            query = query.where(UserProfile.department_id == _uuid.UUID(department_id))

        # Count
        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()

        # Fetch page
        result = await db.execute(
            query.order_by(Invoice.created_at.desc()).limit(limit).offset(offset)
        )
        rows = result.all()

        invoices = [
            {
                "id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "vendor_name": inv.vendor_name,
                "amount": float(inv.amount),
                "currency": inv.currency,
                "status": inv.status,
                "submitter": submitter_name,
                "department": dept_name,
                "submitted_at": inv.submitted_at.isoformat() if inv.submitted_at else None,
                "created_at": inv.created_at.isoformat() if inv.created_at else None,
            }
            for inv, submitter_name, dept_name in rows
        ]

        return invoices, total

"""
Dashboard statistics service.
Provides counts by status, by department, recent activity, and monthly trends.
"""

import uuid
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, extract

from app.models.invoice import Invoice
from app.models.user import UserProfile
from app.models.department import Department
from app.core.dependencies import UserContext, UserRole


class DashboardService:
    """Aggregate statistics for the dashboard."""

    @staticmethod
    async def get_stats(
        db: AsyncSession,
        *,
        actor: UserContext,
    ) -> dict:
        """Get dashboard statistics based on user role."""

        # Base query: filter by role
        base_filter = []
        if actor.role == UserRole.DEPARTMENT_USER:
            base_filter.append(Invoice.submitted_by == uuid.UUID(actor.id))

        # Status counts
        status_query = select(
            Invoice.status,
            func.count(Invoice.id).label("count"),
        )
        for f in base_filter:
            status_query = status_query.where(f)
        status_query = status_query.group_by(Invoice.status)

        result = await db.execute(status_query)
        status_counts = {row.status: row.count for row in result.all()}

        total = sum(status_counts.values())

        # Amount totals by status, grouped by currency (mixed INR/USD must not be summed together)
        amount_query = select(
            Invoice.status,
            Invoice.currency,
            func.sum(Invoice.amount).label("total_amount"),
        )
        for f in base_filter:
            amount_query = amount_query.where(f)
        amount_query = amount_query.group_by(Invoice.status, Invoice.currency)

        result = await db.execute(amount_query)
        amount_by_status: dict[str, dict[str, float]] = {}
        for row in result.all():
            amount_by_status.setdefault(row.status, {})[row.currency] = float(row.total_amount or 0)

        total_amount = sum(
            amt for per_status in amount_by_status.values() for amt in per_status.values()
        )

        # Department breakdown (only for non-department-user roles)
        dept_breakdown = []
        if actor.role != UserRole.DEPARTMENT_USER:
            dept_query = (
                select(
                    Department.name,
                    Department.code,
                    func.count(Invoice.id).label("invoice_count"),
                    func.sum(Invoice.amount).label("total_amount"),
                )
                .join(UserProfile, Invoice.submitted_by == UserProfile.id)
                .join(Department, UserProfile.department_id == Department.id)
                .group_by(Department.name, Department.code)
                .order_by(func.count(Invoice.id).desc())
            )
            result = await db.execute(dept_query)
            dept_breakdown = [
                {
                    "department": row.name,
                    "code": row.code,
                    "count": row.invoice_count,
                    "total_amount": float(row.total_amount or 0),
                }
                for row in result.all()
            ]

        # Recent activity (latest invoices, no time cutoff so sparse data still shows)
        recent_query = select(
            Invoice.invoice_number,
            Invoice.vendor_name,
            Invoice.amount,
            Invoice.status,
            Invoice.submitted_at,
            UserProfile.full_name.label("submitter_name"),
        )
        for f in base_filter:
            recent_query = recent_query.where(f)
        recent_query = (
            recent_query
            .join(UserProfile, Invoice.submitted_by == UserProfile.id)
            .order_by(Invoice.created_at.desc())
            .limit(10)
        )
        result = await db.execute(recent_query)
        recent_invoices = [
            {
                "invoice_number": row.invoice_number,
                "vendor_name": row.vendor_name,
                "amount": float(row.amount),
                "status": row.status,
                "submitter_name": row.submitter_name,
                "submitted_at": row.submitted_at.isoformat() if row.submitted_at else None,
            }
            for row in result.all()
        ]

        # Monthly trend (last 6 months)
        six_months_ago = datetime.utcnow() - timedelta(days=180)
        monthly_query = (
            select(
                extract("year", Invoice.created_at).label("year"),
                extract("month", Invoice.created_at).label("month"),
                func.count(Invoice.id).label("count"),
                func.sum(Invoice.amount).label("total_amount"),
            )
            .where(Invoice.created_at >= six_months_ago)
            .group_by(
                extract("year", Invoice.created_at),
                extract("month", Invoice.created_at),
            )
            .order_by(
                extract("year", Invoice.created_at),
                extract("month", Invoice.created_at),
            )
        )
        for f in base_filter:
            monthly_query = monthly_query.where(f)

        result = await db.execute(monthly_query)
        monthly_trend = [
            {
                "year": int(row.year),
                "month": int(row.month),
                "count": row.count,
                "total_amount": float(row.total_amount or 0),
            }
            for row in result.all()
        ]

        return {
            "summary": {
                "total_invoices": total,
                "total_amount": total_amount,
                "pending": status_counts.get("submitted", 0) + status_counts.get("under_review", 0),
                "approved": status_counts.get("approved", 0),
                "rejected": status_counts.get("rejected", 0),
                "returned": status_counts.get("returned", 0),
            },
            "by_status": status_counts,
            "amount_by_status": amount_by_status,
            "by_department": dept_breakdown,
            "recent_invoices": recent_invoices,
            "monthly_trend": monthly_trend,
        }

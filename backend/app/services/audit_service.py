import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.audit import AuditLog
from app.core.dependencies import UserContext
from app.core.exceptions import NotFoundException


class AuditService:
    """Append-only audit logging. Never blocks the main operation."""

    @staticmethod
    async def log(
        db: AsyncSession,
        *,
        invoice_id: Optional[uuid.UUID] = None,
        actor: UserContext,
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        details: Optional[dict] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AuditLog:
        entry = AuditLog(
            invoice_id=invoice_id,
            actor_id=uuid.UUID(actor.id),
            actor_email=actor.email,
            actor_role=actor.role.value,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details or {},
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(entry)
        return entry

    @staticmethod
    async def get_for_invoice(
        db: AsyncSession,
        invoice_id: uuid.UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> list[AuditLog]:
        result = await db.execute(
            select(AuditLog)
            .where(AuditLog.invoice_id == invoice_id)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_all(
        db: AsyncSession,
        *,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        actor_id: Optional[str] = None,
        invoice_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[AuditLog], int]:
        query = select(AuditLog)

        if action:
            query = query.where(AuditLog.action == action)
        if resource_type:
            query = query.where(AuditLog.resource_type == resource_type)
        if actor_id:
            query = query.where(AuditLog.actor_id == uuid.UUID(actor_id))
        if invoice_id:
            import re
            from app.models.invoice import Invoice
            _UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
            if _UUID_RE.match(invoice_id):
                inv_uuid = uuid.UUID(invoice_id)
            else:
                result_uuid = await db.execute(
                    select(Invoice.id).where(Invoice.invoice_number == invoice_id)
                )
                inv_uuid = result_uuid.scalar_one_or_none()
                if not inv_uuid:
                    return [], 0
            query = query.where(AuditLog.invoice_id == inv_uuid)

        total_result = await db.execute(select(func.count()).select_from(query.subquery()))
        total = total_result.scalar()

        result = await db.execute(
            query.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
        )
        return list(result.scalars().all()), total

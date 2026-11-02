import uuid
from typing import Optional, Union
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.notification import Notification


def _coerce_uuid(value: Union[str, uuid.UUID]) -> uuid.UUID:
    return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))


class NotificationService:
    """Business logic for user notifications."""

    @staticmethod
    async def create(
        db: AsyncSession,
        *,
        user_id: Union[str, uuid.UUID],
        invoice_id: Optional[Union[str, uuid.UUID]] = None,
        type: str,
        title: str,
        message: str,
    ) -> Notification:
        """Create a notification for a user."""
        notification = Notification(
            user_id=_coerce_uuid(user_id),
            invoice_id=_coerce_uuid(invoice_id) if invoice_id else None,
            type=type,
            title=title,
            message=message,
            is_read=False,
        )
        db.add(notification)
        await db.flush()
        return notification

    @staticmethod
    async def list_for_user(
        db: AsyncSession,
        user_id: str,
        *,
        unread_only: bool = False,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[dict], int, int]:
        """List notifications for a user.

        Returns (items, total, unread_count).
        """
        uid = _coerce_uuid(user_id)

        filters = [Notification.user_id == uid]
        if unread_only:
            filters.append(Notification.is_read.is_(False))

        total_result = await db.execute(select(func.count()).select_from(Notification).where(*filters))
        total = total_result.scalar() or 0

        unread_result = await db.execute(
            select(func.count()).select_from(Notification).where(
                Notification.user_id == uid,
                Notification.is_read.is_(False),
            )
        )
        unread = unread_result.scalar() or 0

        result = await db.execute(
            select(Notification)
            .where(*filters)
            .order_by(Notification.created_at.desc())
            .limit(limit)
            .offset(offset)
        )

        items = [
            {
                "id": str(n.id),
                "type": n.type,
                "title": n.title,
                "message": n.message,
                "invoice_id": str(n.invoice_id) if n.invoice_id else None,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in result.scalars().all()
        ]
        return items, total, unread

    @staticmethod
    async def mark_read(db: AsyncSession, notification_id: str, user_id: str) -> bool:
        """Mark a single notification as read. Returns False if not owned/not found."""
        uid = _coerce_uuid(user_id)
        result = await db.execute(
            select(Notification).where(
                Notification.id == _coerce_uuid(notification_id),
                Notification.user_id == uid,
            )
        )
        notification = result.scalar_one_or_none()
        if not notification:
            return False
        notification.is_read = True
        return True

    @staticmethod
    async def mark_all_read(db: AsyncSession, user_id: str) -> int:
        """Mark all of a user's notifications as read. Returns count marked."""
        uid = _coerce_uuid(user_id)
        result = await db.execute(
            select(Notification).where(
                Notification.user_id == uid,
                Notification.is_read.is_(False),
            )
        )
        items = result.scalars().all()
        for n in items:
            n.is_read = True
        return len(items)

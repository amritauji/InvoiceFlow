from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.notification_service import NotificationService
from app.core.dependencies import get_current_user, UserContext

router = APIRouter(tags=["Notifications"])


@router.get("/notifications")
async def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(get_current_user),
):
    """List the current user's notifications (newest first)."""
    items, total, unread = await NotificationService.list_for_user(
        db,
        actor.id,
        unread_only=unread_only,
        limit=limit,
        offset=offset,
    )
    return {
        "success": True,
        "data": items,
        "meta": {"total": total, "unread": unread, "limit": limit, "offset": offset},
    }


@router.get("/notifications/unread-count")
async def unread_notification_count(
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(get_current_user),
):
    """Get the current user's unread notification count."""
    _, _, unread = await NotificationService.list_for_user(db, actor.id, limit=1)
    return {"success": True, "data": {"unread": unread}}


@router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(get_current_user),
):
    """Mark a single notification as read."""
    marked = await NotificationService.mark_read(db, notification_id, actor.id)
    return {"success": True, "data": {"marked": marked}}


@router.patch("/notifications/read-all")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    actor: UserContext = Depends(get_current_user),
):
    """Mark all of the current user's notifications as read."""
    count = await NotificationService.mark_all_read(db, actor.id)
    return {"success": True, "data": {"marked": count}}

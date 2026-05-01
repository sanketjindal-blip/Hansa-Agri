"""User-facing notifications routes (in-app inbox)."""
from typing import List, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from core.security import get_current_user
from services import notifications

router = APIRouter(prefix="/notifications", tags=["notifications"])


class MarkReadIn(BaseModel):
    ids: Optional[List[str]] = None
    all: bool = False


@router.get("")
async def list_my_notifications(unread_only: bool = False, user=Depends(get_current_user)):
    items = await notifications.list_for_user(user["id"], unread_only=unread_only)
    return {
        "items": items,
        "unread_count": await notifications.unread_count(user["id"]),
    }


@router.get("/unread-count")
async def my_unread_count(user=Depends(get_current_user)):
    return {"unread_count": await notifications.unread_count(user["id"])}


@router.post("/mark-read")
async def mark_read(body: MarkReadIn, user=Depends(get_current_user)):
    n = await notifications.mark_read(user["id"], ids=body.ids, all_unread=body.all)
    return {"updated": n, "unread_count": await notifications.unread_count(user["id"])}

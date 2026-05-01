"""Customer support tickets."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends

from core.db import db
from core.security import get_current_user
from models.schemas import SupportTicketIn

router = APIRouter(prefix="/support", tags=["support"])


@router.post("/tickets")
async def create_ticket(body: SupportTicketIn, user=Depends(get_current_user)):
    ticket = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_email": user["email"],
        "subject": body.subject,
        "message": body.message,
        "product_id": body.product_id,
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.support_tickets.insert_one(ticket)
    ticket.pop("_id", None)
    return ticket


@router.get("/tickets")
async def my_tickets(user=Depends(get_current_user)):
    items = await db.support_tickets.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items

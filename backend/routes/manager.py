"""Manager-facing routes (leads/service management)."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.security import (
    get_current_user, require_manager_leads, require_manager_service,
)
from models.schemas import LeadStatusIn, ServiceUpdateIn
from services import loyalty, notifications
from sms import send_sms

router = APIRouter(prefix="/manager", tags=["manager"])


def _assignment_filter(user: dict) -> dict:
    """Build a Mongo $or filter so that managers only see items either
    explicitly assigned to them, or unassigned (visible to everyone).
    Admins see everything (returns empty filter)."""
    if user.get("role") == "admin":
        return {}
    return {
        "$or": [
            {"assigned_manager_ids": user["id"]},
            {"assigned_manager_ids": {"$exists": False}},
            {"assigned_manager_ids": []},
            {"assigned_manager_ids": None},
        ]
    }


@router.get("/me")
async def manager_me(user=Depends(get_current_user)):
    if user.get("role") not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Manager access required")
    return {
        "role": user.get("role"),
        "perms": user.get("manager_perms") or ({"leads": True, "service": True} if user.get("role") == "admin" else {}),
        "user": user,
    }


# ---- Leads (manager) ----
@router.get("/leads")
async def list_leads(status: str | None = None, user=Depends(require_manager_leads)):
    q = _assignment_filter(user)
    if status:
        q = {**q, "status": status}
    items = await db.leads.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@router.patch("/leads/{lead_id}")
async def update_lead(lead_id: str, body: LeadStatusIn, user=Depends(require_manager_leads)):
    try:
        return await loyalty.update_lead_status(lead_id, body.status, body.notes or "", user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---- Service requests (manager) ----
VALID_STATUS = ("open", "in_progress", "resolved", "closed", "cancelled")


@router.get("/service-requests")
async def list_service_requests(status: str | None = None, user=Depends(require_manager_service)):
    q = _assignment_filter(user)
    if status:
        q = {**q, "status": status}
    items = await db.service_requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@router.patch("/service-requests/{sr_id}")
async def update_service_request(sr_id: str, body: ServiceUpdateIn, user=Depends(require_manager_service)):
    if body.status not in VALID_STATUS:
        raise HTTPException(status_code=400, detail=f"status must be one of {VALID_STATUS}")
    sr = await db.service_requests.find_one({"id": sr_id}, {"_id": 0})
    if not sr:
        raise HTTPException(status_code=404, detail="Service request not found")
    timeline_entry = {
        "at": datetime.now(timezone.utc).isoformat(),
        "by": user["id"],
        "role": user.get("role", "manager"),
        "action": f"status -> {body.status}",
        "note": body.note or "",
    }
    update = {
        "status": body.status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "assigned_manager": user["id"],
    }
    if body.resolution:
        update["resolution"] = body.resolution
    await db.service_requests.update_one(
        {"id": sr_id},
        {"$set": update, "$push": {"timeline": timeline_entry}},
    )
    updated = await db.service_requests.find_one({"id": sr_id}, {"_id": 0})
    # Notify customer (in-app + SMS) when status moves into actionable states
    try:
        phone = sr.get("customer_phone", "")
        sms_text = (
            f"HANSA: Service request #{sr_id[:8]} \u2192 {body.status.upper()}. "
            + (f"{body.note or body.resolution}" if (body.note or body.resolution) else "View in app.")
        )
        if sr.get("user_id"):
            await notifications.notify_user(
                sr["user_id"],
                title=f"Service request {body.status.replace('_', ' ').title()}",
                body=(body.resolution or body.note or f"Status updated to {body.status}"),
                ntype="service_status",
                ref_type="service_request",
                ref_id=sr_id,
                sms_phone=phone if phone else None,
                sms_message=sms_text if phone else None,
            )
        elif phone:
            send_sms(phone, sms_text)
    except Exception:
        pass
    return updated


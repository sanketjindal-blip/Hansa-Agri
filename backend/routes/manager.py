"""Manager-facing routes (leads/service/warranty/points). A manager can hold
any combination of permissions: leads, service, warranty, points."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.security import (
    get_current_user,
    require_manager_leads, require_manager_service,
    require_manager_warranty, require_manager_points,
)
from models.schemas import (
    LeadStatusIn, ServiceUpdateIn, MultiAssignWarrantyIn, PointsAdjustIn,
)
from services import loyalty, notifications
from services.warranty import assign_warranty as _assign_warranty
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
    perms = user.get("manager_perms")
    if not perms and user.get("role") == "admin":
        perms = {"leads": True, "service": True, "warranty": True, "points": True}
    return {"role": user.get("role"), "perms": perms or {}, "user": user}


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
        return await loyalty.update_lead_status(
            lead_id, body.status, body.remark or body.notes or "", user,
        )
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
    now = datetime.now(timezone.utc).isoformat()
    remark = body.remark or body.note or ""
    timeline_entry = {
        "at": now, "by": user["id"], "by_name": user.get("name") or "",
        "role": user.get("role", "manager"),
        "action": f"status: {sr.get('status')} \u2192 {body.status}",
        "remark": remark,
    }
    update = {
        "status": body.status,
        "updated_at": now,
        "assigned_manager": user["id"],
    }
    if body.resolution:
        update["resolution"] = body.resolution
    await db.service_requests.update_one(
        {"id": sr_id},
        {"$set": update, "$push": {"timeline": timeline_entry}},
    )
    updated = await db.service_requests.find_one({"id": sr_id}, {"_id": 0})
    try:
        phone = sr.get("customer_phone", "")
        sms_text = (
            f"HANSA: Service request #{sr_id[:8]} \u2192 {body.status.upper()}. "
            + (remark or body.resolution or "View in app.")
        )
        if sr.get("user_id"):
            await notifications.notify_user(
                sr["user_id"],
                title=f"Service request {body.status.replace('_', ' ').title()}",
                body=(body.resolution or remark or f"Status updated to {body.status}"),
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


# ---- Warranty (manager-with-warranty perm) ----
@router.post("/assign-warranty")
async def manager_assign_warranty(body: MultiAssignWarrantyIn, user=Depends(require_manager_warranty)):
    role_label = "admin" if user.get("role") == "admin" else "manager"
    return await _assign_warranty(body, actor=user, role_label=role_label)


# ---- Points (manager-with-points perm) ----
@router.post("/points/adjust")
async def manager_adjust_points(body: PointsAdjustIn, user=Depends(require_manager_points)):
    target = await db.users.find_one({"id": body.user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    new_balance = await loyalty.adjust_points(
        body.user_id, body.delta, body.reason or f"Adjusted by manager {user.get('name','')}",
        ref={"adjusted_by": user["id"], "by_role": user.get("role", "manager")},
    )
    # Notify the user of the adjustment
    try:
        await notifications.notify_user(
            body.user_id,
            title=f"Reward Points {'credited' if body.delta >= 0 else 'debited'}",
            body=f"{abs(body.delta)} pts {'added to' if body.delta >= 0 else 'deducted from'} your account. "
                 f"Reason: {body.reason or 'manual adjustment'}. New balance: {new_balance} pts.",
            ntype="points_adjust",
            ref_type="user",
            ref_id=body.user_id,
            sms_phone=target.get("phone"),
            sms_message=(
                f"HANSA: {abs(body.delta)} reward pts {'credited' if body.delta >= 0 else 'debited'}. "
                f"New balance: {new_balance} pts (Rs.{new_balance})."
            ) if target.get("phone") else None,
        )
    except Exception:
        pass
    return {"ok": True, "new_balance": new_balance}

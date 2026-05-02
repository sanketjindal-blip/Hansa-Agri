"""Dealer-facing routes (also reused by managers with `warranty` permission)."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.security import require_dealer, get_current_user
from dealers_data import DEALERS
from models.schemas import (
    MultiAssignWarrantyIn, LeadStatusIn, ServiceUpdateIn,
)
from services.warranty import assign_warranty as _assign_warranty
from services import loyalty, notifications
from sms import send_sms

router = APIRouter(tags=["dealers"])

VALID_SR_STATUS = ("open", "in_progress", "resolved", "closed", "cancelled")


def _is_dealer_or_admin(user: dict) -> bool:
    return user.get("role") in ("dealer", "admin")


@router.get("/dealers")
async def list_dealers():
    items = await db.dealers.find({}, {"_id": 0}).to_list(500)
    if not items:
        return DEALERS
    return items


@router.get("/dealer/me")
async def dealer_me(user=Depends(require_dealer)):
    dealer = None
    if user.get("dealer_id"):
        dealer = await db.dealers.find_one({"id": user["dealer_id"]}, {"_id": 0})
    return {"user": user, "dealer": dealer}


@router.get("/dealer/orders")
async def dealer_orders(user=Depends(require_dealer)):
    filt = {"assigned_by_dealer": user["id"]} if user.get("role") == "dealer" else {}
    items = await db.orders.find(filt, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@router.post("/dealer/assign-warranty")
async def dealer_assign_warranty(body: MultiAssignWarrantyIn, user=Depends(require_dealer)):
    """Assign warranty. Allowed for dealer / admin / manager-with-warranty.
    The role label written on the order reflects the actor: 'admin' for admins,
    'manager' when a manager-with-warranty fires it, otherwise 'dealer'."""
    role = user.get("role")
    if role == "admin":
        role_label = "admin"
    elif role == "manager":
        role_label = "manager"
    else:
        role_label = "dealer"
    return await _assign_warranty(body, actor=user, role_label=role_label)


# ---- Dealer Inbox: assigned Leads + Service Requests ----
def _dealer_filter(user: dict) -> dict:
    if user.get("role") == "admin":
        return {}
    return {"assigned_dealer_user_ids": user["id"]}


@router.get("/dealer/leads")
async def dealer_leads(status: str | None = None, user=Depends(require_dealer)):
    q = _dealer_filter(user)
    if status:
        q = {**q, "status": status}
    return await db.leads.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.patch("/dealer/leads/{lead_id}")
async def dealer_update_lead(lead_id: str, body: LeadStatusIn, user=Depends(require_dealer)):
    """Dealers (and admins) can update assigned leads. Status changes follow
    the standard payout rules in `loyalty.update_lead_status` — purchasing a
    referral lead via dealer also credits the referrer's points."""
    if user.get("role") == "dealer":
        lead = await db.leads.find_one({"id": lead_id, "assigned_dealer_user_ids": user["id"]}, {"_id": 0})
        if not lead:
            raise HTTPException(status_code=404, detail="Lead not assigned to you")
    try:
        return await loyalty.update_lead_status(
            lead_id, body.status, body.remark or body.notes or "", user,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/dealer/service-requests")
async def dealer_service_requests(status: str | None = None, user=Depends(require_dealer)):
    q = _dealer_filter(user)
    if status:
        q = {**q, "status": status}
    return await db.service_requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.patch("/dealer/service-requests/{sr_id}")
async def dealer_update_sr(sr_id: str, body: ServiceUpdateIn, user=Depends(require_dealer)):
    if body.status not in VALID_SR_STATUS:
        raise HTTPException(status_code=400, detail=f"status must be one of {VALID_SR_STATUS}")
    if user.get("role") == "dealer":
        sr = await db.service_requests.find_one(
            {"id": sr_id, "assigned_dealer_user_ids": user["id"]}, {"_id": 0}
        )
    else:
        sr = await db.service_requests.find_one({"id": sr_id}, {"_id": 0})
    if not sr:
        raise HTTPException(status_code=404, detail="Service request not assigned to you")
    now = datetime.now(timezone.utc).isoformat()
    remark = body.remark or body.note or ""
    timeline_entry = {
        "at": now, "by": user["id"], "by_name": user.get("name") or "",
        "role": user.get("role", "dealer"),
        "action": f"status: {sr.get('status')} \u2192 {body.status}",
        "remark": remark,
    }
    update = {
        "status": body.status,
        "updated_at": now,
        "last_dealer_id": user["id"],
    }
    if body.resolution:
        update["resolution"] = body.resolution
    await db.service_requests.update_one(
        {"id": sr_id},
        {"$set": update, "$push": {"timeline": timeline_entry}},
    )
    updated = await db.service_requests.find_one({"id": sr_id}, {"_id": 0})
    # Notify customer (in-app + SMS) of status change
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


@router.get("/settings/company")
async def get_company():
    s = await db.settings.find_one({"id": "company"}, {"_id": 0})
    return s or {}

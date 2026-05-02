"""Lead referral & loyalty points service.

Rules:
- 1 point = INR 1.
- A user submits a lead (name + phone mandatory).
- Admin marks lead status: new -> contacted -> purchased | lost.
- When admin marks status=purchased the referrer is auto-credited 500 points.
- Points can be redeemed at checkout. Admin can manually adjust points.
"""
import uuid
from datetime import datetime, timezone

from core.db import db
from core.helpers import normalize_phone
from sms import send_sms

LEAD_REWARD_POINTS = 500

LEAD_STATUSES = ("new", "contacted", "purchased", "lost")


async def get_user_points(user_id: str) -> int:
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "points": 1})
    if not u:
        return 0
    return int(u.get("points") or 0)


async def adjust_points(user_id: str, delta: int, reason: str, ref: dict | None = None) -> int:
    """Atomically change a user's points balance & write an audit row."""
    if not delta:
        return await get_user_points(user_id)
    res = await db.users.find_one_and_update(
        {"id": user_id},
        {"$inc": {"points": delta}},
        return_document=True,
        projection={"_id": 0, "points": 1, "phone": 1, "name": 1},
    )
    if not res:
        raise ValueError("User not found")
    new_balance = int(res.get("points") or 0)
    txn = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "delta": int(delta),
        "balance_after": new_balance,
        "reason": reason,
        "ref": ref or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.points_transactions.insert_one(txn)
    return new_balance


async def list_user_transactions(user_id: str, limit: int = 50):
    items = await db.points_transactions.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    return items


async def create_lead(referrer: dict, name: str, phone: str,
                     equipment_interest: str = "", notes: str = "") -> dict:
    p = normalize_phone(phone)
    if not p or len(p) < 12:
        raise ValueError("Invalid phone number")
    if not name or not name.strip():
        raise ValueError("Name is required")
    lead = {
        "id": str(uuid.uuid4()),
        "referrer_user_id": referrer["id"],
        "referrer_name": referrer.get("name", ""),
        "referrer_phone": referrer.get("phone", ""),
        "name": name.strip(),
        "phone": p,
        "equipment_interest": (equipment_interest or "").strip(),
        "notes": (notes or "").strip(),
        "status": "new",
        "points_awarded": 0,
        "timeline": [{
            "at": datetime.now(timezone.utc).isoformat(),
            "by": referrer.get("id", ""),
            "role": referrer.get("role", "customer"),
            "action": "created",
            "remark": (notes or "").strip() or "Lead submitted",
        }],
        "assigned_manager_ids": [],
        "assigned_dealer_user_ids": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.leads.insert_one(lead)
    lead.pop("_id", None)
    try:
        send_sms(
            referrer.get("phone", ""),
            f"HANSA: Thanks for the lead - {name} ({p}). "
            "You'll earn 500 points (Rs.500 off) when they purchase.",
        )
    except Exception:
        pass
    return lead


async def update_lead_status(lead_id: str, new_status: str, remark: str,
                             actor: dict) -> dict:
    if new_status not in LEAD_STATUSES:
        raise ValueError(f"Invalid status. Must be one of {LEAD_STATUSES}")
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise ValueError("Lead not found")
    prev_status = lead.get("status")
    now = datetime.now(timezone.utc).isoformat()
    update = {
        "status": new_status,
        "updated_at": now,
        "updated_by": actor["id"],
    }
    if remark:
        existing_notes = lead.get("notes") or ""
        actor_role = actor.get("role", "user")
        update["notes"] = f"{existing_notes}\n[{actor_role}] {remark}".strip()
    timeline_entry = {
        "at": now,
        "by": actor["id"],
        "by_name": actor.get("name") or "",
        "role": actor.get("role", "user"),
        "action": f"status: {prev_status} \u2192 {new_status}",
        "remark": remark or "",
    }
    # Award points exactly once when transitioning into 'purchased'.
    # Skip the payout for admin-created leads (no referrer_user_id) — they're
    # tracked for sales pipeline only, not the referral programme.
    if (new_status == "purchased"
            and prev_status != "purchased"
            and not lead.get("points_awarded")
            and lead.get("referrer_user_id")):
        new_balance = await adjust_points(
            lead["referrer_user_id"],
            LEAD_REWARD_POINTS,
            f"Lead converted: {lead['name']} ({lead['phone']})",
            ref={"lead_id": lead_id},
        )
        update["points_awarded"] = LEAD_REWARD_POINTS
        update["awarded_at"] = now
        try:
            send_sms(
                lead.get("referrer_phone", ""),
                f"HANSA: Congrats! {LEAD_REWARD_POINTS} reward points credited "
                f"for the lead '{lead['name']}' purchase. Balance: {new_balance} pts "
                "(Rs.{0}). Redeem on next purchase.".format(new_balance),
            )
        except Exception:
            pass
    await db.leads.update_one(
        {"id": lead_id},
        {"$set": update, "$push": {"timeline": timeline_entry}},
    )
    return await db.leads.find_one({"id": lead_id}, {"_id": 0})


async def add_lead_remark(lead_id: str, remark: str, actor: dict) -> dict:
    """Append a remark to a lead's timeline without changing status."""
    if not remark or not remark.strip():
        raise ValueError("Remark is required")
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise ValueError("Lead not found")
    now = datetime.now(timezone.utc).isoformat()
    entry = {
        "at": now, "by": actor["id"], "by_name": actor.get("name") or "",
        "role": actor.get("role", "user"), "action": "remark",
        "remark": remark.strip(),
    }
    await db.leads.update_one(
        {"id": lead_id},
        {"$set": {"updated_at": now}, "$push": {"timeline": entry}},
    )
    return await db.leads.find_one({"id": lead_id}, {"_id": 0})


async def list_leads_for_user(user_id: str):
    items = await db.leads.find(
        {"referrer_user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return items


async def list_all_leads(status: str | None = None):
    q = {}
    if status:
        q["status"] = status
    items = await db.leads.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

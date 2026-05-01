"""In-app notification service.

Stores notifications in the `notifications` collection. Each notification is
addressed to a single user_id. Optionally fires an SMS via Twilio at the same
time (controlled by the caller).

Schema:
  id: str (uuid)
  user_id: str
  title: str (short headline)
  body: str
  type: str (e.g. service_assigned, lead_assigned, lead_purchased, system)
  ref_type: str (e.g. service_request, lead) - what entity to deep-link to
  ref_id: str
  read: bool
  created_at: ISO datetime
"""
import uuid
from datetime import datetime, timezone
from typing import Iterable, Optional

from core.db import db
from sms import send_sms


async def notify_user(
    user_id: str,
    title: str,
    body: str,
    *,
    ntype: str = "system",
    ref_type: str = "",
    ref_id: str = "",
    sms_phone: Optional[str] = None,
    sms_message: Optional[str] = None,
) -> dict:
    """Create one in-app notification, optionally also fire an SMS.

    Returns the created notification dict. Failures in SMS are silently swallowed.
    """
    n = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "body": body,
        "type": ntype,
        "ref_type": ref_type,
        "ref_id": ref_id,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.notifications.insert_one(n)
    n.pop("_id", None)
    if sms_phone and sms_message:
        try:
            send_sms(sms_phone, sms_message)
        except Exception:
            pass
    return n


async def notify_users(
    user_ids: Iterable[str],
    title: str,
    body: str,
    *,
    ntype: str = "system",
    ref_type: str = "",
    ref_id: str = "",
    sms: bool = False,
    sms_message: Optional[str] = None,
) -> int:
    """Create notifications for a list of users and (optionally) SMS each.

    For SMS, looks up the phone of each target. Returns number of notifications created.
    """
    count = 0
    for uid in user_ids:
        if not uid:
            continue
        phone = None
        if sms:
            u = await db.users.find_one({"id": uid}, {"_id": 0, "phone": 1})
            phone = u.get("phone") if u else None
        await notify_user(
            uid, title, body,
            ntype=ntype, ref_type=ref_type, ref_id=ref_id,
            sms_phone=phone if sms else None,
            sms_message=sms_message if sms else None,
        )
        count += 1
    return count


async def list_for_user(user_id: str, limit: int = 50, unread_only: bool = False):
    q = {"user_id": user_id}
    if unread_only:
        q["read"] = False
    items = await db.notifications.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return items


async def unread_count(user_id: str) -> int:
    return await db.notifications.count_documents({"user_id": user_id, "read": False})


async def mark_read(user_id: str, ids: list[str] | None = None, all_unread: bool = False) -> int:
    q: dict = {"user_id": user_id, "read": False}
    if not all_unread:
        if not ids:
            return 0
        q["id"] = {"$in": ids}
    res = await db.notifications.update_many(q, {"$set": {"read": True}})
    return int(res.modified_count or 0)

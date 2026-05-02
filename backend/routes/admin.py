"""Admin console routes."""
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.helpers import normalize_phone
from core.security import require_admin, hash_password
from models.schemas import (
    AdminProductIn, AdminNewsIn, AdminOfferIn, DealerIn, CompanyIn,
    DealerLoginIn, LeadStatusIn, PointsAdjustIn, CategoryIn,
    CategoryReorderIn, MultiAssignWarrantyIn, ManagerPromoteIn, ManagerPermsIn,
    AssignManagersIn, AdminLeadIn, AssignDealersIn,
)
from services.warranty import assign_warranty as _assign_warranty
from services import loyalty, notifications
from sms import send_sms

router = APIRouter(prefix="/admin", tags=["admin"])


# ---- Products ----
@router.post("/products")
async def create_product(body: AdminProductIn, user=Depends(require_admin)):
    p = body.dict()
    p["id"] = str(uuid.uuid4())
    p["mrp"] = round(p["price"] * 1.15)
    p["images"] = [p["image"]]
    p["in_stock"] = True
    p["rating"] = 4.5
    await db.products.insert_one(p)
    p.pop("_id", None)
    return p


@router.delete("/products/{product_id}")
async def delete_product(product_id: str, user=Depends(require_admin)):
    res = await db.products.delete_one({"id": product_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"deleted": True}


@router.patch("/products/{product_id}")
async def update_product(product_id: str, body: AdminProductIn, user=Depends(require_admin)):
    update = body.dict()
    update["mrp"] = round(update["price"] * 1.15)
    update["images"] = [update["image"]]
    res = await db.products.update_one({"id": product_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    return p


# ---- Product Reorder (drag-to-reorder) ----
@router.post("/products/reorder")
async def reorder_products(body: dict, user=Depends(require_admin)):
    ordered_ids = body.get("ordered_ids") or []
    for idx, pid in enumerate(ordered_ids):
        await db.products.update_one(
            {"id": pid}, {"$set": {"sort_order": (idx + 1) * 10}},
        )
    items = await db.products.find({}, {"_id": 0}).sort([("sort_order", 1), ("created_at", -1)]).to_list(500)
    return items


# ---- Inventory Dashboard ----
@router.get("/inventory/summary")
async def inventory_summary(user=Depends(require_admin)):
    """Aggregated inventory metrics. Counts products per configured category,
    plus 'Uncategorised' bucket for products whose category-string doesn't
    match any registered category."""
    total_products = await db.products.count_documents({})
    total_active_categories = await db.categories.count_documents({"active": {"$ne": False}})
    featured_count = await db.products.count_documents({"featured": True})
    in_stock_count = await db.products.count_documents({"in_stock": True})
    out_stock_count = await db.products.count_documents({"in_stock": False})

    cats = await db.categories.find({}, {"_id": 0}).sort("sort_order", 1).to_list(200)
    # Categories have shape `{key, label, icon, ...}`. Products store the
    # category KEY (e.g. "Tiller") in their `category` field.
    cat_keys = {c.get("key") for c in cats if c.get("key")}
    by_category: list[dict] = []
    total_value = 0.0
    for c in cats:
        key = c.get("key", "")
        label = c.get("label") or key
        prods = await db.products.find(
            {"category": key}, {"_id": 0, "price": 1, "in_stock": 1, "id": 1},
        ).to_list(500)
        cnt = len(prods)
        sum_price = float(sum(p.get("price", 0) for p in prods))
        avg_price = sum_price / cnt if cnt else 0.0
        in_stock_n = sum(1 for p in prods if p.get("in_stock", True))
        by_category.append({
            "id": c.get("id"),
            "name": label,
            "key": key,
            "icon": c.get("icon", "cube-outline"),
            "active": c.get("active", True),
            "products_count": cnt,
            "in_stock_count": in_stock_n,
            "out_of_stock_count": cnt - in_stock_n,
            "avg_price": round(avg_price, 2),
            "total_value": round(sum_price, 2),
        })
        total_value += sum_price

    # Uncategorised bucket (products whose category isn't in cat_keys)
    other_prods = await db.products.find(
        {}, {"_id": 0, "category": 1, "price": 1, "in_stock": 1},
    ).to_list(500)
    uncategorised = [p for p in other_prods if p.get("category") not in cat_keys]
    if uncategorised:
        u_sum = float(sum(p.get("price", 0) for p in uncategorised))
        u_in = sum(1 for p in uncategorised if p.get("in_stock", True))
        by_category.append({
            "id": "_uncategorised",
            "name": "Uncategorised",
            "icon": "help-circle-outline",
            "active": True,
            "products_count": len(uncategorised),
            "in_stock_count": u_in,
            "out_of_stock_count": len(uncategorised) - u_in,
            "avg_price": round(u_sum / len(uncategorised), 2) if uncategorised else 0,
            "total_value": round(u_sum, 2),
        })
        total_value += u_sum

    recent = await db.products.find({}, {"_id": 0}).sort([("created_at", -1)]).to_list(8)
    top_priced = await db.products.find({}, {"_id": 0}).sort([("price", -1)]).to_list(5)
    out_of_stock = await db.products.find({"in_stock": False}, {"_id": 0}).to_list(20)

    return {
        "totals": {
            "products": total_products,
            "categories": total_active_categories,
            "featured": featured_count,
            "in_stock": in_stock_count,
            "out_of_stock": out_stock_count,
            "total_value_inr": round(total_value, 2),
        },
        "by_category": by_category,
        "recent_products": recent,
        "top_priced": top_priced,
        "out_of_stock": out_of_stock,
    }


# ---- News & Offers ----
@router.post("/news")
async def create_news(body: AdminNewsIn, user=Depends(require_admin)):
    n = body.dict()
    n["id"] = str(uuid.uuid4())
    n["published_at"] = datetime.now(timezone.utc).isoformat()
    await db.news.insert_one(n)
    n.pop("_id", None)
    return n


@router.post("/offers")
async def create_offer(body: AdminOfferIn, user=Depends(require_admin)):
    o = body.dict()
    o["id"] = str(uuid.uuid4())
    o["code"] = o["code"].upper().strip()
    await db.offers.insert_one(o)
    o.pop("_id", None)
    return o


# ---- Dealers ----
@router.post("/dealers")
async def create_dealer(body: DealerIn, user=Depends(require_admin)):
    d = body.dict()
    d["id"] = "d" + uuid.uuid4().hex[:8]
    await db.dealers.insert_one(d)
    d.pop("_id", None)
    return d


@router.patch("/dealers/{dealer_id}")
async def update_dealer(dealer_id: str, body: DealerIn, user=Depends(require_admin)):
    res = await db.dealers.update_one({"id": dealer_id}, {"$set": body.dict()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Dealer not found")
    return await db.dealers.find_one({"id": dealer_id}, {"_id": 0})


@router.delete("/dealers/{dealer_id}")
async def delete_dealer(dealer_id: str, user=Depends(require_admin)):
    res = await db.dealers.delete_one({"id": dealer_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Dealer not found")
    return {"deleted": True}


# ---- Company settings ----
@router.patch("/settings/company")
async def update_company(body: CompanyIn, user=Depends(require_admin)):
    data = body.dict()
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.settings.update_one({"id": "company"}, {"$set": data}, upsert=True)
    return await db.settings.find_one({"id": "company"}, {"_id": 0})


# ---- Dealer promotion / warranty assignment ----
@router.post("/promote-dealer")
async def promote_dealer(body: DealerLoginIn, user=Depends(require_admin)):
    phone = normalize_phone(body.phone)
    dealer = await db.dealers.find_one({"id": body.dealer_id}, {"_id": 0})
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")
    target = await db.users.find_one({"phone": phone})
    if not target:
        target = {
            "id": str(uuid.uuid4()),
            "email": f"{phone.lstrip('+')}@phone.hansa",
            "name": dealer["name"],
            "phone": phone,
            "role": "dealer",
            "dealer_id": body.dealer_id,
            "password_hash": hash_password(uuid.uuid4().hex),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(target)
    else:
        await db.users.update_one(
            {"id": target["id"]},
            {"$set": {"role": "dealer", "dealer_id": body.dealer_id}},
        )
    try:
        send_sms(
            phone,
            f"HANSA: You are now registered as a dealer ({dealer['name']}). "
            "Login to the HANSA app with this number to manage customer warranties.",
        )
    except Exception:
        pass
    return {"promoted": True, "phone": phone, "dealer_id": body.dealer_id}


@router.post("/assign-warranty")
async def admin_assign_warranty(body: MultiAssignWarrantyIn, user=Depends(require_admin)):
    return await _assign_warranty(body, actor=user, role_label="admin")


@router.post("/warranty-reminders")
async def warranty_reminders(user=Depends(require_admin)):
    """Send SMS to all users whose warranty expires within 45 days."""
    orders = await db.orders.find({}, {"_id": 0}).to_list(1000)
    sent = 0
    now = datetime.now(timezone.utc)
    for o in orders:
        purchase = datetime.fromisoformat(o["purchase_date"])
        for item in o["items"]:
            wm = int(item.get("warranty_months", 12))
            expiry = purchase + timedelta(days=wm * 30)
            days_left = (expiry - now).days
            if 0 < days_left <= 45:
                phone = o.get("shipping", {}).get("phone", "")
                if phone:
                    msg = (
                        f"HANSA: Your warranty for {item['name']} expires in {days_left} days. "
                        "Extend or raise service via the app."
                    )
                    r = send_sms(phone, msg)
                    if r.get("ok"):
                        sent += 1
    return {"sent": sent}


@router.get("/stats")
async def stats(user=Depends(require_admin)):
    return {
        "users": await db.users.count_documents({}),
        "products": await db.products.count_documents({}),
        "orders": await db.orders.count_documents({}),
        "support_tickets": await db.support_tickets.count_documents({}),
        "open_tickets": await db.support_tickets.count_documents({"status": "open"}),
        "leads": await db.leads.count_documents({}),
        "leads_new": await db.leads.count_documents({"status": "new"}),
        "leads_purchased": await db.leads.count_documents({"status": "purchased"}),
    }


# ---- Leads (admin) ----
@router.get("/leads")
async def list_leads(status: str | None = None, user=Depends(require_admin)):
    return await loyalty.list_all_leads(status=status)


@router.patch("/leads/{lead_id}")
async def update_lead(lead_id: str, body: LeadStatusIn, user=Depends(require_admin)):
    try:
        return await loyalty.update_lead_status(lead_id, body.status, body.remark or body.notes or "", user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---- Admin-created Lead (from a phone call / walk-in) ----
async def _resolve_managers(body: AssignManagersIn | AdminLeadIn, perm: str) -> list[str]:
    """Resolve target manager_ids based on `all_managers` flag and user perm."""
    if getattr(body, "all_managers", False):
        cursor = db.users.find(
            {"role": "manager", f"manager_perms.{perm}": True},
            {"_id": 0, "id": 1},
        )
        items = await cursor.to_list(500)
        return [u["id"] for u in items]
    return [mid for mid in (body.manager_ids or []) if mid]


@router.post("/leads")
async def create_admin_lead(body: AdminLeadIn, user=Depends(require_admin)):
    """Admin manually adds a lead received via phone call / walk-in. Optionally
    assigns to specific managers (or all managers with leads permission)."""
    try:
        # `referrer` is the admin themselves; this lead is not eligible for the
        # 500-pt referral payout (since the admin isn't the referrer).
        lead = await loyalty.create_lead(
            user, body.name, body.phone,
            body.equipment_interest or "", body.notes or "",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    # Tag source + clear referral-payout eligibility (admin-source leads should
    # not auto-credit any user when marked purchased).
    target_mgr_ids = await _resolve_managers(body, "leads")
    await db.leads.update_one(
        {"id": lead["id"]},
        {"$set": {
            "source": body.source or "call",
            "admin_created": True,
            "referrer_user_id": "",  # disable auto-referral payout
            "assigned_manager_ids": target_mgr_ids,
        }},
    )
    # Notify each target manager (in-app + SMS)
    if target_mgr_ids:
        sms_text = (
            f"HANSA: New lead assigned to you. {lead['name']} ({lead['phone']})"
            + (f" - {lead['equipment_interest']}" if lead.get("equipment_interest") else "")
        )
        await notifications.notify_users(
            target_mgr_ids,
            title="New lead assigned",
            body=f"{lead['name']} - {lead['phone']}" + (f" - interested in {lead['equipment_interest']}" if lead.get("equipment_interest") else ""),
            ntype="lead_assigned",
            ref_type="lead",
            ref_id=lead["id"],
            sms=True,
            sms_message=sms_text,
        )
    return await db.leads.find_one({"id": lead["id"]}, {"_id": 0})


@router.post("/leads/{lead_id}/assign")
async def assign_lead(lead_id: str, body: AssignManagersIn, user=Depends(require_admin)):
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    target_mgr_ids = await _resolve_managers(body, "leads")
    await db.leads.update_one(
        {"id": lead_id},
        {"$set": {"assigned_manager_ids": target_mgr_ids}},
    )
    if target_mgr_ids:
        sms_text = (
            f"HANSA: Lead assigned to you. {lead['name']} ({lead['phone']})."
            + (f" Note: {body.note}" if body.note else "")
        )
        await notifications.notify_users(
            target_mgr_ids,
            title="Lead assigned to you",
            body=f"{lead['name']} - {lead['phone']}" + (f" - {body.note}" if body.note else ""),
            ntype="lead_assigned",
            ref_type="lead",
            ref_id=lead_id,
            sms=True,
            sms_message=sms_text,
        )
    return await db.leads.find_one({"id": lead_id}, {"_id": 0})


# ---- Admin Service Requests ----
@router.get("/service-requests")
async def admin_list_service_requests(status: str | None = None, user=Depends(require_admin)):
    q: dict = {}
    if status:
        q["status"] = status
    items = await db.service_requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@router.post("/service-requests/{sr_id}/assign")
async def assign_service_request(sr_id: str, body: AssignManagersIn, user=Depends(require_admin)):
    sr = await db.service_requests.find_one({"id": sr_id}, {"_id": 0})
    if not sr:
        raise HTTPException(status_code=404, detail="Service request not found")
    target_mgr_ids = await _resolve_managers(body, "service")
    timeline_entry = {
        "at": datetime.now(timezone.utc).isoformat(),
        "by": user["id"],
        "role": "admin",
        "action": "assigned" + (" to all" if body.all_managers else f" to {len(target_mgr_ids)} mgr"),
        "note": body.note or "",
    }
    await db.service_requests.update_one(
        {"id": sr_id},
        {"$set": {"assigned_manager_ids": target_mgr_ids,
                  "updated_at": datetime.now(timezone.utc).isoformat()},
         "$push": {"timeline": timeline_entry}},
    )
    if target_mgr_ids:
        sms_text = (
            f"HANSA: Service ticket assigned. {sr.get('title') or 'Service Request'} - "
            f"{sr.get('customer_name') or sr.get('customer_phone', '')}"
            + (f". Note: {body.note}" if body.note else "")
        )
        await notifications.notify_users(
            target_mgr_ids,
            title="Service ticket assigned to you",
            body=f"{sr.get('title') or 'Service Request'} - {sr.get('customer_name') or ''} ({sr.get('customer_phone', '')})"
                 + (f" - {body.note}" if body.note else ""),
            ntype="service_assigned",
            ref_type="service_request",
            ref_id=sr_id,
            sms=True,
            sms_message=sms_text,
        )
    return await db.service_requests.find_one({"id": sr_id}, {"_id": 0})


# ---- Dealer Assignment (leads + service requests) ----
async def _resolve_dealers(body: AssignDealersIn) -> list[str]:
    if body.all_dealers:
        cursor = db.users.find({"role": "dealer"}, {"_id": 0, "id": 1})
        items = await cursor.to_list(500)
        return [u["id"] for u in items]
    return [d for d in (body.dealer_user_ids or []) if d]


@router.get("/dealer-users")
async def list_dealer_users(user=Depends(require_admin)):
    """Returns users with role=dealer (so admin can pick them in the
    Assign-to-Dealers UI). Joined with dealer profile for name/region."""
    items = await db.users.find(
        {"role": "dealer"}, {"_id": 0, "password_hash": 0}
    ).to_list(500)
    # Hydrate dealer profile for friendly display
    for u in items:
        if u.get("dealer_id"):
            d = await db.dealers.find_one({"id": u["dealer_id"]}, {"_id": 0})
            if d:
                u["dealer_profile"] = {"name": d.get("name"), "city": d.get("city")}
    return items


@router.post("/leads/{lead_id}/assign-dealers")
async def assign_lead_dealers(lead_id: str, body: AssignDealersIn, user=Depends(require_admin)):
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    target_ids = await _resolve_dealers(body)
    timeline_entry = {
        "at": datetime.now(timezone.utc).isoformat(),
        "by": user["id"], "by_name": user.get("name") or "",
        "role": "admin",
        "action": "assigned_to_dealers" + (" (all)" if body.all_dealers else f" ({len(target_ids)})"),
        "remark": body.note or "",
    }
    await db.leads.update_one(
        {"id": lead_id},
        {"$set": {"assigned_dealer_user_ids": target_ids,
                  "updated_at": datetime.now(timezone.utc).isoformat()},
         "$push": {"timeline": timeline_entry}},
    )
    if target_ids:
        sms_text = (
            f"HANSA: Lead assigned. {lead['name']} ({lead['phone']})"
            + (f" - interested in {lead.get('equipment_interest','')}" if lead.get('equipment_interest') else "")
            + (f". Note: {body.note}" if body.note else "")
        )
        await notifications.notify_users(
            target_ids,
            title="New lead assigned",
            body=f"{lead['name']} - {lead['phone']}" + (f" - {body.note}" if body.note else ""),
            ntype="lead_assigned",
            ref_type="lead",
            ref_id=lead_id,
            sms=True,
            sms_message=sms_text,
        )
    return await db.leads.find_one({"id": lead_id}, {"_id": 0})


@router.post("/service-requests/{sr_id}/assign-dealers")
async def assign_sr_dealers(sr_id: str, body: AssignDealersIn, user=Depends(require_admin)):
    sr = await db.service_requests.find_one({"id": sr_id}, {"_id": 0})
    if not sr:
        raise HTTPException(status_code=404, detail="Service request not found")
    target_ids = await _resolve_dealers(body)
    timeline_entry = {
        "at": datetime.now(timezone.utc).isoformat(),
        "by": user["id"], "by_name": user.get("name") or "",
        "role": "admin",
        "action": "assigned_to_dealers" + (" (all)" if body.all_dealers else f" ({len(target_ids)})"),
        "remark": body.note or "",
    }
    await db.service_requests.update_one(
        {"id": sr_id},
        {"$set": {"assigned_dealer_user_ids": target_ids,
                  "updated_at": datetime.now(timezone.utc).isoformat()},
         "$push": {"timeline": timeline_entry}},
    )
    if target_ids:
        sms_text = (
            f"HANSA: Service ticket assigned. {sr.get('title') or 'Service Request'} "
            f"- {sr.get('customer_name') or sr.get('customer_phone','')}"
            + (f". Note: {body.note}" if body.note else "")
        )
        await notifications.notify_users(
            target_ids,
            title="Service ticket assigned to you",
            body=f"{sr.get('title') or 'Service Request'} - {sr.get('customer_name') or ''} ({sr.get('customer_phone','')})"
                 + (f" - {body.note}" if body.note else ""),
            ntype="service_assigned",
            ref_type="service_request",
            ref_id=sr_id,
            sms=True,
            sms_message=sms_text,
        )
    return await db.service_requests.find_one({"id": sr_id}, {"_id": 0})


# ---- Users & Points (admin) ----
@router.get("/users")
async def list_users(q: str | None = None, user=Depends(require_admin)):
    query: dict = {}
    if q:
        query = {"$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q}},
            {"email": {"$regex": q, "$options": "i"}},
        ]}
    items = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    return items


@router.post("/points/adjust")
async def adjust_points(body: PointsAdjustIn, user=Depends(require_admin)):
    try:
        new_balance = await loyalty.adjust_points(
            body.user_id, body.delta,
            f"[admin {user.get('name', '')}] {body.reason}",
            ref={"admin_id": user["id"]},
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    target = await db.users.find_one({"id": body.user_id}, {"_id": 0, "phone": 1, "name": 1})
    try:
        if target and target.get("phone"):
            verb = "credited" if body.delta > 0 else "debited"
            send_sms(
                target["phone"],
                f"HANSA: {abs(body.delta)} reward points {verb}. "
                f"Balance: {new_balance} pts (Rs.{new_balance}). Reason: {body.reason}",
            )
    except Exception:
        pass
    return {"user_id": body.user_id, "delta": body.delta, "balance": new_balance}


# ---- Categories (admin) ----
@router.get("/categories")
async def list_admin_categories(user=Depends(require_admin)):
    items = await db.categories.find({}, {"_id": 0}).sort("sort_order", 1).to_list(200)
    return items


@router.post("/categories")
async def create_category(body: CategoryIn, user=Depends(require_admin)):
    key = body.key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="key is required")
    if await db.categories.find_one({"key": key}):
        raise HTTPException(status_code=400, detail="Category key already exists")
    doc = body.dict()
    doc["id"] = str(uuid.uuid4())
    doc["key"] = key
    await db.categories.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/categories/{cat_id}")
async def update_category(cat_id: str, body: CategoryIn, user=Depends(require_admin)):
    existing = await db.categories.find_one({"id": cat_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Category not found")
    update = body.dict()
    new_key = update["key"].strip()
    update["key"] = new_key
    # If admin renamed the key, sync products that referenced the old key.
    if existing["key"] != new_key:
        await db.products.update_many(
            {"category": existing["key"]}, {"$set": {"category": new_key}}
        )
    await db.categories.update_one({"id": cat_id}, {"$set": update})
    return await db.categories.find_one({"id": cat_id}, {"_id": 0})


@router.post("/categories/reorder")
async def reorder_categories(body: CategoryReorderIn, user=Depends(require_admin)):
    """Persist category order. Sort_order is set to (index+1)*10."""
    if not body.ids:
        raise HTTPException(status_code=400, detail="ids is required")
    for idx, cid in enumerate(body.ids):
        await db.categories.update_one(
            {"id": cid}, {"$set": {"sort_order": (idx + 1) * 10}}
        )
    items = await db.categories.find({}, {"_id": 0}).sort("sort_order", 1).to_list(200)
    return items


@router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, user=Depends(require_admin)):
    res = await db.categories.delete_one({"id": cat_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"deleted": True}


# ---- Managers ----
@router.get("/managers")
async def list_managers(user=Depends(require_admin)):
    items = await db.users.find(
        {"role": "manager"}, {"_id": 0, "password_hash": 0}
    ).sort("created_at", -1).to_list(500)
    return items


@router.post("/managers")
async def promote_manager(body: ManagerPromoteIn, user=Depends(require_admin)):
    from core.helpers import normalize_phone
    from core.security import hash_password
    phone = normalize_phone(body.phone)
    if not phone or len(phone) < 12:
        raise HTTPException(status_code=400, detail="Invalid phone")
    perms = {
        "leads": bool(body.perms_leads),
        "service": bool(body.perms_service),
        "warranty": bool(body.perms_warranty),
        "points": bool(body.perms_points),
    }
    if not any(perms.values()):
        raise HTTPException(status_code=400, detail="At least one permission must be enabled")
    existing = await db.users.find_one({"phone": phone})
    if existing:
        await db.users.update_one(
            {"id": existing["id"]},
            {"$set": {"role": "manager", "manager_perms": perms,
                      "name": body.name or existing.get("name") or f"Manager {phone[-4:]}"}},
        )
    else:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": f"{phone.lstrip('+')}@phone.hansa",
            "name": body.name or f"Manager {phone[-4:]}",
            "phone": phone,
            "role": "manager",
            "manager_perms": perms,
            "points": 0,
            "password_hash": hash_password(uuid.uuid4().hex),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    try:
        from sms import send_sms
        roles = [k.title() for k, v in perms.items() if v]
        send_sms(
            phone,
            f"HANSA: You are now a manager. Modules: {', '.join(roles)}. "
            "Login to the app with this number to access your dashboard.",
        )
    except Exception:
        pass
    target = await db.users.find_one({"phone": phone}, {"_id": 0, "password_hash": 0})
    return target


@router.patch("/managers/{user_id}")
async def update_manager_perms(user_id: str, body: ManagerPermsIn, user=Depends(require_admin)):
    perms = {
        "leads": bool(body.perms_leads),
        "service": bool(body.perms_service),
        "warranty": bool(body.perms_warranty),
        "points": bool(body.perms_points),
    }
    if not any(perms.values()):
        raise HTTPException(status_code=400, detail="At least one permission must be enabled")
    res = await db.users.update_one(
        {"id": user_id, "role": "manager"},
        {"$set": {"manager_perms": perms}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Manager not found")
    return await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})


@router.delete("/managers/{user_id}")
async def demote_manager(user_id: str, user=Depends(require_admin)):
    res = await db.users.update_one(
        {"id": user_id, "role": "manager"},
        {"$set": {"role": "customer"}, "$unset": {"manager_perms": ""}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Manager not found")
    return {"demoted": True}


# ---- Image upload (for product creation) ----
from fastapi import UploadFile, File
from pathlib import Path

UPLOAD_DIR = Path("/app/backend/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".heic"}


@router.post("/upload-image")
async def upload_image(image: UploadFile = File(...), user=Depends(require_admin)):
    ext = Path(image.filename or "").suffix.lower() or ".jpg"
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"Image type {ext} not allowed")
    name = f"{uuid.uuid4().hex}{ext}"
    path = UPLOAD_DIR / name
    size = 0
    with path.open("wb") as out:
        while chunk := await image.read(64 * 1024):
            size += len(chunk)
            if size > MAX_IMAGE_BYTES:
                out.close()
                path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="Image too large (>5 MB)")
            out.write(chunk)
    return {"filename": name, "url": f"/api/uploads/{name}", "size": size}

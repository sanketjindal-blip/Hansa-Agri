"""Admin console routes."""
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.helpers import normalize_phone
from core.security import require_admin, hash_password
from models.schemas import (
    AdminProductIn, AdminNewsIn, AdminOfferIn, DealerIn, CompanyIn,
    AssignWarrantyIn, DealerLoginIn,
)
from services.warranty import assign_warranty as _assign_warranty
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
async def admin_assign_warranty(body: AssignWarrantyIn, user=Depends(require_admin)):
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
    }

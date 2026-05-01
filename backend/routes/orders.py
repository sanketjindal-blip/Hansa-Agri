"""Orders, checkout & warranty routes."""
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends

from core.db import db
from core.security import get_current_user
from models.schemas import CheckoutIn
from sms import send_sms

router = APIRouter(tags=["orders"])


@router.post("/orders/checkout")
async def checkout(body: CheckoutIn, user=Depends(get_current_user)):
    if not body.items:
        raise HTTPException(status_code=400, detail="Cart is empty")
    order_items = []
    subtotal = 0.0
    for it in body.items:
        p = await db.products.find_one({"id": it.product_id}, {"_id": 0})
        if not p:
            raise HTTPException(status_code=404, detail=f"Product {it.product_id} not found")
        line_total = float(p["price"]) * it.quantity
        subtotal += line_total
        order_items.append({
            "product_id": p["id"],
            "name": p["name"],
            "category": p["category"],
            "image": p.get("image"),
            "price": p["price"],
            "quantity": it.quantity,
            "warranty_months": p.get("warranty_months", 12),
            "line_total": line_total,
        })

    discount = 0.0
    promo_applied = None
    if body.promo_code:
        offer = await db.offers.find_one({"code": body.promo_code.upper().strip()}, {"_id": 0})
        if offer:
            discount = round(subtotal * (offer["discount_percent"] / 100.0), 2)
            promo_applied = offer["code"]

    total = max(0.0, subtotal - discount)
    now = datetime.now(timezone.utc)
    order = {
        "id": str(uuid.uuid4()),
        "order_number": "RKAI" + datetime.now().strftime("%y%m%d") + str(uuid.uuid4().int)[:5],
        "user_id": user["id"],
        "items": order_items,
        "subtotal": round(subtotal, 2),
        "discount": discount,
        "promo_code": promo_applied,
        "total": round(total, 2),
        "status": "confirmed",
        "payment_method": body.payment_method,
        "shipping": {
            "full_name": body.full_name, "phone": body.phone, "address": body.address,
            "city": body.city, "state": body.state, "pincode": body.pincode,
        },
        "created_at": now.isoformat(),
        "purchase_date": now.isoformat(),
    }
    await db.orders.insert_one(order)
    order.pop("_id", None)
    try:
        msg = (
            f"HANSA: Order #{order['order_number']} confirmed. "
            f"Total Rs.{int(order['total'])}. Items: {len(order_items)}. "
            f"Track in app. Support: +91 9045 333 332"
        )
        send_sms(body.phone, msg)
    except Exception:
        pass
    return order


@router.get("/orders")
async def my_orders(user=Depends(get_current_user)):
    items = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@router.get("/orders/{order_id}")
async def get_order(order_id: str, user=Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    return o


@router.get("/warranties")
async def my_warranties(user=Depends(get_current_user)):
    """Return a flat list of warranty records derived from user's orders."""
    orders = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).to_list(200)
    warranties = []
    now = datetime.now(timezone.utc)
    for o in orders:
        purchase = datetime.fromisoformat(o["purchase_date"])
        for item in o["items"]:
            wm = int(item.get("warranty_months", 12))
            expiry = purchase + timedelta(days=wm * 30)
            days_total = (expiry - purchase).days
            days_left = max(0, (expiry - now).days)
            warranties.append({
                "id": f"{o['id']}_{item['product_id']}",
                "order_id": o["id"],
                "order_number": o["order_number"],
                "product_id": item["product_id"],
                "product_name": item["name"],
                "category": item["category"],
                "image": item.get("image"),
                "purchase_date": o["purchase_date"],
                "expiry_date": expiry.isoformat(),
                "warranty_months": wm,
                "days_total": days_total,
                "days_left": days_left,
                "percent_remaining": round((days_left / days_total) * 100, 1) if days_total else 0,
                "status": "active" if days_left > 0 else "expired",
            })
    warranties.sort(key=lambda w: w["days_left"], reverse=True)
    return warranties

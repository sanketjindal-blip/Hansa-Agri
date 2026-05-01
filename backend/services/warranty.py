"""Shared warranty assignment service used by admin & dealer routes."""
import uuid
from datetime import datetime, timezone
from fastapi import HTTPException

from core.db import db
from core.helpers import normalize_phone
from core.security import hash_password
from models.schemas import AssignWarrantyIn
from sms import send_sms


async def assign_warranty(body: AssignWarrantyIn, actor: dict, role_label: str):
    phone = normalize_phone(body.phone)
    if not phone:
        raise HTTPException(status_code=400, detail="Invalid phone")
    product = await db.products.find_one({"id": body.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    target = await db.users.find_one({"phone": phone})
    if not target:
        target = {
            "id": str(uuid.uuid4()),
            "email": f"{phone.lstrip('+')}@phone.hansa",
            "name": body.customer_name or f"Farmer {phone[-4:]}",
            "phone": phone,
            "role": "customer",
            "password_hash": hash_password(uuid.uuid4().hex),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(target)
    try:
        purchase_dt = datetime.fromisoformat(body.purchase_date) if body.purchase_date else datetime.now(timezone.utc)
    except Exception:
        purchase_dt = datetime.now(timezone.utc)
    line_total = float(product["price"]) * body.quantity
    bill = body.bill_image_base64
    if bill and len(bill) > 900_000:
        bill = bill[:900_000]
    order = {
        "id": str(uuid.uuid4()),
        "order_number": "RKAI" + purchase_dt.strftime("%y%m%d") + str(uuid.uuid4().int)[:5],
        "user_id": target["id"],
        "items": [{
            "product_id": product["id"], "name": product["name"],
            "category": product["category"], "image": product.get("image"),
            "price": product["price"], "quantity": body.quantity,
            "warranty_months": product.get("warranty_months", 12),
            "line_total": line_total,
        }],
        "subtotal": line_total, "discount": 0.0, "promo_code": None, "total": line_total,
        "status": "delivered", "payment_method": "offline",
        "shipping": {
            "full_name": target["name"], "phone": phone,
            "address": body.address or "", "city": body.city or "",
            "state": body.state or "", "pincode": body.pincode or "",
        },
        "created_at": purchase_dt.isoformat(),
        "purchase_date": purchase_dt.isoformat(),
        "bill_image": bill,
    }
    if role_label == "admin":
        order["assigned_by_admin"] = actor["id"]
    else:
        order["assigned_by_dealer"] = actor["id"]
        order["dealer_id"] = actor.get("dealer_id")
    await db.orders.insert_one(order)
    try:
        wm = int(product.get("warranty_months", 12))
        send_sms(
            phone,
            f"HANSA: Warranty activated for your {product['name']}. "
            f"Valid {wm} months from {purchase_dt.date().isoformat()}. "
            "View in HANSA app. Support: +91 9479 333 332",
        )
    except Exception:
        pass
    order.pop("_id", None)
    return order

"""Shared warranty assignment service used by admin & dealer routes.

Supports either a single product (legacy) or a list of items in one call.
A single warranty 'order' is created with all items and a shared bill image.
"""
import uuid
from datetime import datetime, timezone
from fastapi import HTTPException

from core.db import db
from core.helpers import normalize_phone
from core.security import hash_password
from models.schemas import MultiAssignWarrantyIn
from sms import send_sms


async def assign_warranty(body: MultiAssignWarrantyIn, actor: dict, role_label: str):
    phone = normalize_phone(body.phone)
    if not phone:
        raise HTTPException(status_code=400, detail="Invalid phone")

    # Build the items list. If `items` is empty, fall back to the legacy
    # single-product fields so existing admin flows keep working.
    raw_items = body.items or []
    if not raw_items and body.product_id:
        raw_items = [{"product_id": body.product_id, "quantity": body.quantity or 1}]
    if not raw_items:
        raise HTTPException(status_code=400, detail="At least one product is required")

    # Resolve products & build order line items
    line_items = []
    subtotal = 0.0
    for it in raw_items:
        pid = it.product_id if hasattr(it, "product_id") else it["product_id"]
        qty = it.quantity if hasattr(it, "quantity") else int(it.get("quantity", 1))
        product = await db.products.find_one({"id": pid}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {pid} not found")
        line_total = float(product["price"]) * qty
        subtotal += line_total
        line_items.append({
            "product_id": product["id"],
            "name": product["name"],
            "category": product["category"],
            "image": product.get("image"),
            "price": product["price"],
            "quantity": qty,
            "warranty_months": product.get("warranty_months", 12),
            "line_total": line_total,
        })

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

    bill = body.bill_image_base64
    if bill and len(bill) > 900_000:
        bill = bill[:900_000]

    order = {
        "id": str(uuid.uuid4()),
        "order_number": "RKAI" + purchase_dt.strftime("%y%m%d") + str(uuid.uuid4().int)[:5],
        "user_id": target["id"],
        "items": line_items,
        "subtotal": subtotal,
        "discount": 0.0,
        "promo_code": None,
        "total": subtotal,
        "status": "delivered",
        "payment_method": "offline",
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

    # SMS notification - one message summarising every product activated.
    try:
        product_summary = ", ".join(f"{li['name']} x{li['quantity']}" for li in line_items)
        first_wm = int(line_items[0].get("warranty_months", 12))
        send_sms(
            phone,
            f"HANSA: Warranty activated for {product_summary}. "
            f"Valid {first_wm} months from {purchase_dt.date().isoformat()}. "
            "View in HANSA app. Support: +91 9479 333 332",
        )
    except Exception:
        pass
    order.pop("_id", None)
    return order

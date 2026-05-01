"""Database seed routines, run on startup."""
import uuid
from datetime import datetime, timezone, timedelta

from core.config import ADMIN_EMAIL, ADMIN_PASSWORD
from core.db import db
from core.security import hash_password
from dealers_data import DEALERS
from seed_data import SEED_PRODUCTS, SEED_NEWS, SEED_OFFERS, SEED_CUSTOMER_ORDERS


async def seed_admin():
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": ADMIN_EMAIL,
            "name": "RKAI Admin",
            "phone": "+919045333332",
            "role": "admin",
            "password_hash": hash_password(ADMIN_PASSWORD),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })


# Mobile-OTP-only admin numbers. These are seeded as admins on every startup
# so admins can simply OTP-login without any email/password.
ADMIN_PHONES = ["+919045666666", "+917017509782"]


async def seed_admin_phones():
    """Ensure each ADMIN_PHONES entry exists as a user with role=admin.

    Idempotent: matches by phone OR by synthetic email so we don't lose admins
    after migrations or reboots.
    """
    from pymongo.errors import DuplicateKeyError
    for phone in ADMIN_PHONES:
        synthetic_email = f"{phone.lstrip('+')}@phone.hansa"
        existing = await db.users.find_one({
            "$or": [{"phone": phone}, {"email": synthetic_email}],
        })
        if existing:
            await db.users.update_one(
                {"id": existing["id"]},
                {"$set": {
                    "phone": phone,
                    "email": synthetic_email,
                    "role": "admin",
                    "points": existing.get("points", 0),
                }},
            )
            continue
        try:
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "email": synthetic_email,
                "name": "HANSA Admin",
                "phone": phone,
                "role": "admin",
                "points": 0,
                "password_hash": hash_password(uuid.uuid4().hex),
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        except DuplicateKeyError:
            # email collision (unique index) — find that record & promote it.
            await db.users.update_one(
                {"email": synthetic_email},
                {"$set": {"phone": phone, "role": "admin"}},
            )


async def seed_demo_customer():
    email = "ramesh@farm.com"
    existing = await db.users.find_one({"email": email})
    if not existing:
        uid = str(uuid.uuid4())
        await db.users.insert_one({
            "id": uid,
            "email": email,
            "name": "Ramesh Kumar",
            "phone": "+919876543210",
            "role": "customer",
            "points": 0,
            "password_hash": hash_password("farmer123"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        for order_def in SEED_CUSTOMER_ORDERS:
            items = []
            subtotal = 0.0
            for entry in order_def["items"]:
                p = await db.products.find_one({"id": entry["product_id"]}, {"_id": 0})
                if not p:
                    continue
                line = float(p["price"]) * entry["quantity"]
                subtotal += line
                items.append({
                    "product_id": p["id"], "name": p["name"], "category": p["category"],
                    "image": p.get("image"), "price": p["price"], "quantity": entry["quantity"],
                    "warranty_months": p.get("warranty_months", 12), "line_total": line,
                })
            purchase_date = datetime.now(timezone.utc) - timedelta(days=order_def["days_ago"])
            order = {
                "id": str(uuid.uuid4()),
                "order_number": "RKAI" + purchase_date.strftime("%y%m%d") + str(uuid.uuid4().int)[:5],
                "user_id": uid, "items": items,
                "subtotal": round(subtotal, 2), "discount": 0.0, "promo_code": None,
                "total": round(subtotal, 2),
                "status": "delivered", "payment_method": "cod",
                "shipping": {
                    "full_name": "Ramesh Kumar", "phone": "+919045666666",
                    "address": "Village Arifpur, Kithore Hapur Road",
                    "city": "Hapur", "state": "Uttar Pradesh", "pincode": "201015",
                },
                "created_at": purchase_date.isoformat(),
                "purchase_date": purchase_date.isoformat(),
            }
            await db.orders.insert_one(order)


async def seed_products():
    if await db.products.count_documents({}) == 0:
        await db.products.insert_many([dict(p) for p in SEED_PRODUCTS])


async def seed_news():
    if await db.news.count_documents({}) == 0:
        await db.news.insert_many([dict(n) for n in SEED_NEWS])


async def seed_offers():
    if await db.offers.count_documents({}) == 0:
        await db.offers.insert_many([dict(o) for o in SEED_OFFERS])


async def seed_dealers():
    if await db.dealers.count_documents({}) == 0:
        await db.dealers.insert_many([dict(d) for d in DEALERS])


async def seed_settings():
    existing = await db.settings.find_one({"id": "company"})
    if not existing:
        await db.settings.insert_one({
            "id": "company",
            "name": "Ramkishan Agri Innovate Pvt Ltd",
            "tagline": "OUR CULTURE IS AGRICULTURE",
            "address": "Plot No. 26, Harsh Commercial Park, Garh Road, Meerut-250002",
            "phone": "+919479333332",
            "phone_2": "+919045333332",
            "whatsapp": "+919479333332",
            "email": "support@agriequipments.com",
            "website": "www.agriequipments.com",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })


async def migrate_demo_customer_phone():
    """Move legacy Ramesh demo customer (was on +919045666666 - now an admin
    phone) onto a non-admin number; downgrade his role to customer."""
    user = await db.users.find_one({"email": "ramesh@farm.com"})
    if not user:
        return
    update = {}
    if user.get("phone") == "+919045666666":
        update["phone"] = "+919876543210"
    if user.get("role") == "admin":
        update["role"] = "customer"
    if update:
        await db.users.update_one({"id": user["id"]}, {"$set": update})


async def run_all():
    await db.users.create_index("email", unique=True)
    await db.products.create_index("id", unique=True)
    await db.orders.create_index("user_id")
    await db.otps.create_index("phone", unique=True)
    await db.dealers.create_index("id", unique=True)
    await db.leads.create_index("id", unique=True)
    await db.leads.create_index("referrer_user_id")
    await db.points_transactions.create_index("user_id")
    await seed_admin()
    await seed_admin_phones()
    await migrate_demo_customer_phone()
    await seed_products()
    await seed_news()
    await seed_offers()
    await seed_demo_customer()
    await seed_dealers()
    await seed_settings()

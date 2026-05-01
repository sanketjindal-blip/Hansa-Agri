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


async def seed_demo_customer():
    email = "ramesh@farm.com"
    existing = await db.users.find_one({"email": email})
    if not existing:
        uid = str(uuid.uuid4())
        await db.users.insert_one({
            "id": uid,
            "email": email,
            "name": "Ramesh Kumar",
            "phone": "+919045666666",
            "role": "customer",
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


async def run_all():
    await db.users.create_index("email", unique=True)
    await db.products.create_index("id", unique=True)
    await db.orders.create_index("user_id")
    await db.otps.create_index("phone", unique=True)
    await db.dealers.create_index("id", unique=True)
    await seed_admin()
    await seed_products()
    await seed_news()
    await seed_offers()
    await seed_demo_customer()
    await seed_dealers()
    await seed_settings()

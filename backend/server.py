from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

from seed_data import SEED_PRODUCTS, SEED_NEWS, SEED_OFFERS, SEED_CUSTOMER_ORDERS

# ---------------- Setup ----------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@rkai.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_DAYS = 30

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI()
api = APIRouter(prefix="/api")
bearer_scheme = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rkai")


# ---------------- Helpers ----------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_DAYS),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def strip_id(doc):
    if doc is None:
        return None
    doc.pop("_id", None)
    return doc


async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)):
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---------------- Models ----------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    phone: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class AuthOut(BaseModel):
    access_token: str
    user: dict


class OrderItemIn(BaseModel):
    product_id: str
    quantity: int = 1


class CheckoutIn(BaseModel):
    items: List[OrderItemIn]
    full_name: str
    phone: str
    address: str
    city: str
    state: str
    pincode: str
    payment_method: str = "cod"
    promo_code: Optional[str] = None


class SupportTicketIn(BaseModel):
    subject: str
    message: str
    product_id: Optional[str] = None


# ---------------- Auth Routes ----------------
@api.post("/auth/register", response_model=AuthOut)
async def register(body: RegisterIn):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": body.name,
        "phone": body.phone or "",
        "role": "customer",
        "password_hash": hash_password(body.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    token = create_access_token(user["id"], user["email"])
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"access_token": token, "user": user}


@api.post("/auth/login", response_model=AuthOut)
async def login(body: LoginIn):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"])
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"access_token": token, "user": user}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


# ---------------- Products ----------------
@api.get("/products")
async def list_products(category: Optional[str] = None, q: Optional[str] = None):
    query = {}
    if category and category != "all":
        query["category"] = category
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    items = await db.products.find(query, {"_id": 0}).to_list(500)
    return items


@api.get("/products/categories")
async def list_categories():
    cats = await db.products.distinct("category")
    return sorted(cats)


@api.get("/products/featured")
async def featured_products():
    items = await db.products.find({"featured": True}, {"_id": 0}).to_list(20)
    return items


@api.get("/products/{product_id}")
async def get_product(product_id: str):
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return p


# ---------------- News ----------------
@api.get("/news")
async def list_news():
    items = await db.news.find({}, {"_id": 0}).sort("published_at", -1).to_list(50)
    return items


# ---------------- Offers ----------------
@api.get("/offers")
async def list_offers():
    items = await db.offers.find({}, {"_id": 0}).to_list(50)
    return items


# ---------------- Orders & Warranty ----------------
@api.post("/orders/checkout")
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
            "full_name": body.full_name,
            "phone": body.phone,
            "address": body.address,
            "city": body.city,
            "state": body.state,
            "pincode": body.pincode,
        },
        "created_at": now.isoformat(),
        "purchase_date": now.isoformat(),
    }
    await db.orders.insert_one(order)
    order.pop("_id", None)
    return order


@api.get("/orders")
async def my_orders(user=Depends(get_current_user)):
    items = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api.get("/orders/{order_id}")
async def get_order(order_id: str, user=Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")
    return o


@api.get("/warranties")
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


# ---------------- Support ----------------
@api.post("/support/tickets")
async def create_ticket(body: SupportTicketIn, user=Depends(get_current_user)):
    ticket = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_email": user["email"],
        "subject": body.subject,
        "message": body.message,
        "product_id": body.product_id,
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.support_tickets.insert_one(ticket)
    ticket.pop("_id", None)
    return ticket


@api.get("/support/tickets")
async def my_tickets(user=Depends(get_current_user)):
    items = await db.support_tickets.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items


# ---------------- Health ----------------
@api.get("/")
async def root():
    return {"status": "ok", "app": "RKAI Customer App"}


# ---------------- Startup / Seed ----------------
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
            "phone": "+919876543210",
            "role": "customer",
            "password_hash": hash_password("farmer123"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        # seed 2 past orders for him (warranty demo)
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
                    "product_id": p["id"],
                    "name": p["name"],
                    "category": p["category"],
                    "image": p.get("image"),
                    "price": p["price"],
                    "quantity": entry["quantity"],
                    "warranty_months": p.get("warranty_months", 12),
                    "line_total": line,
                })
            purchase_date = datetime.now(timezone.utc) - timedelta(days=order_def["days_ago"])
            order = {
                "id": str(uuid.uuid4()),
                "order_number": "RKAI" + purchase_date.strftime("%y%m%d") + str(uuid.uuid4().int)[:5],
                "user_id": uid,
                "items": items,
                "subtotal": round(subtotal, 2),
                "discount": 0.0,
                "promo_code": None,
                "total": round(subtotal, 2),
                "status": "delivered",
                "payment_method": "cod",
                "shipping": {
                    "full_name": "Ramesh Kumar",
                    "phone": "+919876543210",
                    "address": "Village Arifpur, Kithore Hapur Road",
                    "city": "Hapur",
                    "state": "Uttar Pradesh",
                    "pincode": "201015",
                },
                "created_at": purchase_date.isoformat(),
                "purchase_date": purchase_date.isoformat(),
            }
            await db.orders.insert_one(order)


async def seed_products():
    count = await db.products.count_documents({})
    if count == 0:
        await db.products.insert_many([dict(p) for p in SEED_PRODUCTS])


async def seed_news():
    count = await db.news.count_documents({})
    if count == 0:
        await db.news.insert_many([dict(n) for n in SEED_NEWS])


async def seed_offers():
    count = await db.offers.count_documents({})
    if count == 0:
        await db.offers.insert_many([dict(o) for o in SEED_OFFERS])


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.products.create_index("id", unique=True)
    await db.orders.create_index("user_id")
    await seed_admin()
    await seed_products()
    await seed_news()
    await seed_offers()
    await seed_demo_customer()
    logger.info("RKAI app startup complete")


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

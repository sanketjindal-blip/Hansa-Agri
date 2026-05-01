"""Authentication routes (email/password + phone OTP)."""
import random
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Depends

from core.db import db
from core.helpers import normalize_phone
from core.security import (
    hash_password, verify_password, create_access_token, get_current_user,
)
from models.schemas import RegisterIn, LoginIn, PhoneIn, OtpVerifyIn, AuthOut
from sms import send_sms

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthOut)
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


@router.post("/login", response_model=AuthOut)
async def login(body: LoginIn):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"])
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"access_token": token, "user": user}


@router.get("/me")
async def me(user=Depends(get_current_user)):
    return user


@router.post("/send-otp")
async def send_otp(body: PhoneIn):
    phone = normalize_phone(body.phone)
    if not phone or len(phone) < 12:
        raise HTTPException(status_code=400, detail="Invalid phone number")
    code = f"{random.randint(100000, 999999)}"
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    await db.otps.update_one(
        {"phone": phone},
        {"$set": {"phone": phone, "code": code, "expires_at": expires.isoformat(), "attempts": 0}},
        upsert=True,
    )
    msg = f"HANSA: Your login OTP is {code}. Valid for 10 minutes. Do not share."
    result = send_sms(phone, msg)
    return {"sent": result.get("ok", False), "phone": phone}


@router.post("/verify-otp", response_model=AuthOut)
async def verify_otp(body: OtpVerifyIn):
    phone = normalize_phone(body.phone)
    rec = await db.otps.find_one({"phone": phone})
    if not rec:
        raise HTTPException(status_code=400, detail="Request an OTP first")
    if rec.get("attempts", 0) >= 5:
        raise HTTPException(status_code=429, detail="Too many attempts. Request a new OTP.")
    if datetime.fromisoformat(rec["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP expired")
    if body.otp.strip() != rec["code"]:
        await db.otps.update_one({"phone": phone}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Invalid OTP")

    user = await db.users.find_one({"phone": phone})
    if not user:
        user = {
            "id": str(uuid.uuid4()),
            "email": f"{phone.lstrip('+')}@phone.hansa",
            "name": body.name or f"Farmer {phone[-4:]}",
            "phone": phone,
            "role": "customer",
            "password_hash": hash_password(uuid.uuid4().hex),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(user)
    await db.otps.delete_one({"phone": phone})
    token = create_access_token(user["id"], user["email"])
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"access_token": token, "user": user}

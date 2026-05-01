"""Razorpay payment routes (optional - only if keys configured)."""
from fastapi import APIRouter, Depends, HTTPException

from core.config import RAZORPAY_ENABLED, RAZORPAY_KEY_ID, rzp_client
from core.db import db
from core.security import get_current_user
from models.schemas import RazorpayOrderIn, RazorpayVerifyIn

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/config")
async def payment_config():
    return {"razorpay_enabled": RAZORPAY_ENABLED, "key_id": RAZORPAY_KEY_ID if RAZORPAY_ENABLED else ""}


@router.post("/razorpay/create-order")
async def create_razorpay_order(body: RazorpayOrderIn, user=Depends(get_current_user)):
    if not RAZORPAY_ENABLED:
        raise HTTPException(
            status_code=400,
            detail="Razorpay not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend .env",
        )
    amount_paise = int(round(body.amount_inr * 100))
    order = rzp_client.order.create(
        {"amount": amount_paise, "currency": "INR", "payment_capture": 1}
    )
    return {
        "order_id": order["id"], "amount": order["amount"],
        "currency": order["currency"], "key_id": RAZORPAY_KEY_ID,
    }


@router.post("/razorpay/verify")
async def verify_razorpay(body: RazorpayVerifyIn, user=Depends(get_current_user)):
    if not RAZORPAY_ENABLED:
        raise HTTPException(status_code=400, detail="Razorpay not configured")
    try:
        rzp_client.utility.verify_payment_signature({
            "razorpay_order_id": body.razorpay_order_id,
            "razorpay_payment_id": body.razorpay_payment_id,
            "razorpay_signature": body.razorpay_signature,
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Signature verification failed")
    await db.orders.update_one(
        {"id": body.order_id, "user_id": user["id"]},
        {"$set": {"payment_method": "razorpay", "payment_id": body.razorpay_payment_id, "status": "paid"}}
    )
    return {"status": "verified"}

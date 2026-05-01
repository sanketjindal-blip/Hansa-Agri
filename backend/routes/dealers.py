"""Dealer-facing routes."""
from fastapi import APIRouter, Depends

from core.db import db
from core.security import require_dealer
from dealers_data import DEALERS
from models.schemas import AssignWarrantyIn
from services.warranty import assign_warranty as _assign_warranty

router = APIRouter(tags=["dealers"])


@router.get("/dealers")
async def list_dealers():
    items = await db.dealers.find({}, {"_id": 0}).to_list(500)
    if not items:
        return DEALERS
    return items


@router.get("/dealer/me")
async def dealer_me(user=Depends(require_dealer)):
    dealer = None
    if user.get("dealer_id"):
        dealer = await db.dealers.find_one({"id": user["dealer_id"]}, {"_id": 0})
    return {"user": user, "dealer": dealer}


@router.get("/dealer/orders")
async def dealer_orders(user=Depends(require_dealer)):
    filt = {"assigned_by_dealer": user["id"]} if user.get("role") == "dealer" else {}
    items = await db.orders.find(filt, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@router.post("/dealer/assign-warranty")
async def dealer_assign_warranty(body: AssignWarrantyIn, user=Depends(require_dealer)):
    return await _assign_warranty(body, actor=user, role_label="dealer")


@router.get("/settings/company")
async def get_company():
    s = await db.settings.find_one({"id": "company"}, {"_id": 0})
    return s or {}

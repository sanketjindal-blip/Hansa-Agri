"""User-facing lead/referral & points routes."""
from fastapi import APIRouter, Depends, HTTPException

from core.security import get_current_user
from models.schemas import LeadIn
from services import loyalty

router = APIRouter(tags=["loyalty"])


@router.post("/leads")
async def submit_lead(body: LeadIn, user=Depends(get_current_user)):
    try:
        lead = await loyalty.create_lead(
            user, body.name, body.phone,
            body.equipment_interest or "", body.notes or "",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return lead


@router.get("/leads/mine")
async def my_leads(user=Depends(get_current_user)):
    return await loyalty.list_leads_for_user(user["id"])


@router.get("/me/points")
async def my_points(user=Depends(get_current_user)):
    balance = await loyalty.get_user_points(user["id"])
    txns = await loyalty.list_user_transactions(user["id"])
    return {"balance": balance, "transactions": txns, "point_value_inr": 1}

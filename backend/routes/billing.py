"""Billing routes — Company settings, Customer master, Quotations, Tax Invoices.

This module implements Phase 1 + Phase 2 of the GST-compliant billing flow:
Quotation → Tax Invoice with full CGST/SGST/IGST split, financial-year-wise
sequential numbering, and per-doc PDF rendering.

Numbering format: HANSA/<FY>/<TYPE>/<seq:04d>  e.g. HANSA/2025-26/INV/0001
The sequence counter lives in the `billing_sequences` collection — atomic
$inc for gap-free numbering.
"""
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from core.db import db
from core.security import require_admin
from services import gst, pdfgen

router = APIRouter(prefix="/admin/billing", tags=["billing"])

DEFAULT_HSN = "843290"
DEFAULT_GST = 5.0


# ---------- Schemas ----------
class CompanySettingsIn(BaseModel):
    legal_name: str
    trade_name: Optional[str] = ""
    gstin: str
    pan: Optional[str] = ""
    cin: Optional[str] = ""
    address_line1: Optional[str] = ""
    address_line2: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    state_code: Optional[str] = ""
    pincode: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    website: Optional[str] = ""
    bank_name: Optional[str] = ""
    bank_account: Optional[str] = ""
    bank_ifsc: Optional[str] = ""
    bank_branch: Optional[str] = ""
    invoice_prefix: Optional[str] = "HANSA"
    default_terms: Optional[str] = ""
    default_quote_validity_days: int = 15


class CustomerIn(BaseModel):
    name: str
    gstin: Optional[str] = ""
    pan: Optional[str] = ""
    contact_person: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    billing_address_line1: Optional[str] = ""
    billing_address_line2: Optional[str] = ""
    billing_city: Optional[str] = ""
    billing_state: Optional[str] = ""
    billing_state_code: Optional[str] = ""
    billing_pincode: Optional[str] = ""
    shipping_same_as_billing: bool = True
    shipping_address_line1: Optional[str] = ""
    shipping_address_line2: Optional[str] = ""
    shipping_city: Optional[str] = ""
    shipping_state: Optional[str] = ""
    shipping_state_code: Optional[str] = ""
    shipping_pincode: Optional[str] = ""
    payment_terms: Optional[str] = ""


class BillingItemIn(BaseModel):
    name: str
    description: Optional[str] = ""
    hsn_code: str = DEFAULT_HSN
    qty: float
    unit: str = "NOS"
    rate: float
    discount_pct: float = 0.0
    gst_rate: float = DEFAULT_GST


class QuotationIn(BaseModel):
    customer_id: str
    date: Optional[str] = None  # ISO; defaults to now()
    valid_till: Optional[str] = None
    items: List[BillingItemIn]
    notes: Optional[str] = ""
    terms: Optional[str] = ""
    place_of_supply: Optional[str] = ""  # state code 2-digit


class InvoiceIn(BaseModel):
    customer_id: str
    date: Optional[str] = None
    items: List[BillingItemIn]
    notes: Optional[str] = ""
    terms: Optional[str] = ""
    place_of_supply: Optional[str] = ""
    po_number: Optional[str] = ""
    transport_mode: Optional[str] = ""
    transporter_name: Optional[str] = ""
    transporter_id: Optional[str] = ""
    vehicle_no: Optional[str] = ""
    eway_bill_no: Optional[str] = ""
    quotation_id: Optional[str] = ""  # if converted from a quote


# ---------- helpers ----------
async def _get_company() -> dict:
    s = await db.company_settings.find_one({"id": "default"}, {"_id": 0})
    if not s:
        # Seed with this session's GSTIN data — admin can edit anytime.
        s = {
            "id": "default",
            "legal_name": "RAMKISHAN AGRI INNOVATE PRIVATE LIMITED",
            "trade_name": "RAMKISHAN AGRI INNOVATE",
            "gstin": "09AAOCR7303L1ZU",
            "pan": "AAOCR7303L",
            "address_line1": "Plot No 26, Harsh Commercial Park",
            "address_line2": "Garh Road",
            "city": "Meerut",
            "state": "Uttar Pradesh",
            "state_code": "09",
            "pincode": "250004",
            "invoice_prefix": "HANSA",
            "default_terms": "Goods once sold will not be taken back. Subject to Meerut jurisdiction.",
            "default_quote_validity_days": 15,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.company_settings.insert_one(s)
        s.pop("_id", None)
    return s


async def _next_number(kind: str, prefix: str) -> str:
    """Atomic, FY-wise sequence: HANSA/2025-26/INV/0001."""
    fy = gst.fy_for()
    key = f"{prefix}:{kind}:{fy}"
    res = await db.billing_sequences.find_one_and_update(
        {"id": key},
        {"$inc": {"counter": 1},
         "$setOnInsert": {"id": key, "fy": fy, "kind": kind, "prefix": prefix}},
        upsert=True,
        return_document=True,
    )
    n = (res or {}).get("counter") or 1
    if not res or "counter" not in res:
        # find_one_and_update with return_document must be ReturnDocument.AFTER
        # for accurate counter. Re-read to be safe.
        cur = await db.billing_sequences.find_one({"id": key}, {"_id": 0})
        n = (cur or {}).get("counter") or 1
    return f"{prefix}/{fy}/{kind}/{n:04d}"


async def _hydrate_buyer(customer_id: str) -> dict:
    c = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Customer not found")
    addr = {
        "name": c["name"],
        "address_line1": c.get("billing_address_line1", ""),
        "address_line2": c.get("billing_address_line2", ""),
        "city": c.get("billing_city", ""),
        "state": c.get("billing_state", ""),
        "pincode": c.get("billing_pincode", ""),
        "gstin": c.get("gstin", ""),
        "pan": c.get("pan", ""),
        "phone": c.get("phone", ""),
        "email": c.get("email", ""),
    }
    if c.get("shipping_same_as_billing", True):
        ship = dict(addr)
    else:
        ship = {
            "name": c["name"],
            "address_line1": c.get("shipping_address_line1", ""),
            "address_line2": c.get("shipping_address_line2", ""),
            "city": c.get("shipping_city", ""),
            "state": c.get("shipping_state", ""),
            "pincode": c.get("shipping_pincode", ""),
        }
    pos = c.get("billing_state_code") or gst.state_code_from_gstin(c.get("gstin", ""))
    return {"buyer": addr, "ship_to": ship, "place_of_supply": pos or "", "raw": c}


# ---------- Company Settings ----------
@router.get("/company")
async def get_company(_=Depends(require_admin)):
    return await _get_company()


@router.put("/company")
async def update_company(body: CompanySettingsIn, _=Depends(require_admin)):
    if body.gstin and not gst.is_valid_gstin(body.gstin):
        raise HTTPException(400, "Invalid GSTIN format")
    data = body.dict()
    if data.get("gstin"):
        data["state_code"] = gst.state_code_from_gstin(data["gstin"])
        data["pan"] = data.get("pan") or gst.pan_from_gstin(data["gstin"])
    data["id"] = "default"
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.company_settings.update_one({"id": "default"}, {"$set": data}, upsert=True)
    return await _get_company()


# ---------- Customers ----------
@router.get("/customers")
async def list_customers(q: Optional[str] = None, _=Depends(require_admin)):
    filt: dict = {}
    if q:
        filt["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"gstin": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
        ]
    items = await db.customers.find(filt, {"_id": 0}).sort("name", 1).to_list(500)
    return items


@router.post("/customers")
async def create_customer(body: CustomerIn, _=Depends(require_admin)):
    if body.gstin and not gst.is_valid_gstin(body.gstin):
        raise HTTPException(400, "Invalid GSTIN format")
    data = body.dict()
    data["id"] = str(uuid.uuid4())
    if data.get("gstin"):
        data["billing_state_code"] = data.get("billing_state_code") or gst.state_code_from_gstin(data["gstin"])
        data["pan"] = data.get("pan") or gst.pan_from_gstin(data["gstin"])
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.customers.insert_one(data)
    data.pop("_id", None)
    return data


@router.patch("/customers/{cid}")
async def update_customer(cid: str, body: CustomerIn, _=Depends(require_admin)):
    if body.gstin and not gst.is_valid_gstin(body.gstin):
        raise HTTPException(400, "Invalid GSTIN format")
    data = body.dict()
    if data.get("gstin"):
        data["billing_state_code"] = data.get("billing_state_code") or gst.state_code_from_gstin(data["gstin"])
    res = await db.customers.update_one({"id": cid}, {"$set": data})
    if res.matched_count == 0:
        raise HTTPException(404, "Customer not found")
    return await db.customers.find_one({"id": cid}, {"_id": 0})


@router.delete("/customers/{cid}")
async def delete_customer(cid: str, _=Depends(require_admin)):
    await db.customers.delete_one({"id": cid})
    return {"ok": True}


# ---------- Quotations ----------
@router.get("/quotations")
async def list_quotations(_=Depends(require_admin)):
    return await db.quotations.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/quotations")
async def create_quotation(body: QuotationIn, _=Depends(require_admin)):
    company = await _get_company()
    party = await _hydrate_buyer(body.customer_id)
    pos = (body.place_of_supply or party["place_of_supply"]
           or company.get("state_code") or "09")
    crunch = gst.compute_doc_totals(
        [i.dict() for i in body.items],
        company.get("state_code") or "09",
        pos,
    )
    doc = {
        "id": str(uuid.uuid4()),
        "type": "quotation",
        "number": await _next_number("QUO", company.get("invoice_prefix", "HANSA")),
        "date": body.date or datetime.now(timezone.utc).isoformat(),
        "valid_till": body.valid_till or "",
        "customer_id": body.customer_id,
        "buyer": party["buyer"],
        "ship_to": party["ship_to"],
        "place_of_supply": pos,
        "items": crunch["items"],
        "totals": crunch["totals"],
        "notes": body.notes or "",
        "terms": body.terms or company.get("default_terms", ""),
        "status": "draft",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.quotations.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/quotations/{qid}")
async def get_quotation(qid: str, _=Depends(require_admin)):
    q = await db.quotations.find_one({"id": qid}, {"_id": 0})
    if not q:
        raise HTTPException(404, "Quotation not found")
    return q


@router.get("/quotations/{qid}/pdf")
async def quotation_pdf(qid: str, _=Depends(require_admin)):
    q = await db.quotations.find_one({"id": qid}, {"_id": 0})
    if not q:
        raise HTTPException(404, "Quotation not found")
    company = await _get_company()
    pdf = pdfgen.render_billing_doc("quotation", q, company)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{q["number"].replace("/", "-")}.pdf"'})


@router.post("/quotations/{qid}/convert")
async def convert_to_invoice(qid: str, _=Depends(require_admin)):
    q = await db.quotations.find_one({"id": qid}, {"_id": 0})
    if not q:
        raise HTTPException(404, "Quotation not found")
    company = await _get_company()
    inv = {
        "id": str(uuid.uuid4()),
        "type": "invoice",
        "number": await _next_number("INV", company.get("invoice_prefix", "HANSA")),
        "date": datetime.now(timezone.utc).isoformat(),
        "customer_id": q["customer_id"],
        "buyer": q["buyer"],
        "ship_to": q["ship_to"],
        "place_of_supply": q["place_of_supply"],
        "items": q["items"],
        "totals": q["totals"],
        "notes": q.get("notes", ""),
        "terms": q.get("terms", "") or company.get("default_terms", ""),
        "quotation_id": qid,
        "status": "issued",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.invoices.insert_one(inv)
    await db.quotations.update_one({"id": qid}, {"$set": {"status": "converted", "invoice_id": inv["id"]}})
    inv.pop("_id", None)
    return inv


@router.delete("/quotations/{qid}")
async def delete_quotation(qid: str, _=Depends(require_admin)):
    await db.quotations.delete_one({"id": qid})
    return {"ok": True}


# ---------- Invoices ----------
@router.get("/invoices")
async def list_invoices(_=Depends(require_admin)):
    return await db.invoices.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/invoices")
async def create_invoice(body: InvoiceIn, _=Depends(require_admin)):
    company = await _get_company()
    party = await _hydrate_buyer(body.customer_id)
    pos = (body.place_of_supply or party["place_of_supply"]
           or company.get("state_code") or "09")
    crunch = gst.compute_doc_totals(
        [i.dict() for i in body.items],
        company.get("state_code") or "09",
        pos,
    )
    doc = {
        "id": str(uuid.uuid4()),
        "type": "invoice",
        "number": await _next_number("INV", company.get("invoice_prefix", "HANSA")),
        "date": body.date or datetime.now(timezone.utc).isoformat(),
        "customer_id": body.customer_id,
        "buyer": party["buyer"],
        "ship_to": party["ship_to"],
        "place_of_supply": pos,
        "items": crunch["items"],
        "totals": crunch["totals"],
        "notes": body.notes or "",
        "terms": body.terms or company.get("default_terms", ""),
        "po_number": body.po_number or "",
        "transport_mode": body.transport_mode or "",
        "transporter_name": body.transporter_name or "",
        "transporter_id": body.transporter_id or "",
        "vehicle_no": body.vehicle_no or "",
        "eway_bill_no": body.eway_bill_no or "",
        "quotation_id": body.quotation_id or "",
        "status": "issued",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.invoices.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/invoices/{iid}")
async def get_invoice(iid: str, _=Depends(require_admin)):
    inv = await db.invoices.find_one({"id": iid}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    return inv


@router.get("/invoices/{iid}/pdf")
async def invoice_pdf(iid: str, _=Depends(require_admin)):
    inv = await db.invoices.find_one({"id": iid}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    company = await _get_company()
    pdf = pdfgen.render_billing_doc("invoice", inv, company)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{inv["number"].replace("/", "-")}.pdf"'})


@router.delete("/invoices/{iid}")
async def delete_invoice(iid: str, _=Depends(require_admin)):
    await db.invoices.delete_one({"id": iid})
    return {"ok": True}


# ---------- Catalog helper for billing UI ----------
@router.get("/catalog-items")
async def catalog_items(q: Optional[str] = None, _=Depends(require_admin)):
    """Returns products in a billing-friendly shape so the line-item picker
    can autofill HSN, GST rate, unit, and rate from the product master."""
    filt: dict = {}
    if q:
        filt["name"] = {"$regex": q, "$options": "i"}
    items = await db.products.find(filt, {"_id": 0}).sort([("sort_order", 1), ("name", 1)]).to_list(500)
    return [{
        "id": p.get("id"),
        "name": p.get("name"),
        "description": (p.get("features") or [""])[0] if p.get("features") else "",
        "rate": p.get("price", 0),
        "hsn_code": p.get("hsn_code", DEFAULT_HSN),
        "gst_rate": p.get("gst_rate", DEFAULT_GST),
        "unit": p.get("unit", "NOS"),
        "image": p.get("image"),
    } for p in items]

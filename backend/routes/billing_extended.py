"""Billing — Phase 3+4+5(stub)+7.

  • Phase 3: Delivery Challans  + Gate Passes
  • Phase 4: Vendor Master      + Purchase Orders
  • Phase 5: e-Way Bill stub    (GSP creds pending; manual entry available)
  • Phase 7: Reports            (GSTR-1 JSON, Sales Register, Customer
                                 Ledger, Receivables Aging)

Numbering schema mirrors P1+P2:
  HANSA/<FY>/DC/0001    delivery challan
  HANSA/<FY>/GP/0001    gate pass
  HANSA/<FY>/PO/0001    purchase order
"""
from __future__ import annotations
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from core.db import db
from core.security import require_admin
from services import gst, pdfgen
from routes.billing import _get_company, _next_number, _hydrate_buyer, BillingItemIn

router = APIRouter(prefix="/admin/billing", tags=["billing-extended"])

DEFAULT_HSN = "843290"


# ═════════════════════════════ SCHEMAS ═════════════════════════════
class VendorIn(BaseModel):
    name: str
    gstin: Optional[str] = ""
    pan: Optional[str] = ""
    contact_person: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address_line1: Optional[str] = ""
    address_line2: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    state_code: Optional[str] = ""
    pincode: Optional[str] = ""
    payment_terms: Optional[str] = ""
    bank_name: Optional[str] = ""
    bank_account: Optional[str] = ""
    bank_ifsc: Optional[str] = ""


class DeliveryChallanIn(BaseModel):
    customer_id: str
    invoice_id: Optional[str] = ""           # optional link to invoice
    purpose: Optional[str] = "sale"          # sale | job-work | sample | approval | return
    apply_gst: bool = True                   # toggle: tax-bearing DC vs job-work no-GST DC
    date: Optional[str] = None
    items: List[BillingItemIn]
    transport_mode: Optional[str] = ""
    transporter_name: Optional[str] = ""
    vehicle_no: Optional[str] = ""
    driver_name: Optional[str] = ""
    driver_phone: Optional[str] = ""
    notes: Optional[str] = ""
    place_of_supply: Optional[str] = ""


class GatePassIn(BaseModel):
    ref_type: str                            # invoice | delivery_challan | manual
    ref_id: Optional[str] = ""
    direction: str = "outward"               # outward | inward
    party_name: Optional[str] = ""
    items_summary: Optional[str] = ""
    vehicle_no: Optional[str] = ""
    driver_name: Optional[str] = ""
    driver_phone: Optional[str] = ""
    notes: Optional[str] = ""


class PurchaseOrderIn(BaseModel):
    vendor_id: str
    date: Optional[str] = None
    expected_delivery: Optional[str] = ""
    items: List[BillingItemIn]
    notes: Optional[str] = ""
    terms: Optional[str] = ""
    place_of_supply: Optional[str] = ""


class EwayBillIn(BaseModel):
    eway_bill_no: str
    eway_bill_date: Optional[str] = ""
    transport_mode: Optional[str] = ""
    transporter_name: Optional[str] = ""
    transporter_id: Optional[str] = ""
    vehicle_no: Optional[str] = ""


# ═════════════════════════════ helpers ═════════════════════════════
async def _hydrate_vendor(vendor_id: str) -> dict:
    v = await db.vendors.find_one({"id": vendor_id}, {"_id": 0})
    if not v:
        raise HTTPException(404, "Vendor not found")
    addr = {
        "name": v["name"],
        "address_line1": v.get("address_line1", ""),
        "address_line2": v.get("address_line2", ""),
        "city": v.get("city", ""),
        "state": v.get("state", ""),
        "pincode": v.get("pincode", ""),
        "gstin": v.get("gstin", ""),
        "pan": v.get("pan", ""),
        "phone": v.get("phone", ""),
        "email": v.get("email", ""),
    }
    pos = v.get("state_code") or gst.state_code_from_gstin(v.get("gstin", ""))
    return {"vendor_block": addr, "place_of_supply": pos or "", "raw": v}


# ═════════════════════════════ VENDORS ═════════════════════════════
@router.get("/vendors")
async def list_vendors(q: Optional[str] = None, _=Depends(require_admin)):
    filt: dict = {}
    if q:
        filt["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"gstin": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
        ]
    return await db.vendors.find(filt, {"_id": 0}).sort("name", 1).to_list(500)


@router.post("/vendors")
async def create_vendor(body: VendorIn, _=Depends(require_admin)):
    if body.gstin and not gst.is_valid_gstin(body.gstin):
        raise HTTPException(400, "Invalid GSTIN format")
    data = body.dict()
    data["id"] = str(uuid.uuid4())
    if data.get("gstin"):
        data["state_code"] = data.get("state_code") or gst.state_code_from_gstin(data["gstin"])
        data["pan"] = data.get("pan") or gst.pan_from_gstin(data["gstin"])
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.vendors.insert_one(data)
    data.pop("_id", None)
    return data


@router.patch("/vendors/{vid}")
async def update_vendor(vid: str, body: VendorIn, _=Depends(require_admin)):
    if body.gstin and not gst.is_valid_gstin(body.gstin):
        raise HTTPException(400, "Invalid GSTIN format")
    data = body.dict()
    if data.get("gstin"):
        data["state_code"] = data.get("state_code") or gst.state_code_from_gstin(data["gstin"])
    res = await db.vendors.update_one({"id": vid}, {"$set": data})
    if res.matched_count == 0:
        raise HTTPException(404, "Vendor not found")
    return await db.vendors.find_one({"id": vid}, {"_id": 0})


@router.delete("/vendors/{vid}")
async def delete_vendor(vid: str, _=Depends(require_admin)):
    await db.vendors.delete_one({"id": vid})
    return {"ok": True}


# ═════════════════════════ DELIVERY CHALLAN ═════════════════════════
@router.get("/delivery-challans")
async def list_dc(_=Depends(require_admin)):
    return await db.delivery_challans.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/delivery-challans")
async def create_dc(body: DeliveryChallanIn, _=Depends(require_admin)):
    company = await _get_company()
    party = await _hydrate_buyer(body.customer_id)
    pos = body.place_of_supply or party["place_of_supply"] or company.get("state_code") or "09"
    if body.apply_gst:
        crunch = gst.compute_doc_totals(
            [i.dict() for i in body.items],
            company.get("state_code") or "09",
            pos,
        )
        items = crunch["items"]
        totals = crunch["totals"]
    else:
        # Job-work / sample DC — value-only, no GST split
        items = []
        sub = 0.0
        for raw in [i.dict() for i in body.items]:
            qty = float(raw.get("qty") or 0)
            rate = float(raw.get("rate") or 0)
            line = round(qty * rate, 2)
            items.append({
                **raw,
                "taxable": line, "line_total": line,
                "cgst_rate": 0, "sgst_rate": 0, "igst_rate": 0,
                "cgst_amount": 0, "sgst_amount": 0, "igst_amount": 0,
                "discount_amount": 0,
            })
            sub += line
        totals = {
            "subtotal": sub, "total_discount": 0, "taxable": sub,
            "cgst": 0, "sgst": 0, "igst": 0, "tax_total": 0,
            "round_off": 0, "grand_total": sub,
            "amount_in_words": gst.amount_in_words_inr(sub),
            "intra_state": True,
        }
    doc = {
        "id": str(uuid.uuid4()),
        "type": "delivery_challan",
        "number": await _next_number("DC", company.get("invoice_prefix", "HANSA")),
        "date": body.date or datetime.now(timezone.utc).isoformat(),
        "customer_id": body.customer_id,
        "buyer": party["buyer"],
        "ship_to": party["ship_to"],
        "place_of_supply": pos,
        "purpose": body.purpose or "sale",
        "apply_gst": body.apply_gst,
        "items": items,
        "totals": totals,
        "transport_mode": body.transport_mode or "",
        "transporter_name": body.transporter_name or "",
        "vehicle_no": body.vehicle_no or "",
        "driver_name": body.driver_name or "",
        "driver_phone": body.driver_phone or "",
        "notes": body.notes or "",
        "invoice_id": body.invoice_id or "",
        "status": "issued",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.delivery_challans.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/delivery-challans/{did}")
async def get_dc(did: str, _=Depends(require_admin)):
    d = await db.delivery_challans.find_one({"id": did}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Delivery challan not found")
    return d


@router.get("/delivery-challans/{did}/pdf")
async def dc_pdf(did: str, _=Depends(require_admin)):
    d = await db.delivery_challans.find_one({"id": did}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Delivery challan not found")
    company = await _get_company()
    pdf = pdfgen.render_billing_doc("delivery_challan", d, company)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{d["number"].replace("/", "-")}.pdf"'})


@router.delete("/delivery-challans/{did}")
async def del_dc(did: str, _=Depends(require_admin)):
    await db.delivery_challans.delete_one({"id": did})
    return {"ok": True}


# ═════════════════════════════ GATE PASS ═════════════════════════════
@router.get("/gate-passes")
async def list_gp(_=Depends(require_admin)):
    return await db.gate_passes.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/gate-passes")
async def create_gp(body: GatePassIn, _=Depends(require_admin)):
    company = await _get_company()
    party_name = body.party_name or ""
    items_summary = body.items_summary or ""
    ref_number = ""
    veh = body.vehicle_no or ""
    drv = body.driver_name or ""
    drv_phone = body.driver_phone or ""

    if body.ref_type == "invoice" and body.ref_id:
        inv = await db.invoices.find_one({"id": body.ref_id}, {"_id": 0})
        if inv:
            ref_number = inv.get("number", "")
            party_name = party_name or (inv.get("buyer") or {}).get("name", "")
            if not items_summary:
                items_summary = ", ".join([f"{i.get('name','')} x{i.get('qty')}" for i in (inv.get("items") or [])[:6]])
            veh = veh or inv.get("vehicle_no") or ""
    elif body.ref_type == "delivery_challan" and body.ref_id:
        dc = await db.delivery_challans.find_one({"id": body.ref_id}, {"_id": 0})
        if dc:
            ref_number = dc.get("number", "")
            party_name = party_name or (dc.get("buyer") or {}).get("name", "")
            if not items_summary:
                items_summary = ", ".join([f"{i.get('name','')} x{i.get('qty')}" for i in (dc.get("items") or [])[:6]])
            veh = veh or dc.get("vehicle_no") or ""
            drv = drv or dc.get("driver_name") or ""
            drv_phone = drv_phone or dc.get("driver_phone") or ""

    doc = {
        "id": str(uuid.uuid4()),
        "type": "gate_pass",
        "number": await _next_number("GP", company.get("invoice_prefix", "HANSA")),
        "date": datetime.now(timezone.utc).isoformat(),
        "ref_type": body.ref_type,
        "ref_id": body.ref_id or "",
        "ref_number": ref_number,
        "direction": body.direction or "outward",
        "party_name": party_name,
        "items_summary": items_summary,
        "vehicle_no": veh,
        "driver_name": drv,
        "driver_phone": drv_phone,
        "notes": body.notes or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.gate_passes.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/gate-passes/{gid}/pdf")
async def gp_pdf(gid: str, _=Depends(require_admin)):
    g = await db.gate_passes.find_one({"id": gid}, {"_id": 0})
    if not g:
        raise HTTPException(404, "Gate pass not found")
    company = await _get_company()
    pdf = pdfgen.render_gate_pass(g, company)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{g["number"].replace("/", "-")}.pdf"'})


@router.delete("/gate-passes/{gid}")
async def del_gp(gid: str, _=Depends(require_admin)):
    await db.gate_passes.delete_one({"id": gid})
    return {"ok": True}


# ═════════════════════════ PURCHASE ORDER ═════════════════════════
@router.get("/purchase-orders")
async def list_po(_=Depends(require_admin)):
    return await db.purchase_orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/purchase-orders")
async def create_po(body: PurchaseOrderIn, _=Depends(require_admin)):
    company = await _get_company()
    party = await _hydrate_vendor(body.vendor_id)
    pos = body.place_of_supply or company.get("state_code") or "09"
    crunch = gst.compute_doc_totals(
        [i.dict() for i in body.items],
        party["place_of_supply"] or "",   # supplier (vendor) state for PO context
        pos,                               # place of supply = our state
    )
    doc = {
        "id": str(uuid.uuid4()),
        "type": "purchase_order",
        "number": await _next_number("PO", company.get("invoice_prefix", "HANSA")),
        "date": body.date or datetime.now(timezone.utc).isoformat(),
        "expected_delivery": body.expected_delivery or "",
        "vendor_id": body.vendor_id,
        "vendor": party["vendor_block"],
        "buyer": {  # show our company as the buyer in PO
            "name": company.get("legal_name", ""),
            "address_line1": company.get("address_line1", ""),
            "address_line2": company.get("address_line2", ""),
            "city": company.get("city", ""),
            "state": company.get("state", ""),
            "pincode": company.get("pincode", ""),
            "gstin": company.get("gstin", ""),
            "pan": company.get("pan", ""),
            "phone": company.get("phone", ""),
            "email": company.get("email", ""),
        },
        "place_of_supply": pos,
        "items": crunch["items"],
        "totals": crunch["totals"],
        "notes": body.notes or "",
        "terms": body.terms or company.get("default_terms", ""),
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.purchase_orders.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/purchase-orders/{pid}")
async def get_po(pid: str, _=Depends(require_admin)):
    p = await db.purchase_orders.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Purchase order not found")
    return p


@router.get("/purchase-orders/{pid}/pdf")
async def po_pdf(pid: str, _=Depends(require_admin)):
    p = await db.purchase_orders.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Purchase order not found")
    company = await _get_company()
    pdf = pdfgen.render_billing_doc("purchase_order", p, company)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{p["number"].replace("/", "-")}.pdf"'})


@router.delete("/purchase-orders/{pid}")
async def del_po(pid: str, _=Depends(require_admin)):
    await db.purchase_orders.delete_one({"id": pid})
    return {"ok": True}


# ═════════════════════════ E-WAY BILL (stub) ═════════════════════════
@router.post("/invoices/{iid}/eway-bill")
async def attach_eway_bill(iid: str, body: EwayBillIn, _=Depends(require_admin)):
    """Manual e-Way Bill entry. Wire-up to GSP API (Cygnet/NIC sandbox/etc.)
    pending — once credentials are added to backend/.env, replace this with
    a real generate-call. For now we just persist whatever the admin types."""
    inv = await db.invoices.find_one({"id": iid}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    patch = body.dict()
    patch["eway_bill_status"] = "manual"
    patch["eway_bill_attached_at"] = datetime.now(timezone.utc).isoformat()
    await db.invoices.update_one({"id": iid}, {"$set": patch})
    return await db.invoices.find_one({"id": iid}, {"_id": 0})


@router.post("/invoices/{iid}/generate-eway")
async def generate_eway_bill(iid: str, _=Depends(require_admin)):
    """Calls the configured GSP. Returns 503 with a clear message until the
    GSP credentials are wired into backend/.env."""
    inv = await db.invoices.find_one({"id": iid}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    # TODO: replace with real GSP integration
    raise HTTPException(503, "e-Way Bill GSP not configured. Provide credentials in backend/.env "
                             "(EWAY_GSP_PROVIDER, EWAY_USERNAME, EWAY_PASSWORD, EWAY_CLIENT_ID, "
                             "EWAY_CLIENT_SECRET) — until then use Manual Entry on the invoice.")


# ═════════════════════════════ REPORTS ═════════════════════════════
@router.get("/reports/sales-register")
async def report_sales_register(date_from: Optional[str] = None, date_to: Optional[str] = None, _=Depends(require_admin)):
    filt: dict = {}
    if date_from:
        filt["date"] = {"$gte": date_from}
    if date_to:
        filt.setdefault("date", {})["$lte"] = date_to
    invs = await db.invoices.find(filt, {"_id": 0}).sort("date", 1).to_list(2000)
    rows = []
    sum_taxable = sum_cgst = sum_sgst = sum_igst = sum_grand = 0.0
    for i in invs:
        t = i.get("totals") or {}
        rows.append({
            "id": i["id"],
            "number": i.get("number"),
            "date": i.get("date"),
            "customer": (i.get("buyer") or {}).get("name", ""),
            "gstin": (i.get("buyer") or {}).get("gstin", ""),
            "place_of_supply": i.get("place_of_supply", ""),
            "taxable": t.get("taxable", 0),
            "cgst": t.get("cgst", 0),
            "sgst": t.get("sgst", 0),
            "igst": t.get("igst", 0),
            "grand_total": t.get("grand_total", 0),
            "intra_state": t.get("intra_state", True),
        })
        sum_taxable += t.get("taxable", 0)
        sum_cgst += t.get("cgst", 0)
        sum_sgst += t.get("sgst", 0)
        sum_igst += t.get("igst", 0)
        sum_grand += t.get("grand_total", 0)
    return {
        "rows": rows,
        "totals": {
            "count": len(rows),
            "taxable": round(sum_taxable, 2),
            "cgst": round(sum_cgst, 2),
            "sgst": round(sum_sgst, 2),
            "igst": round(sum_igst, 2),
            "grand_total": round(sum_grand, 2),
        }
    }


@router.get("/reports/customer-ledger")
async def report_customer_ledger(customer_id: str, _=Depends(require_admin)):
    cust = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not cust:
        raise HTTPException(404, "Customer not found")
    invs = await db.invoices.find({"customer_id": customer_id}, {"_id": 0}).sort("date", 1).to_list(2000)
    quos = await db.quotations.find({"customer_id": customer_id}, {"_id": 0}).sort("date", 1).to_list(2000)
    dcs = await db.delivery_challans.find({"customer_id": customer_id}, {"_id": 0}).sort("date", 1).to_list(2000)
    entries = []
    for q in quos:
        entries.append({"date": q.get("date"), "type": "quotation",
                        "number": q.get("number"), "amount": (q.get("totals") or {}).get("grand_total", 0),
                        "status": q.get("status"), "id": q.get("id")})
    for i in invs:
        entries.append({"date": i.get("date"), "type": "invoice",
                        "number": i.get("number"), "amount": (i.get("totals") or {}).get("grand_total", 0),
                        "status": i.get("status"), "id": i.get("id")})
    for d in dcs:
        entries.append({"date": d.get("date"), "type": "delivery_challan",
                        "number": d.get("number"), "amount": (d.get("totals") or {}).get("grand_total", 0),
                        "status": d.get("status"), "id": d.get("id")})
    entries.sort(key=lambda e: e.get("date") or "")
    invoiced = sum((i.get("totals") or {}).get("grand_total", 0) for i in invs)
    return {
        "customer": cust,
        "entries": entries,
        "summary": {
            "invoices_count": len(invs),
            "quotations_count": len(quos),
            "delivery_challans_count": len(dcs),
            "total_invoiced": round(invoiced, 2),
        }
    }


@router.get("/reports/aging")
async def report_aging(_=Depends(require_admin)):
    """Receivables aging — buckets unpaid invoices by days outstanding."""
    invs = await db.invoices.find({}, {"_id": 0}).to_list(5000)
    now = datetime.now(timezone.utc)
    buckets = {"0-30": 0.0, "31-60": 0.0, "61-90": 0.0, "90+": 0.0}
    rows = []
    for i in invs:
        if (i.get("payment_status") or "").lower() == "paid":
            continue
        try:
            d = datetime.fromisoformat((i.get("date") or "").replace("Z", "+00:00"))
        except Exception:
            d = now
        days = max(0, (now - d).days)
        amt = (i.get("totals") or {}).get("grand_total", 0)
        if days <= 30:
            buckets["0-30"] += amt; b = "0-30"
        elif days <= 60:
            buckets["31-60"] += amt; b = "31-60"
        elif days <= 90:
            buckets["61-90"] += amt; b = "61-90"
        else:
            buckets["90+"] += amt; b = "90+"
        rows.append({
            "id": i["id"],
            "number": i.get("number"),
            "date": i.get("date"),
            "customer": (i.get("buyer") or {}).get("name", ""),
            "amount": amt,
            "days": days,
            "bucket": b,
        })
    rows.sort(key=lambda r: -r["days"])
    return {
        "rows": rows,
        "buckets": {k: round(v, 2) for k, v in buckets.items()},
        "total_outstanding": round(sum(buckets.values()), 2),
    }


@router.get("/reports/gstr1")
async def report_gstr1(period: Optional[str] = None, _=Depends(require_admin)):
    """GSTR-1 outward supplies summary.

    `period` is in MMYYYY (e.g. '042025' = April 2025). If omitted, returns
    the current month. Returns the JSON shape the GSTN offline tool expects
    (b2b, b2cl, b2cs sections) plus a friendly on-screen summary.
    """
    company = await _get_company()
    now = datetime.now(timezone.utc)
    if period and len(period) == 6:
        mm, yyyy = int(period[:2]), int(period[2:])
        start = datetime(yyyy, mm, 1, tzinfo=timezone.utc)
        nm = mm + 1; ny = yyyy
        if nm > 12: nm = 1; ny = yyyy + 1
        end = datetime(ny, nm, 1, tzinfo=timezone.utc)
    else:
        start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        nm = now.month + 1; ny = now.year
        if nm > 12: nm = 1; ny = now.year + 1
        end = datetime(ny, nm, 1, tzinfo=timezone.utc)

    iso_start, iso_end = start.isoformat(), end.isoformat()
    invs = await db.invoices.find({"date": {"$gte": iso_start, "$lt": iso_end}}, {"_id": 0}).to_list(5000)

    b2b: dict = {}
    b2cl: list = []
    b2cs: dict = {}
    hsn_rows: dict = {}
    for inv in invs:
        buyer = inv.get("buyer") or {}
        gstin = (buyer.get("gstin") or "").strip().upper()
        totals = inv.get("totals") or {}
        items = inv.get("items") or []
        pos = inv.get("place_of_supply", "")

        # B2B
        if gstin:
            section = b2b.setdefault(gstin, {"ctin": gstin, "inv": []})
            section["inv"].append({
                "inum": inv.get("number"),
                "idt": (inv.get("date") or "")[:10],
                "val": totals.get("grand_total", 0),
                "pos": pos,
                "rchrg": "N",
                "inv_typ": "R",
                "itms": [{"num": idx + 1, "itm_det": {
                    "rt": it.get("gst_rate", 0),
                    "txval": it.get("taxable", 0),
                    "iamt": it.get("igst_amount", 0),
                    "camt": it.get("cgst_amount", 0),
                    "samt": it.get("sgst_amount", 0),
                    "csamt": 0,
                }} for idx, it in enumerate(items)],
            })
        else:
            # B2CL = inter-state >2.5L; B2CS = rest
            grand = totals.get("grand_total", 0)
            if not totals.get("intra_state", True) and grand > 250000:
                b2cl.append({
                    "pos": pos,
                    "inv": [{
                        "inum": inv.get("number"),
                        "idt": (inv.get("date") or "")[:10],
                        "val": grand,
                        "itms": [{"num": idx + 1, "itm_det": {
                            "rt": it.get("gst_rate", 0),
                            "txval": it.get("taxable", 0),
                            "iamt": it.get("igst_amount", 0),
                            "csamt": 0,
                        }} for idx, it in enumerate(items)],
                    }]
                })
            else:
                for it in items:
                    key = f"{pos}_{it.get('gst_rate',0)}"
                    bucket = b2cs.setdefault(key, {
                        "sply_ty": "INTRA" if totals.get("intra_state", True) else "INTER",
                        "rt": it.get("gst_rate", 0),
                        "typ": "OE",
                        "pos": pos,
                        "txval": 0, "iamt": 0, "camt": 0, "samt": 0, "csamt": 0,
                    })
                    bucket["txval"] += it.get("taxable", 0)
                    bucket["iamt"] += it.get("igst_amount", 0)
                    bucket["camt"] += it.get("cgst_amount", 0)
                    bucket["samt"] += it.get("sgst_amount", 0)

        # HSN summary
        for it in items:
            key = it.get("hsn_code", DEFAULT_HSN)
            row = hsn_rows.setdefault(key, {
                "hsn_sc": key, "desc": it.get("name", "")[:30], "uqc": it.get("unit", "NOS"),
                "qty": 0, "txval": 0, "iamt": 0, "camt": 0, "samt": 0, "csamt": 0,
            })
            row["qty"] += float(it.get("qty", 0))
            row["txval"] += float(it.get("taxable", 0))
            row["iamt"] += float(it.get("igst_amount", 0))
            row["camt"] += float(it.get("cgst_amount", 0))
            row["samt"] += float(it.get("sgst_amount", 0))

    fp = start.strftime("%m%Y")
    gstn_json = {
        "gstin": company.get("gstin", ""),
        "fp": fp,
        "gt": round(sum(i.get("totals", {}).get("grand_total", 0) for i in invs), 2),
        "cur_gt": round(sum(i.get("totals", {}).get("grand_total", 0) for i in invs), 2),
        "b2b": list(b2b.values()),
        "b2cl": b2cl,
        "b2cs": list(b2cs.values()),
        "hsn": {"data": list(hsn_rows.values())},
    }
    summary = {
        "period": fp,
        "invoices_count": len(invs),
        "b2b_count": sum(len(v["inv"]) for v in b2b.values()),
        "b2cl_count": sum(len(v["inv"]) for v in b2cl),
        "b2cs_count": len(b2cs),
        "hsn_lines": len(hsn_rows),
        "total_taxable": round(sum(i.get("totals", {}).get("taxable", 0) for i in invs), 2),
        "total_cgst": round(sum(i.get("totals", {}).get("cgst", 0) for i in invs), 2),
        "total_sgst": round(sum(i.get("totals", {}).get("sgst", 0) for i in invs), 2),
        "total_igst": round(sum(i.get("totals", {}).get("igst", 0) for i in invs), 2),
        "total_value": gstn_json["gt"],
    }
    return {"summary": summary, "json": gstn_json}

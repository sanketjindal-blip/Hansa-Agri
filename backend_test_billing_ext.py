"""HANSA Billing Phase 3+4+5(stub)+7 backend regression.

Tests the new endpoints under /api/admin/billing/*:
  • Vendors (Phase 4)
  • Delivery Challans (Phase 3)
  • Gate Passes (Phase 3)
  • Purchase Orders (Phase 4)
  • e-Way Bill stub (Phase 5)
  • Reports (Phase 7)
  • Auth gating

Uses admin OTP login (+919045666666) with OTP pulled from MongoDB.
"""
from __future__ import annotations

import os
import sys
import json
import requests

BASE = os.environ.get("BASE_URL", "https://farm-gear-hub-4.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

results = []


def log(ok_, name, detail=""):
    status = "PASS" if ok_ else "FAIL"
    marker = "[+]" if ok_ else "[X]"
    line = f"{marker} {status}: {name}" + (f" -- {detail}" if detail else "")
    print(line)
    results.append((ok_, name, detail))


def _req(method, path, token=None, **kw):
    h = kw.pop("headers", {}) or {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.request(method, API + path, headers=h, timeout=60, **kw)


def get(p, t=None, **kw): return _req("GET", p, t, **kw)
def post(p, t=None, **kw): return _req("POST", p, t, **kw)
def put(p, t=None, **kw): return _req("PUT", p, t, **kw)
def patch(p, t=None, **kw): return _req("PATCH", p, t, **kw)
def delete(p, t=None, **kw): return _req("DELETE", p, t, **kw)


def otp_login(phone):
    r = post("/auth/send-otp", json={"phone": phone})
    if r.status_code != 200:
        raise RuntimeError(f"send-otp failed: {r.status_code} {r.text}")
    from pymongo import MongoClient
    mc = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    db = mc[os.environ.get("DB_NAME", "rkai_app")]
    norm = phone if phone.startswith("+") else ("+91" + phone.lstrip("0"))
    doc = db.otps.find_one({"phone": norm}, sort=[("created_at", -1)])
    if not doc:
        doc = db.otps.find_one({"phone": phone}, sort=[("created_at", -1)])
    if not doc:
        raise RuntimeError(f"OTP for {phone} not found in DB")
    code = doc.get("code") or doc.get("otp")
    r2 = post("/auth/verify-otp", json={"phone": phone, "otp": code})
    if r2.status_code != 200:
        raise RuntimeError(f"verify-otp failed: {r2.status_code} {r2.text}")
    return r2.json()["access_token"], r2.json()["user"]


def customer_login_email(email, password):
    r = post("/auth/login", json={"email": email, "password": password})
    if r.status_code != 200:
        return None, None
    j = r.json()
    return j["access_token"], j["user"]


def main():
    print(f"Running Billing-Extended tests against: {API}\n")

    # ---- Admin auth ----
    admin_tok, admin_user = otp_login("+919045666666")
    log(admin_user.get("role") == "admin", "AUTH) Admin OTP login",
        f"role={admin_user.get('role')}")

    # ---- Customer token (legacy email) for 403 gating ----
    cust_tok, cust_user = customer_login_email("ramesh@farm.com", "farmer123")
    log(bool(cust_tok) and cust_user.get("role") == "customer",
        "AUTH) Customer legacy login",
        f"role={cust_user.get('role') if cust_user else 'none'}")

    # ═══════════════════════════════════════════════════════════
    # A) VENDORS (Phase 4)
    # ═══════════════════════════════════════════════════════════
    print("\n===== A) VENDORS =====")
    r = get("/admin/billing/vendors", admin_tok)
    log(r.status_code == 200 and isinstance(r.json(), list),
        "A1) GET /vendors 200 list", f"{r.status_code}")

    vendor_body = {
        "name": "Acme Steels Pvt Ltd",
        "gstin": "27ABCDE1234F1Z5",
        "phone": "9988776655",
        "city": "Mumbai",
        "state_code": "27",
    }
    r = post("/admin/billing/vendors", admin_tok, json=vendor_body)
    ok = r.status_code == 200
    vendor = r.json() if ok else {}
    log(ok, "A2) POST /vendors valid",
        f"{r.status_code} {r.text[:160] if not ok else ''}")
    log(vendor.get("state_code") == "27",
        "A3) vendor state_code=27", f"state_code={vendor.get('state_code')}")
    log(vendor.get("pan") == "ABCDE1234F",
        "A4) vendor pan auto-derived from GSTIN", f"pan={vendor.get('pan')}")
    log(vendor.get("gstin") == "27ABCDE1234F1Z5",
        "A5) vendor gstin persisted", f"gstin={vendor.get('gstin')}")
    vendor_id = vendor.get("id", "")

    # Invalid GSTIN
    r = post("/admin/billing/vendors", admin_tok,
             json={"name": "Bad Co", "gstin": "BADGSTIN"})
    log(r.status_code == 400, "A6) POST /vendors invalid GSTIN → 400",
        f"{r.status_code}")

    # PATCH phone
    if vendor_id:
        r = patch(f"/admin/billing/vendors/{vendor_id}", admin_tok,
                  json={"name": vendor["name"], "phone": "9000000000",
                        "gstin": vendor["gstin"]})
        ok = r.status_code == 200 and r.json().get("phone") == "9000000000"
        log(ok, "A7) PATCH /vendors/{id} phone updated",
            f"{r.status_code} phone={r.json().get('phone') if r.status_code==200 else '?'}")

    # List contains it
    r = get("/admin/billing/vendors", admin_tok)
    contains = any(v.get("id") == vendor_id for v in r.json()) if r.status_code == 200 else False
    log(contains, "A8) GET /vendors contains created vendor")

    # Delete
    if vendor_id:
        r = delete(f"/admin/billing/vendors/{vendor_id}", admin_tok)
        log(r.status_code == 200 and r.json().get("ok") is True,
            "A9) DELETE /vendors/{id} → 200 {ok:true}",
            f"{r.status_code} body={r.text[:120]}")

    # ═══════════════════════════════════════════════════════════
    # B) DELIVERY CHALLANS (Phase 3)
    # ═══════════════════════════════════════════════════════════
    print("\n===== B) DELIVERY CHALLANS =====")
    # Ensure a UP customer (state_code=09) to validate intra-state DC totals.
    r = get("/admin/billing/customers", admin_tok)
    all_customers = r.json() if r.status_code == 200 else []
    up_cust = next(
        (c for c in all_customers if (c.get("billing_state_code") == "09"
                                       or (c.get("gstin") or "").startswith("09"))),
        None,
    )
    if not up_cust:
        r = post("/admin/billing/customers", admin_tok, json={
            "name": "Ramesh Singh Farms",
            "gstin": "09ABCDE1234F1Z5",
            "phone": "9870011223",
            "billing_address_line1": "Village Machra",
            "billing_city": "Meerut",
            "billing_state": "Uttar Pradesh",
            "billing_state_code": "09",
        })
        if r.status_code == 200:
            up_cust = r.json()
    if not up_cust:
        log(False, "B0) UP customer available",
            f"could not create; last={r.status_code} {r.text[:160]}")
        return summarize()
    cust = up_cust
    cust_id = cust["id"]
    log(True, "B0) customer for DC ready", f"id={cust_id} name={cust.get('name')}")

    # POST DC w/ GST (sale, UP→UP intra-state)
    dc_body = {
        "customer_id": cust_id,
        "items": [{"name": "Tiller TMX-50", "hsn_code": "843290",
                   "qty": 2, "unit": "NOS", "rate": 48500, "gst_rate": 5}],
        "purpose": "sale",
        "apply_gst": True,
        "vehicle_no": "UP14AB1234",
        "driver_name": "Ramesh",
        "transport_mode": "Road",
    }
    r = post("/admin/billing/delivery-challans", admin_tok, json=dc_body)
    ok = r.status_code == 200
    dc1 = r.json() if ok else {}
    log(ok, "B1) POST /delivery-challans (apply_gst=true) 200",
        f"{r.status_code} {r.text[:200] if not ok else ''}")
    log("/DC/" in dc1.get("number", ""),
        "B2) DC number contains '/DC/'", f"number={dc1.get('number')}")
    totals = dc1.get("totals") or {}
    log(totals.get("intra_state") is True,
        "B3) DC totals.intra_state=true (UP→UP)",
        f"intra_state={totals.get('intra_state')}")
    log(totals.get("grand_total", 0) > 0 and totals.get("cgst", 0) > 0,
        "B4) DC totals computed (grand_total + cgst>0)",
        f"grand={totals.get('grand_total')} cgst={totals.get('cgst')}")
    dc1_id = dc1.get("id", "")

    # POST DC w/o GST (job-work)
    dc2_body = {
        "customer_id": cust_id,
        "items": [{"name": "Tiller TMX-50", "hsn_code": "843290",
                   "qty": 2, "unit": "NOS", "rate": 48500, "gst_rate": 5}],
        "purpose": "job-work",
        "apply_gst": False,
    }
    r = post("/admin/billing/delivery-challans", admin_tok, json=dc2_body)
    ok = r.status_code == 200
    dc2 = r.json() if ok else {}
    log(ok, "B5) POST /delivery-challans apply_gst=false 200",
        f"{r.status_code} {r.text[:180] if not ok else ''}")
    totals2 = dc2.get("totals") or {}
    log(totals2.get("cgst", -1) == 0 and totals2.get("sgst", -1) == 0 and totals2.get("igst", -1) == 0,
        "B6) job-work DC: cgst=sgst=igst=0",
        f"cgst={totals2.get('cgst')} sgst={totals2.get('sgst')} igst={totals2.get('igst')}")
    expected = 2 * 48500
    log(abs(totals2.get("grand_total", 0) - expected) < 0.01,
        "B7) job-work DC grand_total = qty*rate (97000)",
        f"grand={totals2.get('grand_total')}")
    dc2_id = dc2.get("id", "")

    # List contains both
    r = get("/admin/billing/delivery-challans", admin_tok)
    ids = [d.get("id") for d in r.json()] if r.status_code == 200 else []
    log(dc1_id in ids and dc2_id in ids,
        "B8) GET /delivery-challans list contains both")

    # PDF
    if dc1_id:
        r = get(f"/admin/billing/delivery-challans/{dc1_id}/pdf", admin_tok)
        ct = r.headers.get("content-type", "")
        log(r.status_code == 200 and "application/pdf" in ct and r.content.startswith(b"%PDF-") and len(r.content) > 1000,
            "B9) GET /delivery-challans/{id}/pdf 200 PDF >1KB",
            f"{r.status_code} ct={ct} len={len(r.content)} head={r.content[:8]!r}")

    # Delete one (dc2)
    if dc2_id:
        r = delete(f"/admin/billing/delivery-challans/{dc2_id}", admin_tok)
        log(r.status_code == 200 and r.json().get("ok") is True,
            "B10) DELETE /delivery-challans/{id} 200",
            f"{r.status_code}")

    # ═══════════════════════════════════════════════════════════
    # C) GATE PASSES (Phase 3)
    # ═══════════════════════════════════════════════════════════
    print("\n===== C) GATE PASSES =====")
    gp1_body = {"ref_type": "delivery_challan", "ref_id": dc1_id, "direction": "outward"}
    r = post("/admin/billing/gate-passes", admin_tok, json=gp1_body)
    ok = r.status_code == 200
    gp1 = r.json() if ok else {}
    log(ok, "C1) POST /gate-passes (ref=DC) 200",
        f"{r.status_code} {r.text[:180] if not ok else ''}")
    log("/GP/" in gp1.get("number", ""),
        "C2) GP number contains '/GP/'", f"number={gp1.get('number')}")
    log(bool(gp1.get("party_name")),
        "C3) GP party_name auto-pulled from DC.buyer",
        f"party_name={gp1.get('party_name')}")
    log(bool(gp1.get("items_summary")),
        "C4) GP items_summary auto-populated",
        f"items_summary={(gp1.get('items_summary') or '')[:60]}")
    log(gp1.get("vehicle_no") == "UP14AB1234",
        "C5) GP vehicle_no inherited from DC",
        f"vehicle_no={gp1.get('vehicle_no')}")
    gp1_id = gp1.get("id", "")

    # Manual GP
    gp2_body = {"ref_type": "manual", "direction": "outward",
                "party_name": "Test Co", "items_summary": "5 cartons",
                "vehicle_no": "UP14XY1234"}
    r = post("/admin/billing/gate-passes", admin_tok, json=gp2_body)
    ok = r.status_code == 200
    gp2 = r.json() if ok else {}
    log(ok, "C6) POST /gate-passes (manual) 200",
        f"{r.status_code} {r.text[:180] if not ok else ''}")
    log(gp2.get("party_name") == "Test Co" and gp2.get("items_summary") == "5 cartons",
        "C7) manual GP fields persisted")
    gp2_id = gp2.get("id", "")

    # List contains both
    r = get("/admin/billing/gate-passes", admin_tok)
    ids = [g.get("id") for g in r.json()] if r.status_code == 200 else []
    log(gp1_id in ids and gp2_id in ids,
        "C8) GET /gate-passes list contains both")

    # PDF
    if gp1_id:
        r = get(f"/admin/billing/gate-passes/{gp1_id}/pdf", admin_tok)
        ct = r.headers.get("content-type", "")
        log(r.status_code == 200 and "application/pdf" in ct and r.content.startswith(b"%PDF-"),
            "C9) GET /gate-passes/{id}/pdf application/pdf %PDF-",
            f"{r.status_code} ct={ct} len={len(r.content)}")

    # ═══════════════════════════════════════════════════════════
    # D) PURCHASE ORDERS (Phase 4)
    # ═══════════════════════════════════════════════════════════
    print("\n===== D) PURCHASE ORDERS =====")
    # Recreate the vendor (since deleted in A9)
    r = post("/admin/billing/vendors", admin_tok, json=vendor_body)
    ok = r.status_code == 200
    po_vendor = r.json() if ok else {}
    log(ok, "D0) re-create Acme vendor for PO",
        f"{r.status_code} id={po_vendor.get('id')}")
    po_vendor_id = po_vendor.get("id", "")

    po_body = {
        "vendor_id": po_vendor_id,
        "items": [{"name": "MS Plate", "hsn_code": "7208",
                   "qty": 100, "unit": "KG", "rate": 80, "gst_rate": 18}],
        "expected_delivery": "2026-06-15",
    }
    r = post("/admin/billing/purchase-orders", admin_tok, json=po_body)
    ok = r.status_code == 200
    po = r.json() if ok else {}
    log(ok, "D1) POST /purchase-orders 200",
        f"{r.status_code} {r.text[:200] if not ok else ''}")
    log("/PO/" in po.get("number", ""),
        "D2) PO number contains '/PO/'", f"number={po.get('number')}")
    po_totals = po.get("totals") or {}
    log(po_totals.get("intra_state") is False,
        "D3) PO intra_state=false (MH→UP inter)",
        f"intra_state={po_totals.get('intra_state')}")
    # 100*80=8000 * 18% = 1440 IGST
    log(abs(po_totals.get("igst", 0) - 1440) < 0.5 and po_totals.get("cgst", 0) == 0 and po_totals.get("sgst", 0) == 0,
        "D4) PO IGST=1440, CGST=0, SGST=0",
        f"igst={po_totals.get('igst')} cgst={po_totals.get('cgst')} sgst={po_totals.get('sgst')}")
    po_id = po.get("id", "")

    r = get("/admin/billing/purchase-orders", admin_tok)
    ids = [p.get("id") for p in r.json()] if r.status_code == 200 else []
    log(po_id in ids, "D5) GET /purchase-orders list contains it")

    if po_id:
        r = get(f"/admin/billing/purchase-orders/{po_id}/pdf", admin_tok)
        ct = r.headers.get("content-type", "")
        log(r.status_code == 200 and "application/pdf" in ct and r.content.startswith(b"%PDF-"),
            "D6) GET /purchase-orders/{id}/pdf application/pdf %PDF-",
            f"{r.status_code} ct={ct} len={len(r.content)}")

    # ═══════════════════════════════════════════════════════════
    # E) e-WAY BILL stub (Phase 5)
    # ═══════════════════════════════════════════════════════════
    print("\n===== E) e-WAY BILL STUB =====")
    # Get/create an invoice
    r = get("/admin/billing/invoices", admin_tok)
    invs = r.json() if r.status_code == 200 else []
    if not invs:
        # Create one
        r = post("/admin/billing/invoices", admin_tok, json={
            "customer_id": cust_id,
            "items": [{"name": "Tiller TMX-50", "hsn_code": "843290",
                       "qty": 1, "unit": "NOS", "rate": 48500, "gst_rate": 5}],
        })
        if r.status_code == 200:
            invs = [r.json()]
    if invs:
        iid = invs[0]["id"]
        log(True, "E0) invoice available for eway test", f"iid={iid}")

        eway_body = {"eway_bill_no": "171234567890",
                     "eway_bill_date": "2026-05-03",
                     "vehicle_no": "UP14AB1234",
                     "transport_mode": "Road"}
        r = post(f"/admin/billing/invoices/{iid}/eway-bill", admin_tok, json=eway_body)
        ok = r.status_code == 200
        inv_after = r.json() if ok else {}
        log(ok, "E1) POST /invoices/{iid}/eway-bill 200",
            f"{r.status_code} {r.text[:180] if not ok else ''}")
        log(inv_after.get("eway_bill_no") == "171234567890",
            "E2) invoice.eway_bill_no persisted",
            f"={inv_after.get('eway_bill_no')}")
        log(inv_after.get("eway_bill_status") == "manual",
            "E3) invoice.eway_bill_status='manual'",
            f"={inv_after.get('eway_bill_status')}")

        # Generate (stub → 503)
        r = post(f"/admin/billing/invoices/{iid}/generate-eway", admin_tok)
        log(r.status_code == 503 and "GSP not configured" in r.text,
            "E4) POST /generate-eway → 503 'GSP not configured'",
            f"{r.status_code} body={r.text[:200]}")

        # Non-existent
        r = post("/admin/billing/invoices/non-existent-id/eway-bill",
                 admin_tok, json=eway_body)
        log(r.status_code == 404, "E5) non-existent invoice id → 404",
            f"{r.status_code}")
    else:
        log(False, "E0) invoice creation for eway test failed — skipping E1-E5")

    # ═══════════════════════════════════════════════════════════
    # F) REPORTS (Phase 7)
    # ═══════════════════════════════════════════════════════════
    print("\n===== F) REPORTS =====")
    r = get("/admin/billing/reports/sales-register", admin_tok)
    ok = r.status_code == 200
    sr = r.json() if ok else {}
    log(ok, "F1) GET /reports/sales-register 200",
        f"{r.status_code} {r.text[:180] if not ok else ''}")
    if ok:
        totals = sr.get("totals") or {}
        needed = {"taxable", "cgst", "sgst", "igst", "grand_total", "count"}
        log(isinstance(sr.get("rows"), list) and needed.issubset(totals.keys()),
            "F2) sales-register has rows[] + totals{taxable,cgst,sgst,igst,grand_total,count}",
            f"keys={sorted(totals.keys())}")

    # Empty window
    r = get("/admin/billing/reports/sales-register?date_from=1900-01-01&date_to=1900-01-02",
            admin_tok)
    ok = r.status_code == 200
    sr_empty = r.json() if ok else {}
    log(ok and len(sr_empty.get("rows", [1])) == 0 and sr_empty.get("totals", {}).get("count") == 0,
        "F3) sales-register empty window → empty rows, zero totals",
        f"{r.status_code} rows={len(sr_empty.get('rows', [])) if ok else '-'}")

    # Customer ledger — valid
    r = get(f"/admin/billing/reports/customer-ledger?customer_id={cust_id}", admin_tok)
    ok = r.status_code == 200
    led = r.json() if ok else {}
    log(ok, "F4) GET /reports/customer-ledger?customer_id=<valid> 200",
        f"{r.status_code} {r.text[:180] if not ok else ''}")
    if ok:
        entries = led.get("entries", [])
        sorted_ok = all(
            (entries[i].get("date") or "") <= (entries[i + 1].get("date") or "")
            for i in range(len(entries) - 1)
        )
        log(bool(led.get("customer")) and isinstance(entries, list)
            and isinstance(led.get("summary"), dict) and sorted_ok,
            "F5) customer-ledger has customer + entries[] sorted by date + summary",
            f"n_entries={len(entries)} summary_keys={sorted((led.get('summary') or {}).keys())}")

    # Customer ledger — invalid
    r = get("/admin/billing/reports/customer-ledger?customer_id=invalid-id", admin_tok)
    log(r.status_code == 404 and "not found" in r.text.lower(),
        "F6) customer-ledger invalid id → 404",
        f"{r.status_code} body={r.text[:120]}")

    # Aging
    r = get("/admin/billing/reports/aging", admin_tok)
    ok = r.status_code == 200
    aging = r.json() if ok else {}
    log(ok, "F7) GET /reports/aging 200", f"{r.status_code}")
    if ok:
        buckets = aging.get("buckets") or {}
        log(isinstance(aging.get("rows"), list)
            and set(buckets.keys()) == {"0-30", "31-60", "61-90", "90+"}
            and isinstance(aging.get("total_outstanding"), (int, float)),
            "F8) aging has rows[], buckets {0-30,31-60,61-90,90+}, total_outstanding numeric",
            f"buckets_keys={sorted(buckets.keys())} total={aging.get('total_outstanding')}")

    # GSTR1 with explicit period
    r = get("/admin/billing/reports/gstr1?period=052026", admin_tok)
    ok = r.status_code == 200
    g1 = r.json() if ok else {}
    log(ok, "F9) GET /reports/gstr1?period=052026 200", f"{r.status_code}")
    if ok:
        summary = g1.get("summary") or {}
        jj = g1.get("json") or {}
        summary_ok = summary.get("period") == "052026" and "invoices_count" in summary and "b2b_count" in summary
        json_ok = (jj.get("fp") == "052026"
                   and "gstin" in jj
                   and isinstance(jj.get("b2b"), list)
                   and isinstance(jj.get("b2cl"), list)
                   and isinstance(jj.get("b2cs"), list)
                   and isinstance(jj.get("hsn"), dict)
                   and isinstance(jj.get("hsn", {}).get("data"), list))
        log(summary_ok, "F10) gstr1 summary has {period,invoices_count,b2b_count,...}",
            f"summary={ {k: summary.get(k) for k in ('period','invoices_count','b2b_count')} }")
        log(json_ok, "F11) gstr1 json has {gstin, fp, b2b[], b2cl[], b2cs[], hsn.data[]}",
            f"fp={jj.get('fp')} gstin={jj.get('gstin')!r} b2b_type={type(jj.get('b2b')).__name__}")

    # GSTR1 default period
    r = get("/admin/billing/reports/gstr1", admin_tok)
    ok = r.status_code == 200
    g_def = r.json() if ok else {}
    log(ok, "F12) GET /reports/gstr1 (no period) 200", f"{r.status_code}")
    if ok:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        expected_fp = now.strftime("%m%Y")
        log((g_def.get("summary") or {}).get("period") == expected_fp
            and (g_def.get("json") or {}).get("fp") == expected_fp,
            "F13) gstr1 default period = current month (MMYYYY)",
            f"expected={expected_fp} got_summary={(g_def.get('summary') or {}).get('period')} got_json={(g_def.get('json') or {}).get('fp')}")

    # ═══════════════════════════════════════════════════════════
    # G) AUTH GATING
    # ═══════════════════════════════════════════════════════════
    print("\n===== G) AUTH GATING =====")
    unauth_endpoints = [
        ("GET", "/admin/billing/vendors"),
        ("GET", "/admin/billing/delivery-challans"),
        ("GET", "/admin/billing/gate-passes"),
        ("GET", "/admin/billing/purchase-orders"),
        ("GET", "/admin/billing/reports/sales-register"),
        ("GET", "/admin/billing/reports/aging"),
        ("GET", "/admin/billing/reports/gstr1"),
    ]
    for method, p in unauth_endpoints:
        r = _req(method, p)
        log(r.status_code in (401, 403),
            f"G-noauth) {method} {p} no-token → 401/403",
            f"{r.status_code}")

    # Customer token 403 on 4+ representative endpoints
    if cust_tok:
        cust_checks = [
            ("GET", "/admin/billing/vendors"),
            ("GET", "/admin/billing/delivery-challans"),
            ("GET", "/admin/billing/purchase-orders"),
            ("GET", "/admin/billing/reports/sales-register"),
        ]
        for method, p in cust_checks:
            r = _req(method, p, cust_tok)
            log(r.status_code == 403,
                f"G-cust) customer {method} {p} → 403",
                f"{r.status_code}")

    # Cleanup — delete recreated vendor + PO
    if po_id:
        delete(f"/admin/billing/purchase-orders/{po_id}", admin_tok)
    if po_vendor_id:
        delete(f"/admin/billing/vendors/{po_vendor_id}", admin_tok)
    if dc1_id:
        delete(f"/admin/billing/delivery-challans/{dc1_id}", admin_tok)

    return summarize()


def summarize():
    total = len(results)
    passed = sum(1 for r in results if r[0])
    failed = total - passed
    print("\n" + "=" * 60)
    print(f"TOTAL: {total}  PASS: {passed}  FAIL: {failed}")
    if failed:
        print("\nFAILURES:")
        for ok, n, d in results:
            if not ok:
                print(f"  [X] {n} -- {d}")
    return failed == 0


if __name__ == "__main__":
    ok = main()
    sys.exit(0 if ok else 1)

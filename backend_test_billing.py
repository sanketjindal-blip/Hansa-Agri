"""HANSA Billing Phase 1+2 backend smoke test."""
import os
import sys
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
    return requests.request(method, API + path, headers=h, timeout=30, **kw)


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
    print(f"Running HANSA Billing test against: {API}\n")

    # ---- Auth ----
    admin_tok, admin_user = otp_login("+919045666666")
    log(admin_user.get("role") == "admin", "A0) Admin OTP login", f"role={admin_user.get('role')}")

    # ========== A) Company settings ==========
    r = get("/admin/billing/company", admin_tok)
    if r.status_code != 200:
        log(False, "A1) GET /admin/billing/company 200", f"{r.status_code} {r.text[:200]}")
        print("Fatal: cannot continue without company defaults. Aborting.")
        return summarize()
    c = r.json()
    log(r.status_code == 200, "A1) GET /admin/billing/company 200")
    log(c.get("legal_name") == "RAMKISHAN AGRI INNOVATE PRIVATE LIMITED",
        "A2) company legal_name default", f"legal_name={c.get('legal_name')}")
    log(c.get("gstin") == "09AAOCR7303L1ZU", "A3) company gstin default",
        f"gstin={c.get('gstin')}")
    log(c.get("state_code") == "09", "A4) company state_code default",
        f"state_code={c.get('state_code')}")
    log(c.get("city") == "Meerut", "A5) company city default",
        f"city={c.get('city')}")

    # PUT with edited fields
    body = {
        "legal_name": "RAMKISHAN AGRI INNOVATE PRIVATE LIMITED",
        "gstin": "09AAOCR7303L1ZU",
        "trade_name": "RAMKISHAN",
        "default_terms": "Meerut jurisdiction",
    }
    r = put("/admin/billing/company", admin_tok, json=body)
    log(r.status_code == 200, "A6) PUT /admin/billing/company 200",
        f"{r.status_code}")
    if r.status_code == 200:
        cu = r.json()
        log(cu.get("trade_name") == "RAMKISHAN" and cu.get("default_terms") == "Meerut jurisdiction",
            "A7) PUT updated fields persisted",
            f"trade_name={cu.get('trade_name')} terms={cu.get('default_terms')}")

    # Invalid GSTIN
    r = put("/admin/billing/company", admin_tok,
            json={"legal_name": "X", "gstin": "INVALID"})
    log(r.status_code == 400, "A8) PUT invalid GSTIN -> 400", f"{r.status_code}")

    # ========== B) Customer master ==========
    c1_body = {
        "name": "Sharma Tractor House",
        "gstin": "09ABCDE1234F1Z5",
        "phone": "+919876543210",
        "billing_address_line1": "Main Road",
        "billing_city": "Meerut",
        "billing_state": "Uttar Pradesh",
        "billing_state_code": "09",
        "billing_pincode": "250001",
    }
    r = post("/admin/billing/customers", admin_tok, json=c1_body)
    log(r.status_code == 200, "B1) POST customer UP 200", f"{r.status_code} {r.text[:150]}")
    if r.status_code != 200:
        return summarize()
    c1 = r.json()
    log(bool(c1.get("id")), "B2) customer has id", f"id={c1.get('id')}")
    log(c1.get("billing_state_code") == "09", "B3) customer UP state_code=09",
        f"billing_state_code={c1.get('billing_state_code')}")
    log(c1.get("pan") == "ABCDE1234F", "B4) customer pan derived from GSTIN",
        f"pan={c1.get('pan')}")

    c2_body = {
        "name": "Mumbai Agri Works",
        "gstin": "27ABCDE1234F1Z5",
        "phone": "+919900000002",
        "billing_address_line1": "Andheri East",
        "billing_city": "Mumbai",
        "billing_state": "Maharashtra",
        "billing_state_code": "27",
        "billing_pincode": "400069",
    }
    r = post("/admin/billing/customers", admin_tok, json=c2_body)
    log(r.status_code == 200, "B5) POST customer MH 200", f"{r.status_code}")
    c2 = r.json() if r.status_code == 200 else {}
    log(c2.get("billing_state_code") == "27", "B6) customer MH state_code=27",
        f"billing_state_code={c2.get('billing_state_code')}")

    # Invalid GSTIN
    bad = dict(c1_body); bad["gstin"] = "INVALID"; bad["name"] = "Bad Customer"
    r = post("/admin/billing/customers", admin_tok, json=bad)
    log(r.status_code == 400, "B7) POST invalid GSTIN -> 400", f"{r.status_code}")

    # List
    r = get("/admin/billing/customers", admin_tok)
    log(r.status_code == 200, "B8) GET customers 200", f"{r.status_code}")
    listing = r.json() if r.status_code == 200 else []
    ids = {x.get("id") for x in listing}
    log(c1["id"] in ids and c2.get("id") in ids, "B9) List contains both customers",
        f"count={len(listing)}")

    # Patch (edit c2)
    r = patch(f"/admin/billing/customers/{c2['id']}", admin_tok,
              json={**c2_body, "phone": "+919900000099"})
    log(r.status_code == 200, "B10) PATCH customer 200", f"{r.status_code}")
    if r.status_code == 200:
        log(r.json().get("phone") == "+919900000099",
            "B11) PATCH updated phone", f"phone={r.json().get('phone')}")

    # Delete (we'll delete c2 at end; create a throwaway for delete test)
    tmp_body = dict(c1_body); tmp_body["name"] = "Throwaway Cust"; tmp_body["gstin"] = ""
    tmp_body["phone"] = "+919900000003"
    r = post("/admin/billing/customers", admin_tok, json=tmp_body)
    if r.status_code == 200:
        tmp_id = r.json()["id"]
        r = delete(f"/admin/billing/customers/{tmp_id}", admin_tok)
        log(r.status_code == 200, "B12) DELETE customer 200", f"{r.status_code}")

    # ========== C) Catalog items helper ==========
    r = get("/admin/billing/catalog-items", admin_tok)
    log(r.status_code == 200, "C1) GET catalog-items 200", f"{r.status_code}")
    items = r.json() if r.status_code == 200 else []
    log(isinstance(items, list) and len(items) > 0,
        "C2) catalog-items is non-empty list", f"count={len(items)}")
    if items:
        sample = items[0]
        required = {"hsn_code", "gst_rate", "unit", "rate"}
        missing = required - set(sample.keys())
        log(not missing, "C3) each item has hsn_code/gst_rate/unit/rate",
            f"missing={missing} sample_keys={list(sample.keys())}")

    # ========== D) Quotation ==========
    # Use c1 (UP). supplier state_code = 09, customer_state_code = 09, so intra_state true.
    quo_body = {
        "customer_id": c1["id"],
        "items": [{
            "name": "Tiller TX-50",
            "hsn_code": "843290",
            "qty": 2,
            "unit": "NOS",
            "rate": 50000,
            "discount_pct": 5,
            "gst_rate": 5,
        }],
    }
    r = post("/admin/billing/quotations", admin_tok, json=quo_body)
    log(r.status_code == 200, "D1) POST quotation 200", f"{r.status_code} {r.text[:200]}")
    if r.status_code != 200:
        return summarize()
    quo = r.json()
    import re as _re
    num_ok = bool(_re.match(r"^HANSA/\d{4}-\d{2}/QUO/\d{4}$", quo.get("number", "")))
    log(num_ok, "D2) quotation number format HANSA/FY/QUO/NNNN",
        f"number={quo.get('number')}")
    totals = quo.get("totals") or {}
    log(totals.get("intra_state") is True, "D3) totals.intra_state=true (UP->UP)",
        f"intra_state={totals.get('intra_state')}")
    log((totals.get("cgst") or 0) > 0 and (totals.get("sgst") or 0) > 0,
        "D4) CGST > 0 and SGST > 0",
        f"cgst={totals.get('cgst')} sgst={totals.get('sgst')}")
    log((totals.get("igst") or 0) == 0, "D5) IGST == 0",
        f"igst={totals.get('igst')}")
    aiw = totals.get("amount_in_words") or ""
    log(bool(aiw) and "Rupees" in aiw, "D6) amount_in_words non-empty Indian English",
        f"amount_in_words={aiw!r}")

    # List quotations
    r = get("/admin/billing/quotations", admin_tok)
    log(r.status_code == 200 and any(q.get("id") == quo["id"] for q in r.json()),
        "D7) GET quotations contains created", f"count={len(r.json()) if r.status_code==200 else 'ERR'}")

    # PDF
    r = get(f"/admin/billing/quotations/{quo['id']}/pdf", admin_tok)
    ctype = r.headers.get("content-type", "")
    log(r.status_code == 200 and "application/pdf" in ctype and len(r.content) > 500,
        "D8) GET quotation PDF 200 + application/pdf + non-empty",
        f"status={r.status_code} ctype={ctype} size={len(r.content)}")

    # Convert
    r = post(f"/admin/billing/quotations/{quo['id']}/convert", admin_tok)
    log(r.status_code == 200, "D9) POST convert 200", f"{r.status_code}")
    inv0 = r.json() if r.status_code == 200 else {}
    inv_num_ok = bool(_re.match(r"^HANSA/\d{4}-\d{2}/INV/\d{4}$", inv0.get("number", "")))
    log(inv_num_ok, "D10) invoice number format HANSA/FY/INV/NNNN",
        f"number={inv0.get('number')}")
    # Verify first INV is 0001 if this is fresh FY; but just assert format. Also confirm status=converted
    r = get(f"/admin/billing/quotations/{quo['id']}", admin_tok)
    log(r.status_code == 200 and r.json().get("status") == "converted",
        "D11) quotation status=converted",
        f"status={r.json().get('status') if r.status_code==200 else 'ERR'}")

    # ========== E) Tax Invoice (direct create, inter-state) ==========
    inv_body = {
        "customer_id": c2["id"],
        "items": [{
            "name": "Plough",
            "hsn_code": "843290",
            "qty": 1,
            "unit": "NOS",
            "rate": 30000,
            "gst_rate": 18,
        }],
        "po_number": "PO/2025/001",
        "vehicle_no": "UP14AB1234",
    }
    r = post("/admin/billing/invoices", admin_tok, json=inv_body)
    log(r.status_code == 200, "E1) POST invoice (inter-state) 200",
        f"{r.status_code} {r.text[:200]}")
    if r.status_code != 200:
        return summarize()
    inv = r.json()
    tot = inv.get("totals") or {}
    log(tot.get("intra_state") is False, "E2) totals.intra_state=false (UP->MH)",
        f"intra_state={tot.get('intra_state')}")
    log((tot.get("igst") or 0) > 0, "E3) IGST > 0", f"igst={tot.get('igst')}")
    log((tot.get("cgst") or 0) == 0 and (tot.get("sgst") or 0) == 0,
        "E4) CGST == 0 and SGST == 0",
        f"cgst={tot.get('cgst')} sgst={tot.get('sgst')}")
    inv_num_ok = bool(_re.match(r"^HANSA/\d{4}-\d{2}/INV/\d{4}$", inv.get("number", "")))
    log(inv_num_ok, "E5) invoice number format", f"number={inv.get('number')}")
    # Extract seq and confirm increment (must be > inv0 seq)
    try:
        seq0 = int(inv0["number"].split("/")[-1])
        seq1 = int(inv["number"].split("/")[-1])
        log(seq1 == seq0 + 1, "E6) INV sequence incremented by 1",
            f"prev={seq0} now={seq1}")
    except Exception as e:
        log(False, "E6) INV sequence increment check", f"err={e}")

    # PDF
    r = get(f"/admin/billing/invoices/{inv['id']}/pdf", admin_tok)
    ctype = r.headers.get("content-type", "")
    log(r.status_code == 200 and "application/pdf" in ctype and len(r.content) > 500,
        "E7) GET invoice PDF 200 + pdf + non-empty",
        f"status={r.status_code} ctype={ctype} size={len(r.content)}")

    # List invoices contains both
    r = get("/admin/billing/invoices", admin_tok)
    if r.status_code == 200:
        ids = {x.get("id") for x in r.json()}
        log(inv0["id"] in ids and inv["id"] in ids,
            "E8) GET invoices contains converted + direct",
            f"count={len(r.json())}")
    else:
        log(False, "E8) GET invoices", f"{r.status_code}")

    # ========== F) Numbering integrity ==========
    # Current last QUO sequence = seq(quo.number). Create 3 quick quotes, confirm increments by 1.
    try:
        last_quo_seq = int(quo["number"].split("/")[-1])
    except Exception:
        last_quo_seq = 0
    quo_seqs = []
    for i in range(3):
        b = {"customer_id": c1["id"],
             "items": [{"name": f"Item {i}", "hsn_code": "843290",
                        "qty": 1, "unit": "NOS", "rate": 1000, "gst_rate": 5}]}
        r = post("/admin/billing/quotations", admin_tok, json=b)
        if r.status_code != 200:
            log(False, f"F{i+1}) POST quick quote #{i+1}",
                f"{r.status_code} {r.text[:120]}")
            break
        n = r.json().get("number", "")
        try:
            quo_seqs.append(int(n.split("/")[-1]))
        except Exception:
            quo_seqs.append(-1)
    expected = [last_quo_seq + 1, last_quo_seq + 2, last_quo_seq + 3]
    log(quo_seqs == expected, "F1) 3 quick QUO sequences increment cleanly",
        f"expected={expected} got={quo_seqs}")

    # ========== G) Negative: non-admin / no auth ==========
    # No auth
    endpoints_get = [
        "/admin/billing/company",
        "/admin/billing/customers",
        "/admin/billing/catalog-items",
        "/admin/billing/quotations",
        "/admin/billing/invoices",
    ]
    for ep in endpoints_get:
        r = get(ep)
        log(r.status_code in (401, 403), f"G1) No-auth GET {ep} -> 401/403",
            f"{r.status_code}")

    # As a customer token (non-admin)
    cust_tok, _ = customer_login_email("ramesh@farm.com", "farmer123")
    if cust_tok:
        for ep in endpoints_get:
            r = get(ep, cust_tok)
            log(r.status_code in (401, 403),
                f"G2) Customer GET {ep} -> 401/403", f"{r.status_code}")
        # POST customer as non-admin
        r = post("/admin/billing/customers", cust_tok, json=c1_body)
        log(r.status_code in (401, 403),
            "G3) Customer POST /admin/billing/customers -> 401/403",
            f"{r.status_code}")
    else:
        log(False, "G2) customer login (ramesh@farm.com)", "login failed — skipping customer-token negatives")

    return summarize()


def summarize():
    passed = sum(1 for r in results if r[0])
    failed = [r for r in results if not r[0]]
    print(f"\n==== SUMMARY: {passed}/{len(results)} passed ====")
    if failed:
        print("FAILURES:")
        for r in failed:
            print(f"  - {r[1]} :: {r[2]}")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())

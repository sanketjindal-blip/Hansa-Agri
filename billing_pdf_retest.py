"""Retest billing PDF endpoints after layout fix."""
import os
import sys
import requests
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

BACKEND_URL = "https://farm-gear-hub-4.preview.emergentagent.com"
API = f"{BACKEND_URL}/api"
ADMIN_PHONE = "+919045666666"

# Load Mongo URL
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "test_database")


async def get_otp(phone):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    doc = await db.otps.find_one({"phone": phone}, sort=[("created_at", -1)])
    client.close()
    return doc["code"] if doc else None


def admin_login():
    r = requests.post(f"{API}/auth/send-otp", json={"phone": ADMIN_PHONE}, timeout=15)
    print(f"send-otp: {r.status_code} {r.text[:120]}")
    code = asyncio.get_event_loop().run_until_complete(get_otp(ADMIN_PHONE))
    print(f"OTP from DB: {code}")
    r = requests.post(f"{API}/auth/verify-otp", json={"phone": ADMIN_PHONE, "otp": code}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def main():
    token = admin_login()
    h = {"Authorization": f"Bearer {token}"}
    results = []

    # Sanity: list endpoints
    rq = requests.get(f"{API}/admin/billing/quotations", headers=h, timeout=15)
    results.append(("LIST quotations", rq.status_code, len(rq.text)))
    quotations = rq.json() if rq.status_code == 200 else []

    ri = requests.get(f"{API}/admin/billing/invoices", headers=h, timeout=15)
    results.append(("LIST invoices", ri.status_code, len(ri.text)))
    invoices = ri.json() if ri.status_code == 200 else []

    print(f"\nFound {len(quotations)} quotations, {len(invoices)} invoices")

    # If no quotation exists, create one
    if not quotations:
        # need a customer first
        rc = requests.get(f"{API}/admin/billing/customers", headers=h, timeout=15)
        customers = rc.json() if rc.status_code == 200 else []
        if not customers:
            cust_payload = {
                "name": "Krishna Traders",
                "phone": "+919812340099",
                "billing_address": "12, Mandi Road",
                "billing_city": "Meerut",
                "billing_state": "Uttar Pradesh",
                "billing_state_code": "09",
                "billing_pincode": "250002",
                "gstin": "09AAOCR7303L1ZU",
            }
            rc2 = requests.post(f"{API}/admin/billing/customers", headers=h, json=cust_payload, timeout=15)
            print(f"create customer: {rc2.status_code} {rc2.text[:200]}")
            customer = rc2.json()
        else:
            customer = customers[0]
        # need product
        rp = requests.get(f"{API}/admin/billing/catalog", headers=h, timeout=15)
        products = rp.json() if rp.status_code == 200 else []
        prod = products[0]
        q_payload = {
            "customer_id": customer["id"],
            "items": [{
                "product_id": prod["id"],
                "name": prod.get("name") or prod.get("title", "Item"),
                "hsn_code": prod.get("hsn_code", "8432"),
                "quantity": 1,
                "rate": prod.get("rate", 50000),
                "gst_rate": prod.get("gst_rate", 5),
                "unit": prod.get("unit", "Nos"),
            }],
            "notes": "Retest quotation",
            "terms": "Standard",
        }
        rcq = requests.post(f"{API}/admin/billing/quotations", headers=h, json=q_payload, timeout=15)
        print(f"create quotation: {rcq.status_code} {rcq.text[:300]}")
        assert rcq.status_code == 200, rcq.text
        quotation = rcq.json()
    else:
        quotation = quotations[0]

    # Quotation PDF
    qid = quotation["id"]
    rqp = requests.get(f"{API}/admin/billing/quotations/{qid}/pdf", headers=h, timeout=30)
    ct_q = rqp.headers.get("Content-Type", "")
    sz_q = len(rqp.content)
    print(f"\nQuotation PDF: status={rqp.status_code}, Content-Type={ct_q}, size={sz_q} bytes")
    if rqp.status_code != 200:
        print(f"BODY: {rqp.text[:500]}")
    results.append(("QUOTATION PDF", rqp.status_code, ct_q, sz_q))

    # Invoice - if none, convert quotation
    if not invoices:
        rconv = requests.post(f"{API}/admin/billing/quotations/{qid}/convert", headers=h, json={}, timeout=15)
        print(f"convert quotation: {rconv.status_code} {rconv.text[:200]}")
        invoice = rconv.json()
    else:
        invoice = invoices[0]

    iid = invoice["id"]
    rip = requests.get(f"{API}/admin/billing/invoices/{iid}/pdf", headers=h, timeout=30)
    ct_i = rip.headers.get("Content-Type", "")
    sz_i = len(rip.content)
    print(f"Invoice PDF: status={rip.status_code}, Content-Type={ct_i}, size={sz_i} bytes")
    if rip.status_code != 200:
        print(f"BODY: {rip.text[:500]}")
    results.append(("INVOICE PDF", rip.status_code, ct_i, sz_i))

    # Verify PDF magic bytes
    if rqp.status_code == 200:
        print(f"Quotation PDF starts with: {rqp.content[:8]}")
    if rip.status_code == 200:
        print(f"Invoice PDF starts with: {rip.content[:8]}")

    print("\n=== SUMMARY ===")
    for r in results:
        print(r)


if __name__ == "__main__":
    main()

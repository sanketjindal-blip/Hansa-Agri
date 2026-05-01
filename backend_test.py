"""HANSA backend regression test suite.

Tests all routes after the modular refactor (routes/*.py).
"""
import os
import sys
import time
import uuid
import json
from typing import Any, Dict, List, Optional

import requests
from pymongo import MongoClient
from dotenv import load_dotenv

# Load backend env for direct Mongo access (only for dealer OTP retrieval)
load_dotenv("/app/backend/.env")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

# Frontend env for public URL
load_dotenv("/app/frontend/.env")
BACKEND_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = BACKEND_URL + "/api"

ADMIN_EMAIL = "admin@rkai.com"
ADMIN_PASSWORD = "admin123"

# unique run identifier so repeated runs don't collide
RUN = uuid.uuid4().hex[:8]
CUSTOMER_EMAIL = f"rahul.kisan.{RUN}@example.in"
CUSTOMER_PASSWORD = "Hansa@2026"

# Phone numbers (10-digit) used for OTP / dealer flows
CUSTOMER_PHONE_10 = "9876" + str(int(time.time()) % 1000000).zfill(6)[-6:]
DEALER_PHONE_10 = "9045" + str((int(time.time()) + 7) % 1000000).zfill(6)[-6:]


results: List[Dict[str, Any]] = []
failures: List[str] = []


def record(name: str, ok: bool, detail: str = ""):
    status = "PASS" if ok else "FAIL"
    print(f"  [{status}] {name}{(' -> ' + detail) if detail else ''}")
    results.append({"name": name, "ok": ok, "detail": detail})
    if not ok:
        failures.append(f"{name}: {detail}")


def hdr(tok: Optional[str] = None) -> Dict[str, str]:
    return {"Authorization": f"Bearer {tok}"} if tok else {}


def section(title: str):
    print(f"\n===== {title} =====")


# ================================================================
# 1) AUTH
# ================================================================
def test_auth():
    section("1) Auth")

    # register a fresh customer
    r = requests.post(f"{API}/auth/register", json={
        "email": CUSTOMER_EMAIL,
        "password": CUSTOMER_PASSWORD,
        "name": "Rahul Kisan",
        "phone": "+91" + CUSTOMER_PHONE_10,
    })
    ok = r.status_code == 200 and "access_token" in r.json()
    record("POST /auth/register (new customer)", ok, f"{r.status_code} {r.text[:120]}")
    customer_token = r.json()["access_token"] if ok else None

    # register duplicate should fail with 400
    r2 = requests.post(f"{API}/auth/register", json={
        "email": CUSTOMER_EMAIL,
        "password": CUSTOMER_PASSWORD,
        "name": "Dup",
    })
    record("POST /auth/register (duplicate email rejected)", r2.status_code == 400,
           f"{r2.status_code}")

    # admin login
    r = requests.post(f"{API}/auth/login", json={
        "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD,
    })
    ok = r.status_code == 200 and r.json().get("user", {}).get("role") == "admin"
    record("POST /auth/login (admin)", ok, f"{r.status_code} role={r.json().get('user',{}).get('role') if r.ok else r.text[:120]}")
    admin_token = r.json()["access_token"] if ok else None

    # customer login with email/password
    r = requests.post(f"{API}/auth/login", json={
        "email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD,
    })
    ok = r.status_code == 200
    record("POST /auth/login (customer)", ok, f"{r.status_code}")

    # invalid login -> 401
    r = requests.post(f"{API}/auth/login", json={
        "email": ADMIN_EMAIL, "password": "wrong-password",
    })
    record("POST /auth/login (invalid -> 401)", r.status_code == 401, f"{r.status_code}")

    # /auth/me with customer token
    r = requests.get(f"{API}/auth/me", headers=hdr(customer_token))
    record("GET /auth/me (customer)", r.status_code == 200 and r.json().get("email") == CUSTOMER_EMAIL,
           f"{r.status_code}")

    # /auth/me without token -> 401
    r = requests.get(f"{API}/auth/me")
    record("GET /auth/me (no auth -> 401)", r.status_code == 401, f"{r.status_code}")

    # send-otp - SMS probably not reachable; check endpoint still returns 200 with sent:false
    r = requests.post(f"{API}/auth/send-otp", json={"phone": CUSTOMER_PHONE_10})
    ok = r.status_code == 200 and "sent" in r.json() and "phone" in r.json()
    record("POST /auth/send-otp (graceful sent:false)", ok,
           f"{r.status_code} sent={r.json().get('sent') if r.ok else r.text[:120]}")

    # invalid phone -> 400
    r = requests.post(f"{API}/auth/send-otp", json={"phone": "abc"})
    record("POST /auth/send-otp (invalid -> 400)", r.status_code == 400, f"{r.status_code}")

    # verify-otp using mongo-stored OTP (since SMS may fail, OTP still stored)
    mongo = MongoClient(MONGO_URL)[DB_NAME]
    otp_rec = mongo.otps.find_one({"phone": "+91" + CUSTOMER_PHONE_10})
    otp_code = otp_rec["code"] if otp_rec else None
    if otp_code:
        r = requests.post(f"{API}/auth/verify-otp", json={
            "phone": CUSTOMER_PHONE_10, "otp": otp_code, "name": "Rahul Kisan"})
        record("POST /auth/verify-otp (valid code)",
               r.status_code == 200 and "access_token" in r.json(), f"{r.status_code}")
    else:
        record("POST /auth/verify-otp (valid code)", False, "OTP not in DB")

    # wrong OTP on a fresh send
    requests.post(f"{API}/auth/send-otp", json={"phone": CUSTOMER_PHONE_10})
    r = requests.post(f"{API}/auth/verify-otp", json={
        "phone": CUSTOMER_PHONE_10, "otp": "000000"})
    record("POST /auth/verify-otp (wrong -> 400)", r.status_code == 400, f"{r.status_code}")

    return admin_token, customer_token


# ================================================================
# 2) CATALOG
# ================================================================
def test_catalog():
    section("2) Catalog (public)")

    r = requests.get(f"{API}/products")
    products = r.json() if r.ok else []
    record("GET /products", r.status_code == 200 and isinstance(products, list) and len(products) > 0,
           f"{r.status_code} n={len(products)}")

    r = requests.get(f"{API}/products/categories")
    record("GET /products/categories", r.status_code == 200 and isinstance(r.json(), list),
           f"{r.status_code} n={len(r.json()) if r.ok else 0}")

    r = requests.get(f"{API}/products/featured")
    record("GET /products/featured", r.status_code == 200 and isinstance(r.json(), list),
           f"{r.status_code} n={len(r.json()) if r.ok else 0}")

    pid = products[0]["id"] if products else None
    if pid:
        r = requests.get(f"{API}/products/{pid}")
        record("GET /products/{id}", r.status_code == 200 and r.json().get("id") == pid,
               f"{r.status_code}")

    r = requests.get(f"{API}/products/does-not-exist")
    record("GET /products/{bad_id} (404)", r.status_code == 404, f"{r.status_code}")

    for path in ["/news", "/offers", "/dealers", "/settings/company"]:
        r = requests.get(f"{API}{path}")
        record(f"GET {path}", r.status_code == 200, f"{r.status_code}")

    return pid


# ================================================================
# 3) ORDERS / WARRANTY
# ================================================================
def test_orders(customer_token: str, pid: str):
    section("3) Orders & Warranty (customer)")

    # checkout (auth required -> 401 without token)
    r = requests.post(f"{API}/orders/checkout", json={
        "items": [{"product_id": pid, "quantity": 1}],
        "full_name": "Rahul", "phone": "+91" + CUSTOMER_PHONE_10,
        "address": "12 Farm Lane", "city": "Meerut", "state": "UP", "pincode": "250001",
    })
    record("POST /orders/checkout (no auth -> 401)", r.status_code == 401, f"{r.status_code}")

    r = requests.post(f"{API}/orders/checkout", headers=hdr(customer_token), json={
        "items": [{"product_id": pid, "quantity": 2}],
        "full_name": "Rahul Kisan", "phone": "+91" + CUSTOMER_PHONE_10,
        "address": "12 Farm Lane, Sector 4", "city": "Meerut",
        "state": "Uttar Pradesh", "pincode": "250001",
        "payment_method": "cod",
    })
    ok = r.status_code == 200 and r.json().get("id")
    record("POST /orders/checkout (valid)", ok, f"{r.status_code}")
    order_id = r.json().get("id") if ok else None

    # empty cart -> 400
    r = requests.post(f"{API}/orders/checkout", headers=hdr(customer_token), json={
        "items": [], "full_name": "R", "phone": "+91" + CUSTOMER_PHONE_10,
        "address": "x", "city": "y", "state": "z", "pincode": "111111",
    })
    record("POST /orders/checkout (empty -> 400)", r.status_code == 400, f"{r.status_code}")

    # bad product -> 404
    r = requests.post(f"{API}/orders/checkout", headers=hdr(customer_token), json={
        "items": [{"product_id": "nope", "quantity": 1}],
        "full_name": "R", "phone": "+91" + CUSTOMER_PHONE_10,
        "address": "x", "city": "y", "state": "z", "pincode": "111111",
    })
    record("POST /orders/checkout (bad product -> 404)", r.status_code == 404, f"{r.status_code}")

    r = requests.get(f"{API}/orders", headers=hdr(customer_token))
    ok = r.status_code == 200 and isinstance(r.json(), list) and any(o["id"] == order_id for o in r.json())
    record("GET /orders", ok, f"{r.status_code}")

    if order_id:
        r = requests.get(f"{API}/orders/{order_id}", headers=hdr(customer_token))
        record("GET /orders/{id}", r.status_code == 200 and r.json()["id"] == order_id, f"{r.status_code}")

    r = requests.get(f"{API}/warranties", headers=hdr(customer_token))
    ok = r.status_code == 200 and isinstance(r.json(), list) and len(r.json()) >= 1
    record("GET /warranties", ok, f"{r.status_code} n={len(r.json()) if r.ok else 0}")


# ================================================================
# 4) SUPPORT
# ================================================================
def test_support(customer_token: str):
    section("4) Support (customer)")

    r = requests.post(f"{API}/support/tickets", headers=hdr(customer_token), json={
        "subject": "Harvester not starting",
        "message": "Diesel fills but engine cranks without firing. Need dealer visit.",
    })
    record("POST /support/tickets", r.status_code == 200 and r.json().get("id"), f"{r.status_code}")

    r = requests.post(f"{API}/support/tickets", json={"subject": "x", "message": "y"})
    record("POST /support/tickets (no auth -> 401)", r.status_code == 401, f"{r.status_code}")

    r = requests.get(f"{API}/support/tickets", headers=hdr(customer_token))
    record("GET /support/tickets", r.status_code == 200 and isinstance(r.json(), list) and len(r.json()) >= 1,
           f"{r.status_code} n={len(r.json()) if r.ok else 0}")


# ================================================================
# 5) ADMIN
# ================================================================
def test_admin(admin_token: str, customer_token: str):
    section("5) Admin")

    # stats
    r = requests.get(f"{API}/admin/stats", headers=hdr(admin_token))
    ok = r.status_code == 200 and all(k in r.json() for k in ("users", "products", "orders"))
    record("GET /admin/stats", ok, f"{r.status_code}")

    # customer blocked
    r = requests.get(f"{API}/admin/stats", headers=hdr(customer_token))
    record("GET /admin/stats (customer -> 403)", r.status_code == 403, f"{r.status_code}")

    # create dealer
    r = requests.post(f"{API}/admin/dealers", headers=hdr(admin_token), json={
        "name": f"Test Dealer {RUN}",
        "address": "Plot 14, Industrial Area, Meerut",
        "phone": "+919999000001", "whatsapp": "+919999000001",
        "state": "Uttar Pradesh", "type": "Authorised Dealer",
    })
    ok = r.status_code == 200 and r.json().get("id")
    record("POST /admin/dealers", ok, f"{r.status_code}")
    dealer_id = r.json().get("id") if ok else None

    if dealer_id:
        r = requests.patch(f"{API}/admin/dealers/{dealer_id}", headers=hdr(admin_token), json={
            "name": f"Test Dealer {RUN} Updated",
            "address": "New Address", "phone": "+919999000002",
            "whatsapp": "+919999000002", "state": "UP",
        })
        record("PATCH /admin/dealers/{id}", r.status_code == 200, f"{r.status_code}")

    # company settings
    r = requests.patch(f"{API}/admin/settings/company", headers=hdr(admin_token), json={
        "name": "Ram Kishan Agri Innovate", "tagline": "Legacy of 65 years",
        "address": "Meerut, UP", "phone": "+919045333332", "phone_2": "",
        "whatsapp": "+919045333332", "email": "info@rkai.com", "website": "https://rkai.com",
    })
    record("PATCH /admin/settings/company", r.status_code == 200, f"{r.status_code}")

    # promote dealer
    dealer_phone = DEALER_PHONE_10
    promote_dealer_id = dealer_id  # use the dealer we just created
    r = requests.post(f"{API}/admin/promote-dealer", headers=hdr(admin_token), json={
        "phone": dealer_phone, "dealer_id": promote_dealer_id,
    })
    ok = r.status_code == 200 and r.json().get("promoted") is True
    record("POST /admin/promote-dealer", ok, f"{r.status_code}")

    # fetch a product id for warranty assignment
    products = requests.get(f"{API}/products").json()
    pid = products[0]["id"] if products else None

    # assign warranty (admin)
    r = requests.post(f"{API}/admin/assign-warranty", headers=hdr(admin_token), json={
        "phone": "9000000077", "product_id": pid, "quantity": 1,
        "customer_name": "Suresh Verma", "city": "Meerut", "state": "UP",
    })
    record("POST /admin/assign-warranty", r.status_code == 200 and r.json().get("id"),
           f"{r.status_code}")

    # create product
    r = requests.post(f"{API}/admin/products", headers=hdr(admin_token), json={
        "name": f"Test Tractor Plow {RUN}", "category": "Tillage",
        "price": 45000.0, "warranty_months": 24,
        "description": "3-blade reversible plow.",
        "image": "https://images.example.com/plow.jpg",
        "features": ["Reversible blades", "Hydraulic lift"],
        "specifications": {"weight": "180kg", "blades": "3"},
        "recommended_hp": "45-55 HP", "featured": True,
    })
    ok = r.status_code == 200 and r.json().get("id")
    record("POST /admin/products", ok, f"{r.status_code}")
    new_pid = r.json().get("id") if ok else None

    if new_pid:
        r = requests.patch(f"{API}/admin/products/{new_pid}", headers=hdr(admin_token), json={
            "name": f"Test Tractor Plow {RUN} v2", "category": "Tillage",
            "price": 47000.0, "warranty_months": 24,
            "description": "Updated.",
            "image": "https://images.example.com/plow2.jpg",
            "features": ["Reversible"], "specifications": {}, "recommended_hp": "",
            "featured": False,
        })
        record("PATCH /admin/products/{id}", r.status_code == 200, f"{r.status_code}")

        r = requests.delete(f"{API}/admin/products/{new_pid}", headers=hdr(admin_token))
        record("DELETE /admin/products/{id}", r.status_code == 200, f"{r.status_code}")

    # news & offers
    r = requests.post(f"{API}/admin/news", headers=hdr(admin_token), json={
        "title": f"Monsoon launch {RUN}", "summary": "New offers for Kharif season.",
        "body": "Details inside.", "image": "https://images.example.com/news.jpg",
        "tag": "Launch",
    })
    record("POST /admin/news", r.status_code == 200 and r.json().get("id"), f"{r.status_code}")

    r = requests.post(f"{API}/admin/offers", headers=hdr(admin_token), json={
        "code": f"KHARIF{RUN[:4]}", "title": "Kharif Discount",
        "description": "10% off on plows.", "discount_percent": 10,
        "banner_color": "#FF6600", "valid_until": "2026-12-31",
    })
    record("POST /admin/offers", r.status_code == 200 and r.json().get("code"), f"{r.status_code}")

    # warranty reminders
    r = requests.post(f"{API}/admin/warranty-reminders", headers=hdr(admin_token))
    record("POST /admin/warranty-reminders", r.status_code == 200 and "sent" in r.json(), f"{r.status_code}")

    # delete dealer (cleanup) after all dealer-related tests complete
    return dealer_id, dealer_phone, promote_dealer_id


def cleanup_dealer(admin_token, dealer_id):
    if not dealer_id:
        return
    r = requests.delete(f"{API}/admin/dealers/{dealer_id}", headers=hdr(admin_token))
    record("DELETE /admin/dealers/{id}", r.status_code == 200, f"{r.status_code}")


# ================================================================
# 6) DEALER PORTAL
# ================================================================
def get_dealer_token(dealer_phone_10: str) -> Optional[str]:
    """Login as dealer by:
       1) POST /auth/send-otp
       2) Read OTP directly from mongo (SMS may fail in env)
       3) POST /auth/verify-otp -> token
    """
    requests.post(f"{API}/auth/send-otp", json={"phone": dealer_phone_10})
    mongo = MongoClient(MONGO_URL)[DB_NAME]
    rec = mongo.otps.find_one({"phone": "+91" + dealer_phone_10})
    if not rec:
        return None
    r = requests.post(f"{API}/auth/verify-otp", json={
        "phone": dealer_phone_10, "otp": rec["code"],
    })
    if r.status_code != 200:
        return None
    return r.json()["access_token"]


def test_dealer(admin_token: str, dealer_phone_10: str, promote_dealer_id: str):
    section("6) Dealer Portal")

    token = get_dealer_token(dealer_phone_10)
    if not token:
        record("Dealer OTP login", False, "Could not retrieve OTP from DB")
        return

    r = requests.get(f"{API}/dealer/me", headers=hdr(token))
    ok = (r.status_code == 200
          and r.json().get("user", {}).get("role") == "dealer"
          and r.json().get("dealer") is not None)
    record("GET /dealer/me", ok, f"{r.status_code} role={r.json().get('user',{}).get('role') if r.ok else r.text[:120]}")

    products = requests.get(f"{API}/products").json()
    pid = products[0]["id"] if products else None
    # tiny base64 (1x1 png ~70 bytes)
    tiny_png = ("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42"
                "mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=")
    r = requests.post(f"{API}/dealer/assign-warranty", headers=hdr(token), json={
        "phone": "9000012345", "product_id": pid, "quantity": 1,
        "customer_name": "Ramesh Singh", "city": "Meerut", "state": "UP",
        "bill_image_base64": tiny_png,
    })
    record("POST /dealer/assign-warranty", r.status_code == 200 and r.json().get("id"),
           f"{r.status_code}")

    r = requests.get(f"{API}/dealer/orders", headers=hdr(token))
    record("GET /dealer/orders", r.status_code == 200 and isinstance(r.json(), list),
           f"{r.status_code} n={len(r.json()) if r.ok else 0}")

    # customer role should be forbidden
    r = requests.get(f"{API}/dealer/me")
    record("GET /dealer/me (no auth -> 401)", r.status_code == 401, f"{r.status_code}")


# ================================================================
# 7) SOCIAL
# ================================================================
def test_social():
    section("7) Social (public)")

    r = requests.get(f"{API}/social")
    record("GET /social", r.status_code == 200 and "youtube" in r.json(), f"{r.status_code}")

    r = requests.get(f"{API}/social/youtube")
    ok = r.status_code == 200 and isinstance(r.json().get("videos"), list) and len(r.json()["videos"]) >= 1
    record("GET /social/youtube (>=1 video)", ok,
           f"{r.status_code} n={len(r.json().get('videos', [])) if r.ok else 0}")

    r = requests.get(f"{API}/social/instagram")
    ok_ig = (r.status_code == 200
             and isinstance(r.json().get("posts"), list)
             and "handle" in r.json())
    record("GET /social/instagram (profile+posts object)", ok_ig,
           f"{r.status_code} posts={len(r.json().get('posts', [])) if r.ok else 0}")

    r = requests.get(f"{API}/social/facebook")
    body = r.json() if r.ok else {}
    ok_fb = (r.status_code == 200 and "name" in body and "page_url" in body)
    record("GET /social/facebook (static fallback OK)", ok_fb,
           f"{r.status_code} name={body.get('name','')[:40]}")

    r = requests.get(f"{API}/social/feed")
    body = r.json() if r.ok else {}
    ok_feed = (r.status_code == 200 and all(k in body for k in ("youtube", "instagram", "facebook", "links")))
    record("GET /social/feed (combined)", ok_feed, f"{r.status_code}")


# ================================================================
# 8) PAYMENTS
# ================================================================
def test_payments():
    section("8) Payments")

    r = requests.get(f"{API}/payments/config")
    ok = r.status_code == 200 and r.json().get("razorpay_enabled") is False
    record("GET /payments/config (razorpay_enabled:false)", ok,
           f"{r.status_code} body={r.text[:120]}")


# ================================================================
# RUN
# ================================================================
def main():
    print(f"API base: {API}")
    admin_token, customer_token = test_auth()
    if not admin_token or not customer_token:
        print("Fatal: missing admin/customer token, aborting dependent tests.")
        sys.exit(1)

    pid = test_catalog()
    if pid:
        test_orders(customer_token, pid)
    test_support(customer_token)

    dealer_id, dealer_phone, promote_dealer_id = test_admin(admin_token, customer_token)
    test_dealer(admin_token, dealer_phone, promote_dealer_id)
    cleanup_dealer(admin_token, dealer_id)

    test_social()
    test_payments()

    # summary
    total = len(results)
    passed = sum(1 for x in results if x["ok"])
    print("\n=================== SUMMARY ===================")
    print(f"Passed: {passed}/{total}")
    if failures:
        print("\nFailures:")
        for f in failures:
            print(f"  - {f}")
    sys.exit(0 if not failures else 1)


if __name__ == "__main__":
    main()

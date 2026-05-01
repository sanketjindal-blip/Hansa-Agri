"""HANSA backend regression — new features (admin phones, Razorpay test, leads/loyalty, redeem points, admin stats)."""
import os
import sys
import json
from typing import Any, Dict
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BACKEND_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = BACKEND_URL + "/api"

ADMIN_EMAIL = "admin@rkai.com"
ADMIN_PASSWORD = "admin123"
RAMESH_EMAIL = "ramesh@farm.com"
RAMESH_PASSWORD = "farmer123"

results = []
def log(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name} :: {detail}")
    results.append({"name": name, "ok": ok, "detail": detail})

def req(method, path, token=None, **kw):
    url = API + path
    headers = kw.pop("headers", {}) or {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.request(method, url, headers=headers, timeout=30, **kw)

def main():
    # --- Login admin (legacy) ---
    r = req("POST", "/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    log("Admin legacy login", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code != 200:
        return
    admin_token = r.json()["access_token"]
    admin_user = r.json()["user"]

    # --- Login customer ramesh ---
    r = req("POST", "/auth/login", json={"email": RAMESH_EMAIL, "password": RAMESH_PASSWORD})
    log("Customer ramesh login", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code != 200:
        return
    cust_token = r.json()["access_token"]
    cust_user = r.json()["user"]
    referrer_id = cust_user["id"]

    # ===== A) Admin phones seeded =====
    r = req("GET", "/admin/users", token=admin_token)
    log("GET /admin/users", r.status_code == 200, f"{r.status_code}")
    users = r.json() if r.status_code == 200 else []
    by_phone = {u.get("phone"): u for u in users}
    u1 = by_phone.get("+919045666666")
    u2 = by_phone.get("+917017509782")
    log("Admin +919045666666 seeded as admin", bool(u1) and u1.get("role") == "admin",
        f"role={u1 and u1.get('role')}")
    log("Admin +917017509782 seeded as admin", bool(u2) and u2.get("role") == "admin",
        f"role={u2 and u2.get('role')}")

    # ramesh must NOT be admin and must NOT be on +919045666666
    ramesh = next((u for u in users if u.get("email") == RAMESH_EMAIL), None)
    log("Ramesh exists in users", ramesh is not None, "")
    if ramesh:
        log("Ramesh is not admin", ramesh.get("role") != "admin", f"role={ramesh.get('role')}")
        log("Ramesh phone is not +919045666666",
            ramesh.get("phone") != "+919045666666",
            f"phone={ramesh.get('phone')}")

    # ===== B) Razorpay TEST mode =====
    r = req("GET", "/payments/config")
    cfg = r.json() if r.status_code == 200 else {}
    log("GET /payments/config razorpay_enabled", cfg.get("razorpay_enabled") is True, f"{cfg}")
    log("GET /payments/config key_id correct",
        cfg.get("key_id") == "rzp_test_Sk5PDQdwoppOwz",
        f"key_id={cfg.get('key_id')}")

    r = req("POST", "/payments/razorpay/create-order", token=cust_token, json={"amount_inr": 1000})
    ok = r.status_code == 200
    body = r.json() if ok else {}
    log("POST /payments/razorpay/create-order 200",
        ok and isinstance(body.get("order_id"), str) and body["order_id"].startswith("order_") and body.get("key_id"),
        f"{r.status_code} body={str(body)[:300]}")

    # ===== C) Lead referral & loyalty =====
    # 1. Customer already logged in (referrer_id set)
    # 2. Submit lead
    r = req("POST", "/leads", token=cust_token,
            json={"name": "Sunita", "phone": "9999000022", "equipment_interest": "Cultivator"})
    ok = r.status_code == 200
    lead = r.json() if ok else {}
    log("POST /leads (valid)", ok and lead.get("status") == "new" and lead.get("points_awarded") == 0
        and lead.get("id"),
        f"{r.status_code} {str(lead)[:300]}")
    lead_id = lead.get("id")

    # 3. GET /leads/mine
    r = req("GET", "/leads/mine", token=cust_token)
    mine = r.json() if r.status_code == 200 else []
    log("GET /leads/mine contains new lead",
        any(l.get("id") == lead_id for l in mine),
        f"count={len(mine)}")

    # 4. GET /me/points (record balance_before)
    r = req("GET", "/me/points", token=cust_token)
    pts = r.json() if r.status_code == 200 else {}
    balance_before = int(pts.get("balance", 0))
    log("GET /me/points shape",
        r.status_code == 200 and "balance" in pts and "transactions" in pts and pts.get("point_value_inr") == 1,
        f"balance_before={balance_before} keys={list(pts.keys())}")

    # 5. Admin patches lead -> purchased
    r = req("PATCH", f"/admin/leads/{lead_id}", token=admin_token,
            json={"status": "purchased", "notes": "closed offline"})
    ok = r.status_code == 200
    body = r.json() if ok else {}
    log("PATCH /admin/leads -> purchased awards 500",
        ok and body.get("points_awarded") == 500 and body.get("status") == "purchased",
        f"{r.status_code} {str(body)[:300]}")

    # 6. Re-PATCH same lead {status:'purchased'} - must not double-award
    r2 = req("PATCH", f"/admin/leads/{lead_id}", token=admin_token,
             json={"status": "purchased"})
    body2 = r2.json() if r2.status_code == 200 else {}
    log("Re-PATCH purchased no double-award",
        r2.status_code == 200 and body2.get("points_awarded") == 500,
        f"{r2.status_code} pts={body2.get('points_awarded')}")

    # 7. Customer balance check
    r = req("GET", "/me/points", token=cust_token)
    pts2 = r.json() if r.status_code == 200 else {}
    balance_after_award = int(pts2.get("balance", -999))
    log("Balance increased by 500 after purchase",
        balance_after_award == balance_before + 500,
        f"before={balance_before} after={balance_after_award}")
    txns = pts2.get("transactions", [])
    has_lead_tx = any(t.get("delta") == 500 and ("lead" in (t.get("reason","").lower()) or "sunita" in (t.get("reason","").lower())) for t in txns)
    log("Transaction with delta=500 referencing lead present",
        has_lead_tx, f"first txn reason={txns[0].get('reason') if txns else 'none'}")

    # 8. Admin adjust delta=-100
    r = req("POST", "/admin/points/adjust", token=admin_token,
            json={"user_id": referrer_id, "delta": -100, "reason": "Test deduction"})
    body = r.json() if r.status_code == 200 else {}
    log("Admin points/adjust -100",
        r.status_code == 200 and body.get("balance") == balance_before + 400,
        f"{r.status_code} body={body}")

    # 9. Admin adjust delta=+50
    r = req("POST", "/admin/points/adjust", token=admin_token,
            json={"user_id": referrer_id, "delta": 50, "reason": "Test add"})
    body = r.json() if r.status_code == 200 else {}
    log("Admin points/adjust +50",
        r.status_code == 200 and body.get("balance") == balance_before + 450,
        f"{r.status_code} body={body}")

    # 10. Validation tests
    r = req("POST", "/leads", token=cust_token, json={"name": "", "phone": "9999000033"})
    log("POST /leads empty name -> 400", r.status_code == 400, f"{r.status_code} {r.text[:120]}")

    r = req("POST", "/leads", token=cust_token, json={"name": "X", "phone": "123"})
    log("POST /leads invalid phone -> 400", r.status_code == 400, f"{r.status_code} {r.text[:120]}")

    r = req("PATCH", "/admin/leads/nonexistent-id-zzz", token=admin_token,
            json={"status": "purchased"})
    log("PATCH /admin/leads nonexistent -> 400", r.status_code == 400, f"{r.status_code} {r.text[:120]}")

    r = req("PATCH", f"/admin/leads/{lead_id}", token=admin_token, json={"status": "foo"})
    log("PATCH /admin/leads invalid status -> 400", r.status_code == 400, f"{r.status_code} {r.text[:120]}")

    r = req("POST", "/admin/points/adjust", token=admin_token,
            json={"user_id": "nope-user-zzz", "delta": 10, "reason": "x"})
    log("admin/points/adjust unknown user -> 404", r.status_code == 404, f"{r.status_code} {r.text[:120]}")

    # ===== D) Checkout with redeem points =====
    # Pick a product
    r = req("GET", "/products")
    products = r.json() if r.status_code == 200 else []
    if not products:
        log("Get products for checkout", False, "no products")
        return
    # Pick first product (any price)
    product = products[0]
    cheap_product = sorted(products, key=lambda p: p.get("price", 0))[0]

    # Sanity: balance before checkout should be balance_before+450
    r = req("GET", "/me/points", token=cust_token)
    balance_pre_checkout = int(r.json().get("balance", -999))
    log("Balance pre-checkout matches expected",
        balance_pre_checkout == balance_before + 450,
        f"{balance_pre_checkout} vs {balance_before+450}")

    co_payload = {
        "items": [{"product_id": product["id"], "quantity": 1}],
        "full_name": "Ramesh Kumar", "phone": "+919876543210",
        "address": "Village Arifpur", "city": "Hapur", "state": "UP", "pincode": "201015",
        "payment_method": "cod",
        "redeem_points": 300,
    }
    r = req("POST", "/orders/checkout", token=cust_token, json=co_payload)
    ok = r.status_code == 200
    order = r.json() if ok else {}
    subtotal = order.get("subtotal", 0)
    log("Checkout with redeem_points=300 200",
        ok and order.get("points_redeemed") == 300 and order.get("points_discount") == 300
        and abs(order.get("total", 0) - (subtotal - 300)) < 0.01
        and order.get("status") == "confirmed",
        f"{r.status_code} subtotal={subtotal} total={order.get('total')} pr={order.get('points_redeemed')} pd={order.get('points_discount')}")

    # Balance reduced by 300
    r = req("GET", "/me/points", token=cust_token)
    bal_after_checkout = int(r.json().get("balance", -999))
    log("Balance reduced by 300 after redemption",
        bal_after_checkout == balance_before + 150,
        f"{bal_after_checkout} vs {balance_before+150}")

    # 4. Over-balance redeem cap
    co_payload2 = {
        "items": [{"product_id": cheap_product["id"], "quantity": 1}],
        "full_name": "Ramesh Kumar", "phone": "+919876543210",
        "address": "Village Arifpur", "city": "Hapur", "state": "UP", "pincode": "201015",
        "payment_method": "cod",
        "redeem_points": 99999,
    }
    r = req("POST", "/orders/checkout", token=cust_token, json=co_payload2)
    ok = r.status_code == 200
    order2 = r.json() if ok else {}
    subtotal2 = order2.get("subtotal", 0)
    pr2 = order2.get("points_redeemed", -1)
    expected_cap = min(bal_after_checkout, int(subtotal2))
    log("Over-balance redeem capped",
        ok and pr2 == expected_cap and order2.get("total", -1) >= 0,
        f"{r.status_code} subtotal={subtotal2} pr={pr2} expected_cap={expected_cap} total={order2.get('total')}")

    # ===== E) Admin stats =====
    r = req("GET", "/admin/stats", token=admin_token)
    s = r.json() if r.status_code == 200 else {}
    has_lead_fields = isinstance(s.get("leads"), int) and isinstance(s.get("leads_new"), int) and isinstance(s.get("leads_purchased"), int)
    log("/admin/stats includes leads counters", has_lead_fields, f"{s}")

    # ---- Summary ----
    failed = [r for r in results if not r["ok"]]
    print("\n========== SUMMARY ==========")
    print(f"Total: {len(results)}, Passed: {len(results)-len(failed)}, Failed: {len(failed)}")
    for f in failed:
        print(f"  FAIL: {f['name']} :: {f['detail']}")
    sys.exit(0 if not failed else 1)

if __name__ == "__main__":
    main()

"""HANSA backend regression for Inventory + Product Reorder endpoints."""
import os
import sys
import requests
from pymongo import MongoClient

BASE = os.environ.get("BASE_URL", "https://farm-gear-hub-4.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
MC = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
DB = MC[os.environ.get("DB_NAME", "rkai_app")]

results = []


def log(ok_, name, detail=""):
    marker = "[+] PASS" if ok_ else "[X] FAIL"
    print(f"{marker}: {name}" + (f" -- {detail}" if detail else ""))
    results.append((bool(ok_), name, detail))


def H(token=None):
    return {"Authorization": f"Bearer {token}"} if token else {}


def get(path, token=None, **kw):
    return requests.get(API + path, headers=H(token), timeout=30, **kw)


def post(path, token=None, **kw):
    h = H(token)
    h.update(kw.pop("headers", {}) or {})
    return requests.post(API + path, headers=h, timeout=30, **kw)


def patch(path, token=None, **kw):
    h = H(token)
    h.update(kw.pop("headers", {}) or {})
    return requests.patch(API + path, headers=h, timeout=30, **kw)


def delete(path, token=None):
    return requests.delete(API + path, headers=H(token), timeout=30)


def otp_login(phone):
    r = requests.post(API + "/auth/send-otp", json={"phone": phone}, timeout=30)
    if r.status_code != 200:
        raise RuntimeError(f"send-otp failed: {r.status_code} {r.text}")
    norm = phone if phone.startswith("+") else ("+91" + phone.lstrip("0"))
    doc = DB.otps.find_one({"phone": norm}, sort=[("created_at", -1)])
    if not doc:
        doc = DB.otps.find_one({"phone": phone}, sort=[("created_at", -1)])
    if not doc:
        # Fallback: read last_otp from user record
        user = DB.users.find_one({"phone": norm}) or DB.users.find_one({"phone": phone})
        if user and user.get("last_otp"):
            code = user["last_otp"]
        else:
            raise RuntimeError(f"OTP for {phone} not found in DB")
    else:
        code = doc.get("code") or doc.get("otp")
    r2 = requests.post(API + "/auth/verify-otp", json={"phone": phone, "otp": code}, timeout=30)
    if r2.status_code != 200:
        raise RuntimeError(f"verify-otp failed: {r2.status_code} {r2.text}")
    j = r2.json()
    return j["access_token"], j["user"]


def main():
    print(f"Running inventory+reorder regression: {API}\n")

    # ---- Auth ----
    admin_tok, admin_user = otp_login("+919045666666")
    log(admin_user.get("role") == "admin", "Admin OTP login (+919045666666)",
        f"role={admin_user.get('role')}")

    # Customer (ramesh) — for 403 tests
    cust_tok = None
    try:
        cust_tok, cust_user = otp_login("+919876543210")
        log(cust_user.get("role") == "customer", "Customer OTP login (ramesh +919876543210)",
            f"role={cust_user.get('role')}")
    except Exception as e:
        log(False, "Customer OTP login (ramesh)", str(e))

    # =========================================================================
    # A) Inventory summary
    # =========================================================================
    print("\n=== A) /admin/inventory/summary ===")
    r = get("/admin/inventory/summary", admin_tok)
    log(r.status_code == 200, "GET /admin/inventory/summary as admin -> 200",
        f"status={r.status_code}")
    if r.status_code != 200:
        print("  body:", r.text[:300])
        summary = None
    else:
        summary = r.json()

    if summary:
        # Shape
        for key in ("totals", "by_category", "recent_products", "top_priced", "out_of_stock"):
            log(key in summary, f"Top-level key '{key}' present")
        totals = summary.get("totals", {})
        for tk in ("products", "categories", "featured", "in_stock", "out_of_stock", "total_value_inr"):
            log(tk in totals, f"totals.{tk} present", f"value={totals.get(tk)!r}")

        # totals.products = total docs in products collection
        actual_products = DB.products.count_documents({})
        log(totals.get("products") == actual_products,
            "totals.products equals DB products count",
            f"summary={totals.get('products')} db={actual_products}")

        # SUM(by_category[].products_count) excluding _uncategorised <= totals.products
        bc = summary.get("by_category", [])
        non_uncat = [c for c in bc if c.get("id") != "_uncategorised"]
        uncat_rows = [c for c in bc if c.get("id") == "_uncategorised"]
        sum_non_uncat = sum(c.get("products_count", 0) for c in non_uncat)
        log(sum_non_uncat <= totals.get("products", 0),
            "SUM(by_category.products_count excl uncategorised) <= totals.products",
            f"sum={sum_non_uncat} totals.products={totals.get('products')}")

        # _uncategorised bucket should appear ONLY if any product has category not in
        # registered categories.  Determine registered category KEYS (since admin code
        # currently uses c.get('name') — we capture both for diagnostic clarity).
        cats_in_db = list(DB.categories.find({}, {"_id": 0}))
        cat_keys = {c.get("key") for c in cats_in_db}
        prod_categories = set(DB.products.distinct("category"))
        unmatched = {pc for pc in prod_categories if pc and pc not in cat_keys}
        if unmatched:
            log(len(uncat_rows) == 1,
                "_uncategorised bucket present (some products have unregistered category)",
                f"unmatched_categories={unmatched}")
        else:
            log(len(uncat_rows) == 0,
                "_uncategorised bucket absent (all products map to registered categories)",
                f"found {len(uncat_rows)} uncategorised rows; cat_keys={cat_keys}; prod_cats={prod_categories}")

        # Each by_category row: total_value = sum(prices), avg_price = total_value/count
        all_value_ok = True
        all_avg_ok = True
        details = []
        for c in bc:
            cid = c.get("id")
            if cid == "_uncategorised":
                # match products whose category not in registered categories
                # NOTE: the backend keys this match on c["name"] — categories don't
                # actually have a 'name' field; products use the category 'key'.
                # We compute against actual unmatched products for verification.
                prods = list(DB.products.find(
                    {"category": {"$nin": list(cat_keys)}},
                    {"_id": 0, "price": 1, "in_stock": 1},
                ))
            else:
                # The category row 'name' field is what backend used.  We replicate
                # by also trying both name and key to remain compatible.
                cat_doc = next((cd for cd in cats_in_db if cd.get("id") == cid), None)
                match_vals = []
                if cat_doc:
                    if cat_doc.get("name"):
                        match_vals.append(cat_doc.get("name"))
                    if cat_doc.get("key"):
                        match_vals.append(cat_doc.get("key"))
                prods = list(DB.products.find(
                    {"category": {"$in": match_vals}},
                    {"_id": 0, "price": 1, "in_stock": 1},
                )) if match_vals else []
            expected_count_via_key_or_name = len(prods)
            expected_total = round(float(sum(p.get("price", 0) for p in prods)), 2)
            expected_avg = round(expected_total / expected_count_via_key_or_name, 2) if expected_count_via_key_or_name else 0.0

            actual_total = round(float(c.get("total_value", 0)), 2)
            actual_count = c.get("products_count", 0)
            actual_avg = round(float(c.get("avg_price", 0)), 2)

            if actual_count > 0:
                # avg_price should be total_value / count
                derived = round(actual_total / actual_count, 2)
                if abs(derived - actual_avg) > 0.02:
                    all_avg_ok = False
                    details.append(f"{c.get('name')}/{cid}: avg={actual_avg} vs derived={derived}")
            else:
                if actual_avg != 0:
                    all_avg_ok = False
                    details.append(f"{c.get('name')}/{cid}: count=0 but avg={actual_avg}")
            # total_value vs actual sum of products under that category (semantic check)
            # only enforce when the row claims products_count>0 — flagging mismatch as
            # diagnostic info too.
            if actual_count != expected_count_via_key_or_name or abs(actual_total - expected_total) > 0.02:
                details.append(
                    f"row {c.get('name')!r} id={cid}: count={actual_count} (expected {expected_count_via_key_or_name}) "
                    f"total={actual_total} (expected {expected_total})"
                )
                all_value_ok = False

        log(all_avg_ok, "every by_category row: avg_price == total_value / count (when count>0)",
            "; ".join(details[:3]))
        log(all_value_ok, "every by_category row: total_value == sum(prices) of category products",
            "; ".join(details[:3]))

    # 403 for non-admin
    if cust_tok:
        r = get("/admin/inventory/summary", cust_tok)
        log(r.status_code == 403, "GET /admin/inventory/summary as customer -> 403",
            f"status={r.status_code}")

    # =========================================================================
    # B) Product reorder
    # =========================================================================
    print("\n=== B) /admin/products/reorder ===")
    r = get("/products")
    log(r.status_code == 200, "GET /products baseline -> 200")
    original = r.json() if r.status_code == 200 else []
    original_ids = [p["id"] for p in original]
    print(f"  original_ids[:5]={original_ids[:5]}  total={len(original_ids)}")

    reversed_ids = list(reversed(original_ids))
    r = post("/admin/products/reorder", admin_tok, json={"ordered_ids": reversed_ids})
    log(r.status_code == 200, "POST /admin/products/reorder reversed -> 200",
        f"status={r.status_code}")
    if r.status_code == 200:
        body = r.json()
        log(isinstance(body, list), "Reorder response is a list",
            f"type={type(body).__name__}")

    # GET /products to verify order
    r = get("/products")
    new_order = [p["id"] for p in r.json()] if r.status_code == 200 else []
    log(new_order == reversed_ids,
        "GET /products order matches reversed list (last was now first)",
        f"first new={new_order[:3]} expected={reversed_ids[:3]}")

    # Verify each product doc has sort_order
    has_sort = all("sort_order" in p for p in r.json() if r.status_code == 200)
    log(has_sort, "Every product doc has 'sort_order' field after reorder",
        f"missing={[p.get('id') for p in (r.json() if r.status_code==200 else []) if 'sort_order' not in p][:3]}")

    # Idempotent: post again
    r2 = post("/admin/products/reorder", admin_tok, json={"ordered_ids": reversed_ids})
    log(r2.status_code == 200, "Idempotent re-POST same payload -> 200",
        f"status={r2.status_code}")

    # 403 for non-admin
    if cust_tok:
        r3 = post("/admin/products/reorder", cust_tok, json={"ordered_ids": reversed_ids})
        log(r3.status_code == 403, "Reorder as customer -> 403",
            f"status={r3.status_code}")

    # Restore original order
    rr = post("/admin/products/reorder", admin_tok, json={"ordered_ids": original_ids})
    log(rr.status_code == 200, "Restore original product order", f"status={rr.status_code}")

    # =========================================================================
    # C) Sort regression for new product (no sort_order)
    # =========================================================================
    print("\n=== C) New product without sort_order ===")
    new_prod_body = {
        "name": "Test Inventory Tiller QR-X",
        "category": "Tiller",
        "price": 12345.0,
        "warranty_months": 12,
        "description": "Smoke test product (delete me).",
        "image": "https://picsum.photos/seed/qrxtest/600",
        "features": ["test"],
        "specifications": {"hp": "5"},
        "recommended_hp": "5",
        "featured": False,
    }
    r = post("/admin/products", admin_tok, json=new_prod_body)
    log(r.status_code == 200, "POST new admin product without sort_order -> 200",
        f"status={r.status_code} body={r.text[:200]}")
    new_pid = r.json().get("id") if r.status_code == 200 else None

    if new_pid:
        # GET twice and verify deterministic order
        r1 = get("/products")
        order1 = [p["id"] for p in r1.json()]
        r2 = get("/products")
        order2 = [p["id"] for p in r2.json()]
        log(order1 == order2, "Two consecutive GET /products are deterministic (consistent ordering)",
            f"diff={'same' if order1==order2 else 'different!'}")
        log(new_pid in order1, "New product appears in /products list",
            f"position={order1.index(new_pid) if new_pid in order1 else 'absent'}/{len(order1)}")
        # Cleanup
        rd = delete(f"/admin/products/{new_pid}", admin_tok)
        log(rd.status_code == 200, "Cleanup: delete test product",
            f"status={rd.status_code}")

    # =========================================================================
    # D) Smoke regressions
    # =========================================================================
    print("\n=== D) Smoke regression ===")
    r = get("/manager/me", admin_tok)
    log(r.status_code == 200, "GET /manager/me as admin -> 200",
        f"status={r.status_code}")
    if r.status_code == 200:
        perms = r.json().get("perms") or r.json().get("manager_perms") or {}
        for p in ("leads", "service", "warranty", "points"):
            log(p in perms or perms.get(p) is True or perms.get(p) is not None,
                f"manager_perms includes '{p}'", f"perms={perms}")

    # Assign warranty (1 product)
    prods = get("/products").json()
    one_pid = prods[0]["id"] if prods else None
    if one_pid:
        body = {
            "phone": "+919998880077",
            "items": [{"product_id": one_pid, "quantity": 1}],
        }
        r = post("/manager/assign-warranty", admin_tok, json=body)
        log(r.status_code == 200, "POST /manager/assign-warranty (admin, 1 product) -> 200",
            f"status={r.status_code} body={r.text[:200]}")

    # Points adjust
    if cust_tok:
        # find ramesh user_id from /auth/me
        r = get("/auth/me", cust_tok)
        if r.status_code == 200:
            ramesh_id = r.json().get("id")
            r = post("/manager/points/adjust", admin_tok, json={
                "user_id": ramesh_id, "delta": 5, "reason": "smoke",
            })
            log(r.status_code == 200, "POST /manager/points/adjust (admin) -> 200",
                f"status={r.status_code} body={r.text[:200]}")

    # ---- Summary ----
    total = len(results)
    passed = sum(1 for r in results if r[0])
    print(f"\n==== {passed}/{total} PASS ====")
    fails = [(n, d) for ok_, n, d in results if not ok_]
    if fails:
        print("\nFailures:")
        for n, d in fails:
            print(f"  - {n}: {d}")
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()

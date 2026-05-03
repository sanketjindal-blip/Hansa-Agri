"""Retest inventory_summary after fix."""
import os
import sys
import requests
from pymongo import MongoClient

BASE = "https://fullstack-migration-1.preview.emergentagent.com/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
MONGO = MongoClient(MONGO_URL)
# Look up DB name from backend env
DB_NAME = os.environ.get("DB_NAME")
if not DB_NAME:
    with open("/app/backend/.env") as f:
        for line in f:
            if line.startswith("DB_NAME="):
                DB_NAME = line.strip().split("=", 1)[1].strip().strip('"').strip("'")
                break
db = MONGO[DB_NAME or "test_database"]

passes = []
fails = []


def check(cond, msg):
    (passes if cond else fails).append(msg)
    print(("✅" if cond else "❌"), msg)


def otp_login(phone):
    r = requests.post(f"{BASE}/auth/send-otp", json={"phone": phone}, timeout=20)
    assert r.status_code == 200, f"send-otp failed {r.status_code} {r.text}"
    # Fetch OTP from DB
    otp_doc = db.otps.find_one({"phone": phone}, sort=[("created_at", -1)])
    if not otp_doc:
        # try e164
        e164 = phone if phone.startswith("+") else "+91" + phone
        otp_doc = db.otps.find_one({"phone": e164}, sort=[("created_at", -1)])
    assert otp_doc, "OTP not found in DB"
    code = otp_doc.get("code") or otp_doc.get("otp")
    r2 = requests.post(f"{BASE}/auth/verify-otp", json={"phone": phone, "otp": code}, timeout=20)
    assert r2.status_code == 200, f"verify-otp failed {r2.status_code} {r2.text}"
    return r2.json()["access_token"]


# --- Admin login ---
admin_token = otp_login("+919045666666")
admin_h = {"Authorization": f"Bearer {admin_token}"}

# --- Test 1: GET /api/admin/inventory/summary as admin ---
r = requests.get(f"{BASE}/admin/inventory/summary", headers=admin_h, timeout=30)
check(r.status_code == 200, f"GET /admin/inventory/summary -> 200 (got {r.status_code})")
if r.status_code != 200:
    print(r.text)
    sys.exit(1)

data = r.json()

# totals.products == db.products count
db_products_count = db.products.count_documents({})
totals = data.get("totals", {})
check(totals.get("products") == db_products_count,
      f"totals.products ({totals.get('products')}) == db.products count ({db_products_count})")

# by_category is a list with at least 10 rows
by_cat = data.get("by_category", [])
# Exclude uncategorised when counting "registered categories" rows
registered_rows = [r_ for r_ in by_cat if r_.get("id") != "_uncategorised"]
check(isinstance(by_cat, list) and len(registered_rows) >= 10,
      f"by_category has >=10 registered rows (got {len(registered_rows)})")

# Each row has required fields
required_fields = {"id", "name", "key", "icon", "products_count",
                   "in_stock_count", "out_of_stock_count", "avg_price",
                   "total_value", "active"}
missing_any = False
for row in registered_rows:
    missing = required_fields - set(row.keys())
    if missing:
        missing_any = True
        print(f"   row {row.get('id')} missing {missing}")
check(not missing_any, "Every registered-category row has required fields")

# Verify 'name' populated from category.label (compare to DB)
cats_db = {c["key"]: c for c in db.categories.find({}, {"_id": 0})}
name_from_label_ok = True
for row in registered_rows:
    k = row.get("key")
    expected_label = cats_db.get(k, {}).get("label") or k
    if row.get("name") != expected_label:
        name_from_label_ok = False
        print(f"   key={k}: row.name={row.get('name')} vs expected={expected_label}")
check(name_from_label_ok, "by_category row.name == categories.label")

# For categories with products_count > 0, verify total_value ≈ sum of prices, avg_price = total_value/products_count
tv_ok = True
avg_ok = True
for row in registered_rows:
    cnt = row.get("products_count", 0)
    if cnt > 0:
        key = row.get("key")
        prods = list(db.products.find({"category": key}, {"_id": 0, "price": 1}))
        expected_sum = round(float(sum(p.get("price", 0) for p in prods)), 2)
        if abs(row.get("total_value", 0) - expected_sum) > 0.5:
            tv_ok = False
            print(f"   total_value mismatch for {key}: got {row.get('total_value')} vs expected {expected_sum}")
        expected_avg = round(expected_sum / cnt, 2)
        if abs(row.get("avg_price", 0) - expected_avg) > 0.5:
            avg_ok = False
            print(f"   avg_price mismatch for {key}: got {row.get('avg_price')} vs expected {expected_avg}")
check(tv_ok, "total_value ≈ sum(prices) for each non-empty category")
check(avg_ok, "avg_price == total_value/products_count for each non-empty category")

# _uncategorised bucket only present if any product has a category not in registered keys
cat_keys = set(cats_db.keys())
all_product_cats = {p.get("category") for p in db.products.find({}, {"_id": 0, "category": 1})}
uncat_products = [c for c in all_product_cats if c not in cat_keys]
has_uncat_row = any(row.get("id") == "_uncategorised" for row in by_cat)
if uncat_products:
    check(has_uncat_row, f"_uncategorised bucket present (product cats outside registered keys: {uncat_products})")
else:
    check(not has_uncat_row, "_uncategorised bucket absent (all product categories match registered keys)")

# recent_products, top_priced, out_of_stock arrays present
check(isinstance(data.get("recent_products"), list), "recent_products is a list")
check(isinstance(data.get("top_priced"), list), "top_priced is a list")
check(isinstance(data.get("out_of_stock"), list), "out_of_stock is a list")

# top_priced sorted by price desc
tp = data.get("top_priced", [])
prices = [p.get("price", 0) for p in tp]
check(prices == sorted(prices, reverse=True), f"top_priced sorted by price desc ({prices})")

# recent by created_at desc
rp = data.get("recent_products", [])
cas = [p.get("created_at", "") for p in rp]
check(cas == sorted(cas, reverse=True), "recent_products sorted by created_at desc")

# --- Test 2: GET as customer ramesh -> 403 ---
# Use legacy email login for ramesh
r_login = requests.post(f"{BASE}/auth/login",
                        json={"email": "ramesh@farm.com", "password": "farmer123"},
                        timeout=20)
if r_login.status_code == 200:
    ramesh_token = r_login.json().get("access_token")
    r = requests.get(f"{BASE}/admin/inventory/summary",
                     headers={"Authorization": f"Bearer {ramesh_token}"}, timeout=20)
    check(r.status_code == 403, f"GET /admin/inventory/summary as customer -> 403 (got {r.status_code})")
else:
    print(f"   (could not login ramesh via legacy: {r_login.status_code} {r_login.text})")
    # Fallback: OTP login with a farmer phone
    customer_token = otp_login("+919876543210")
    r = requests.get(f"{BASE}/admin/inventory/summary",
                     headers={"Authorization": f"Bearer {customer_token}"}, timeout=20)
    check(r.status_code == 403, f"GET /admin/inventory/summary as customer (OTP) -> 403 (got {r.status_code})")

# --- Test 3: GET unauthenticated -> 401 ---
r = requests.get(f"{BASE}/admin/inventory/summary", timeout=20)
check(r.status_code == 401, f"GET /admin/inventory/summary unauth -> 401 (got {r.status_code})")

print()
print(f"=== RESULT: {len(passes)} PASS / {len(fails)} FAIL ===")
if fails:
    print("FAILS:")
    for f in fails:
        print(" -", f)
    sys.exit(1)

"""Quick smoke test after N+1 optimization in admin inventory/summary and
admin/dealer-users endpoints. Also checks admin-create lead + manager/me."""
import os
import sys
import time
import requests
from pymongo import MongoClient

BASE = os.environ.get(
    "BACKEND_URL",
    "https://fullstack-migration-1.preview.emergentagent.com",
).rstrip("/") + "/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "rkai_app"

ADMIN_PHONE = "+919045666666"

def admin_login():
    r = requests.post(f"{BASE}/auth/send-otp", json={"phone": ADMIN_PHONE}, timeout=30)
    assert r.status_code == 200, f"send-otp failed: {r.status_code} {r.text}"
    # Read OTP from DB
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    # Latest otp doc for this phone
    time.sleep(1)
    otp_doc = db.otps.find_one({"phone": ADMIN_PHONE}, sort=[("created_at", -1)])
    assert otp_doc, "No OTP found in DB"
    code = otp_doc.get("code") or otp_doc.get("otp")
    assert code, f"OTP code missing from doc: {otp_doc}"
    r = requests.post(
        f"{BASE}/auth/verify-otp",
        json={"phone": ADMIN_PHONE, "otp": code},
        timeout=30,
    )
    assert r.status_code == 200, f"verify-otp failed: {r.status_code} {r.text}"
    j = r.json()
    return j.get("access_token") or j.get("token")

def main():
    results = []
    def log(name, ok, detail=""):
        status = "PASS" if ok else "FAIL"
        results.append((name, ok, detail))
        print(f"[{status}] {name} — {detail}")

    try:
        token = admin_login()
        log("admin_login", True, "got token")
    except Exception as e:
        log("admin_login", False, f"login failed: {e}")
        print_summary(results)
        sys.exit(1)

    H = {"Authorization": f"Bearer {token}"}

    # 1) Inventory summary
    try:
        r = requests.get(f"{BASE}/admin/inventory/summary", headers=H, timeout=30)
        if r.status_code != 200:
            log("inventory_summary_200", False, f"{r.status_code} {r.text[:300]}")
        else:
            j = r.json()
            required = ["totals", "by_category", "recent_products", "top_priced", "out_of_stock"]
            missing = [k for k in required if k not in j]
            if missing:
                log("inventory_summary_shape", False, f"missing keys: {missing}")
            else:
                log("inventory_summary_shape", True, f"keys: {list(j.keys())}")
            by_cat = j.get("by_category", [])
            if len(by_cat) >= 10:
                log("inventory_by_category_len>=10", True, f"len={len(by_cat)}")
            else:
                log("inventory_by_category_len>=10", False, f"len={len(by_cat)}")
            row_ok = True
            row_err = ""
            for row in by_cat[:12]:
                for k in ("products_count", "avg_price", "total_value"):
                    if k not in row:
                        row_ok = False
                        row_err = f"row missing {k}: {row}"
                        break
                if not row_ok:
                    break
            log("inventory_by_category_row_shape", row_ok, row_err or "all rows have products_count/avg_price/total_value")
            # Extra: totals shape
            totals = j.get("totals") or {}
            log("inventory_totals_has_products_key", "products" in totals, f"totals keys: {list(totals.keys())}")
    except Exception as e:
        log("inventory_summary_call", False, str(e))

    # 2) dealer-users
    dealer_items = []
    try:
        r = requests.get(f"{BASE}/admin/dealer-users", headers=H, timeout=30)
        if r.status_code != 200:
            log("dealer_users_200", False, f"{r.status_code} {r.text[:300]}")
        else:
            dealer_items = r.json()
            log("dealer_users_200", True, f"count={len(dealer_items)}")
            # Every user with dealer_id should have populated dealer_profile (when dealer doc exists)
            with_did = [u for u in dealer_items if u.get("dealer_id")]
            # Pull dealer ids from DB to know which exist
            client = MongoClient(MONGO_URL)
            db = client[DB_NAME]
            existing_dealer_ids = {d["id"] for d in db.dealers.find({}, {"id": 1})}
            errors = []
            for u in with_did:
                did = u["dealer_id"]
                if did in existing_dealer_ids:
                    dp = u.get("dealer_profile")
                    if not dp or "name" not in dp or "city" not in dp:
                        errors.append(f"user {u.get('phone')} dealer_id={did} missing dealer_profile/name/city: {dp}")
            if with_did:
                if errors:
                    log("dealer_profile_populated", False, "; ".join(errors))
                else:
                    log("dealer_profile_populated", True, f"{len(with_did)} dealer users, profiles hydrated")
            else:
                log("dealer_profile_populated", True, "no users with dealer_id (vacuously true)")
    except Exception as e:
        log("dealer_users_call", False, str(e))

    # 3) Admin create lead with manager assignment
    try:
        # Find a manager with leads perm, if any
        client = MongoClient(MONGO_URL)
        db = client[DB_NAME]
        mgr = db.users.find_one({"role": "manager", "manager_perms.leads": True}, {"id": 1})
        manager_ids = [mgr["id"]] if mgr else []

        payload = {
            "name": "N1 Smoke Caller",
            "phone": "+919555000111",
            "equipment_interest": "Tiller",
            "notes": "smoke after n+1 opt",
            "manager_ids": manager_ids,
            "all_managers": False,
            "source": "call",
        }
        r = requests.post(f"{BASE}/admin/leads", headers=H, json=payload, timeout=30)
        if r.status_code != 200:
            log("admin_create_lead_200", False, f"{r.status_code} {r.text[:300]}")
        else:
            lead = r.json()
            ok = lead.get("admin_created") is True and lead.get("source") == "call"
            log("admin_create_lead_200", ok, f"id={lead.get('id')} admin_created={lead.get('admin_created')} source={lead.get('source')} assigned={lead.get('assigned_manager_ids')}")
    except Exception as e:
        log("admin_create_lead_call", False, str(e))

    # 4) manager/me as admin
    try:
        r = requests.get(f"{BASE}/manager/me", headers=H, timeout=30)
        if r.status_code != 200:
            log("manager_me_200", False, f"{r.status_code} {r.text[:300]}")
        else:
            j = r.json()
            perms = j.get("perms") or {}
            log("manager_me_200", True, f"role={j.get('role')} perms={perms}")
            has_all = all(perms.get(k) is True for k in ("leads", "service", "warranty", "points"))
            log("manager_me_perms_present", has_all, f"perms={perms}")
    except Exception as e:
        log("manager_me_call", False, str(e))

    print_summary(results)
    any_fail = any(not ok for _, ok, _ in results)
    sys.exit(1 if any_fail else 0)


def print_summary(results):
    print("\n=== SUMMARY ===")
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"{passed}/{total} PASS")
    for name, ok, detail in results:
        mark = "PASS" if ok else "FAIL"
        print(f"  [{mark}] {name}: {detail}")


if __name__ == "__main__":
    main()

"""Backend regression test for HANSA 'Manage Categories' feature.

Only tests the new /api/categories and /api/admin/categories endpoints.
"""
import os
import sys
import requests

BASE = os.environ.get(
    "BACKEND_URL", "https://farm-gear-hub-4.preview.emergentagent.com"
).rstrip("/") + "/api"

ADMIN_EMAIL = "admin@rkai.com"
ADMIN_PASSWORD = "admin123"
CUSTOMER_EMAIL = "ramesh@farm.com"
CUSTOMER_PASSWORD = "farmer123"

DEFAULT_KEYS = [
    "Tiller", "Harrow", "Plough", "Cultivator", "Subsoiler",
    "Leveller", "Weeder", "Bund Maker", "Ridger", "Trench Maker",
]

results = []  # (name, ok, detail)


def record(name, ok, detail=""):
    results.append((name, ok, detail))
    prefix = "PASS" if ok else "FAIL"
    print(f"[{prefix}] {name} :: {detail}")


def login(email, password):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=20)
    r.raise_for_status()
    return r.json()["access_token"]


def H(token):
    return {"Authorization": f"Bearer {token}"}


def main():
    admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    customer_token = login(CUSTOMER_EMAIL, CUSTOMER_PASSWORD)

    # ----- 1) GET /api/categories (public) -----
    r = requests.get(f"{BASE}/categories", timeout=15)
    ok = r.status_code == 200
    record("GET /api/categories 200", ok, f"status={r.status_code}")
    if ok:
        data = r.json()
        required_fields = {"id", "key", "label", "icon", "sort_order", "active"}
        shape_ok = isinstance(data, list) and all(required_fields.issubset(set(d.keys())) for d in data)
        record("Public categories shape", shape_ok,
               f"count={len(data)} sample_keys={list(data[0].keys()) if data else []}")
        sort_ok = all(data[i]["sort_order"] <= data[i + 1]["sort_order"] for i in range(len(data) - 1))
        record("Public categories sorted ascending by sort_order", sort_ok, "")
        keys_present = {c["key"] for c in data}
        missing = [k for k in DEFAULT_KEYS if k not in keys_present]
        record("Public categories contain 10 defaults", not missing,
               f"missing={missing}")
        active_only = all(c.get("active", True) is True for c in data)
        record("Public categories only active=true", active_only, "")

    # ----- 2) GET /api/admin/categories -----
    r = requests.get(f"{BASE}/admin/categories", headers=H(admin_token), timeout=15)
    record("GET /api/admin/categories (admin) 200", r.status_code == 200, f"status={r.status_code}")
    admin_list = r.json() if r.status_code == 200 else []

    r = requests.get(f"{BASE}/admin/categories", timeout=15)
    record("GET /api/admin/categories without auth → 401", r.status_code == 401,
           f"status={r.status_code}")

    # ----- 3a) POST valid category -----
    payload = {"key": "TestSeeder", "label": "Test Seeder", "icon": "rocket",
               "sort_order": 500, "active": True}
    r = requests.post(f"{BASE}/admin/categories", headers=H(admin_token),
                      json=payload, timeout=15)
    ok = r.status_code == 200
    record("POST /api/admin/categories valid → 200", ok, f"status={r.status_code} body={r.text[:200]}")
    new_id = None
    if ok:
        body = r.json()
        has_id = "id" in body and body.get("key") == "TestSeeder"
        record("POST response has id + key", has_id, f"body={body}")
        new_id = body.get("id")

    # ----- 3b) POST duplicate key -----
    r = requests.post(f"{BASE}/admin/categories", headers=H(admin_token),
                      json=payload, timeout=15)
    record("POST duplicate key → 400", r.status_code == 400,
           f"status={r.status_code} body={r.text[:200]}")

    # ----- 3c) POST as non-admin (customer) -----
    r = requests.post(f"{BASE}/admin/categories", headers=H(customer_token),
                      json={"key": "CustomerTry", "label": "x", "icon": "cube",
                            "sort_order": 999, "active": True}, timeout=15)
    record("POST as customer → 403", r.status_code == 403, f"status={r.status_code}")

    # ----- 4) PATCH update -----
    if new_id:
        patch_payload = {"key": "TestSeeder", "label": "Renamed",
                         "icon": "star", "sort_order": 500, "active": False}
        r = requests.patch(f"{BASE}/admin/categories/{new_id}",
                           headers=H(admin_token), json=patch_payload, timeout=15)
        ok = r.status_code == 200
        record("PATCH /api/admin/categories/{id} → 200", ok,
               f"status={r.status_code} body={r.text[:200]}")
        if ok:
            body = r.json()
            fields_ok = (body.get("icon") == "star" and body.get("label") == "Renamed"
                         and body.get("active") is False)
            record("PATCH response reflects update", fields_ok, f"body={body}")

        # Verify public list no longer includes it
        r = requests.get(f"{BASE}/categories", timeout=15)
        pub = r.json() if r.status_code == 200 else []
        record("Public list excludes inactive category",
               not any(c.get("key") == "TestSeeder" for c in pub),
               f"pub keys={[c['key'] for c in pub]}")

        # Re-PATCH to rename key → NewKey
        patch_payload2 = {"key": "NewKey", "label": "Renamed",
                          "icon": "star", "sort_order": 500, "active": False}
        r = requests.patch(f"{BASE}/admin/categories/{new_id}",
                           headers=H(admin_token), json=patch_payload2, timeout=15)
        ok = r.status_code == 200
        record("Re-PATCH with key NewKey → 200", ok,
               f"status={r.status_code} body={r.text[:200]}")
        if ok:
            body = r.json()
            record("Re-PATCH response has key:NewKey", body.get("key") == "NewKey",
                   f"body={body}")

        # ----- 5) DELETE -----
        r = requests.delete(f"{BASE}/admin/categories/{new_id}",
                            headers=H(admin_token), timeout=15)
        ok = r.status_code == 200 and r.json().get("deleted") is True
        record("DELETE /api/admin/categories/{id} → 200 {deleted:true}", ok,
               f"status={r.status_code} body={r.text[:200]}")

        r = requests.delete(f"{BASE}/admin/categories/{new_id}",
                            headers=H(admin_token), timeout=15)
        record("DELETE same id again → 404", r.status_code == 404,
               f"status={r.status_code}")

    # ----- 6) Negative -----
    r = requests.post(f"{BASE}/admin/categories", headers=H(admin_token),
                      json={"key": "", "label": "blank", "icon": "cube",
                            "sort_order": 1, "active": True}, timeout=15)
    # Accept 400 or 422 (pydantic may also reject). Spec says 400.
    record("POST empty key → 400", r.status_code == 400,
           f"status={r.status_code} body={r.text[:200]}")

    r = requests.patch(f"{BASE}/admin/categories/does-not-exist",
                       headers=H(admin_token),
                       json={"key": "X", "label": "X", "icon": "cube",
                             "sort_order": 1, "active": True}, timeout=15)
    record("PATCH non-existent id → 404", r.status_code == 404,
           f"status={r.status_code}")

    r = requests.delete(f"{BASE}/admin/categories/does-not-exist",
                        headers=H(admin_token), timeout=15)
    record("DELETE non-existent id → 404", r.status_code == 404,
           f"status={r.status_code}")

    # Summary
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"\n{'='*60}\n{passed}/{total} checks passed\n{'='*60}")
    failed = [r for r in results if not r[1]]
    if failed:
        print("FAILED:")
        for n, _, d in failed:
            print(f"  - {n} :: {d}")
        sys.exit(1)


if __name__ == "__main__":
    main()

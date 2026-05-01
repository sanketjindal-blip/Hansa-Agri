"""Backend regression tests for Manager + Service Request features.

Targets the live preview URL from frontend/.env.
Scope per review_request:
  A) Admin manager management (promote/list/patch/delete, validations)
  B) Customer service request creation (multipart + uploads + access control)
  C) Manager flow via admin token (me/list/patch SR + leads)
  D) Permission gating (customer cannot hit manager/admin endpoints)
"""
import io
import sys
import uuid

import requests

BASE_URL = "https://farm-gear-hub-4.preview.emergentagent.com"
API = BASE_URL + "/api"

ADMIN_EMAIL = "admin@rkai.com"
ADMIN_PASSWORD = "admin123"
CUST_EMAIL = "ramesh@farm.com"
CUST_PASSWORD = "farmer123"

results = []


def record(name, passed, detail=""):
    results.append((name, passed, detail))
    mark = "PASS" if passed else "FAIL"
    tail = f"  {detail}" if not passed else ""
    print(f"[{mark}] {name}{tail}")


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    if r.status_code != 200:
        raise RuntimeError(f"Login failed for {email}: {r.status_code} {r.text}")
    return r.json()["access_token"]


def hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


def setup_tokens():
    return login(ADMIN_EMAIL, ADMIN_PASSWORD), login(CUST_EMAIL, CUST_PASSWORD)


# -------------------------------
# A) Admin manager management
# -------------------------------
def test_admin_managers(admin_tok):
    mgr_phone = "9991110099"
    mgr_e164 = "+919991110099"

    r = requests.get(f"{API}/admin/managers", headers=hdr(admin_tok), timeout=30)
    if r.status_code == 200:
        for m in r.json():
            if m.get("phone") == mgr_e164:
                requests.delete(f"{API}/admin/managers/{m['id']}", headers=hdr(admin_tok), timeout=30)

    body = {"phone": mgr_phone, "name": "Mgr Test", "perms_leads": True, "perms_service": True}
    r = requests.post(f"{API}/admin/managers", json=body, headers=hdr(admin_tok), timeout=30)
    ok = r.status_code == 200 and r.json().get("role") == "manager" \
        and r.json().get("manager_perms", {}) == {"leads": True, "service": True}
    record("A1 POST /admin/managers creates manager", ok, f"status={r.status_code} body={r.text[:200]}")
    mgr_id = r.json().get("id") if r.status_code == 200 else None
    if not mgr_id:
        return None

    r = requests.get(f"{API}/admin/managers", headers=hdr(admin_tok), timeout=30)
    ok = r.status_code == 200 and any(m.get("id") == mgr_id for m in r.json())
    record("A2 GET /admin/managers contains new manager", ok, f"status={r.status_code}")

    r = requests.patch(f"{API}/admin/managers/{mgr_id}",
                       json={"perms_leads": True, "perms_service": False},
                       headers=hdr(admin_tok), timeout=30)
    ok = r.status_code == 200 and r.json().get("manager_perms") == {"leads": True, "service": False}
    record("A3 PATCH /admin/managers/{id} updates perms", ok, f"status={r.status_code} body={r.text[:200]}")

    r = requests.patch(f"{API}/admin/managers/{mgr_id}",
                       json={"perms_leads": False, "perms_service": False},
                       headers=hdr(admin_tok), timeout=30)
    ok = r.status_code == 400 and "at least one" in r.text.lower()
    record("A4 PATCH both perms false -> 400", ok, f"status={r.status_code} body={r.text[:200]}")

    r = requests.post(f"{API}/admin/managers",
                      json={"phone": "123", "name": "Bad", "perms_leads": True, "perms_service": True},
                      headers=hdr(admin_tok), timeout=30)
    ok = r.status_code == 400
    record("A5 POST invalid phone -> 400", ok, f"status={r.status_code} body={r.text[:200]}")

    r = requests.post(f"{API}/admin/managers",
                      json={"phone": "9991110088", "name": "Bad Perms",
                            "perms_leads": False, "perms_service": False},
                      headers=hdr(admin_tok), timeout=30)
    ok = r.status_code == 400
    record("A6 POST both perms false -> 400", ok, f"status={r.status_code} body={r.text[:200]}")

    return mgr_id


def test_delete_manager(admin_tok, mgr_id):
    r = requests.delete(f"{API}/admin/managers/{mgr_id}", headers=hdr(admin_tok), timeout=30)
    ok = r.status_code == 200 and r.json().get("demoted") is True
    record("A7a DELETE /admin/managers/{id} -> demoted:true", ok, f"status={r.status_code} body={r.text[:200]}")

    r = requests.get(f"{API}/admin/managers", headers=hdr(admin_tok), timeout=30)
    ok = r.status_code == 200 and not any(m.get("id") == mgr_id for m in r.json())
    record("A7b GET /admin/managers no longer has deleted mgr", ok, f"status={r.status_code}")


# -------------------------------
# B) Service requests
# -------------------------------
def _tiny_jpg_bytes():
    """Smallest valid JPEG (SOI/APP0/DQT/SOF/DHT/SOS/EOI) approx 400 bytes."""
    return bytes.fromhex(
        "ffd8ffe000104a46494600010100000100010000"
        "ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c2024"
        "2e2720222c231c1c2837292c30313434341f27393d38323c2e33343238"
        "ffc0000b08000100010101011100"
        "ffc4001f0000010501010101010100000000000000000102030405060708090a0b"
        "ffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f024336272820a162434e125f11718191a262728292a35363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9fa"
        "ffda0008010100003f00fb"
        "ffd9"
    )


def test_service_requests(cust_tok):
    sr_id = None
    photo_filename = None

    jpg = _tiny_jpg_bytes()
    files = {"photo": ("engine.jpg", io.BytesIO(jpg), "image/jpeg")}
    data = {"title": "Engine issue", "description": "Engine cuts off"}
    r = requests.post(f"{API}/service-requests", data=data, files=files,
                      headers=hdr(cust_tok), timeout=60)
    ok = False
    detail = f"status={r.status_code} body={r.text[:300]}"
    if r.status_code == 200:
        j = r.json()
        ok = bool(
            j.get("id")
            and j.get("status") == "open"
            and j.get("photo") and j["photo"].get("url", "").startswith("/api/uploads/")
            and isinstance(j.get("timeline"), list) and len(j["timeline"]) == 1
        )
        sr_id = j.get("id")
        if j.get("photo"):
            photo_filename = j["photo"].get("filename")
    record("B1 POST /service-requests multipart jpg", ok, detail)

    r = requests.get(f"{API}/service-requests/mine", headers=hdr(cust_tok), timeout=30)
    ok = r.status_code == 200 and isinstance(r.json(), list) and any(s.get("id") == sr_id for s in r.json())
    record("B2 GET /service-requests/mine contains new SR", ok, f"status={r.status_code}")

    if sr_id:
        r = requests.get(f"{API}/service-requests/{sr_id}", headers=hdr(cust_tok), timeout=30)
        ok = r.status_code == 200 and r.json().get("id") == sr_id
        record("B3 GET /service-requests/{id} as owner", ok, f"status={r.status_code}")

    r = requests.post(f"{API}/service-requests",
                      data={"description": "no title here"},
                      headers=hdr(cust_tok), timeout=30)
    ok = r.status_code in (400, 422)
    record("B4a POST no title -> 400/422", ok, f"status={r.status_code} body={r.text[:200]}")

    r = requests.post(f"{API}/service-requests",
                      data={"title": "Title", "description": "   "},
                      headers=hdr(cust_tok), timeout=30)
    ok = r.status_code == 400
    record("B4b POST empty description -> 400", ok, f"status={r.status_code} body={r.text[:200]}")

    files = {"photo": ("fake.gif", io.BytesIO(b"GIF89a" + b"\x00" * 32), "image/gif")}
    r = requests.post(f"{API}/service-requests",
                      data={"title": "ext", "description": "desc"},
                      files=files, headers=hdr(cust_tok), timeout=30)
    ok = r.status_code == 400
    record("B5 POST with wrong ext .gif -> 400", ok, f"status={r.status_code} body={r.text[:200]}")

    if photo_filename:
        r = requests.get(f"{API}/uploads/{photo_filename}", timeout=30)
        ok = r.status_code == 200 and len(r.content) > 0
        record("B6 GET /uploads/{filename} serves file", ok, f"status={r.status_code} bytes={len(r.content)}")

    url = f"{API}/uploads/..%2Fetc%2Fpasswd"
    r = requests.get(url, timeout=30)
    ok = r.status_code in (404, 400)
    record("B7 GET /uploads traversal attempt -> 404", ok, f"status={r.status_code} body={r.text[:200]}")

    return sr_id


# -------------------------------
# C) Manager flow
# -------------------------------
def test_manager_flow(admin_tok, sr_id):
    r = requests.get(f"{API}/manager/me", headers=hdr(admin_tok), timeout=30)
    ok = (r.status_code == 200 and
          r.json().get("perms", {}).get("leads") is True and
          r.json().get("perms", {}).get("service") is True)
    record("C1 GET /manager/me as admin returns perms.leads&service", ok,
           f"status={r.status_code} body={r.text[:300]}")

    r = requests.get(f"{API}/manager/service-requests", headers=hdr(admin_tok), timeout=30)
    ok = r.status_code == 200 and isinstance(r.json(), list) and any(s.get("id") == sr_id for s in r.json())
    record("C2 GET /manager/service-requests contains SR", ok, f"status={r.status_code}")

    r = requests.patch(f"{API}/manager/service-requests/{sr_id}",
                       json={"status": "in_progress", "note": "Tech assigned"},
                       headers=hdr(admin_tok), timeout=30)
    ok = False
    detail = f"status={r.status_code} body={r.text[:300]}"
    if r.status_code == 200:
        j = r.json()
        ok = j.get("status") == "in_progress" and len(j.get("timeline", [])) == 2
    record("C3 PATCH SR -> in_progress, timeline grew", ok, detail)

    r = requests.patch(f"{API}/manager/service-requests/{sr_id}",
                       json={"status": "resolved", "resolution": "Replaced filter"},
                       headers=hdr(admin_tok), timeout=30)
    ok = (r.status_code == 200 and
          r.json().get("status") == "resolved" and
          r.json().get("resolution") == "Replaced filter")
    record("C4 PATCH SR -> resolved + resolution stored", ok, f"status={r.status_code} body={r.text[:300]}")

    r = requests.patch(f"{API}/manager/service-requests/{sr_id}",
                       json={"status": "foobar"},
                       headers=hdr(admin_tok), timeout=30)
    ok = r.status_code == 400
    record("C5 PATCH invalid status -> 400", ok, f"status={r.status_code} body={r.text[:200]}")

    fake_id = str(uuid.uuid4())
    r = requests.patch(f"{API}/manager/service-requests/{fake_id}",
                       json={"status": "in_progress"},
                       headers=hdr(admin_tok), timeout=30)
    ok = r.status_code == 404
    record("C6 PATCH non-existent id -> 404", ok, f"status={r.status_code} body={r.text[:200]}")

    r = requests.get(f"{API}/manager/leads", headers=hdr(admin_tok), timeout=30)
    ok = r.status_code == 200 and isinstance(r.json(), list)
    record("C7 GET /manager/leads (admin) -> 200 list", ok, f"status={r.status_code}")


# -------------------------------
# D) Permission gating
# -------------------------------
def test_gating(cust_tok):
    r = requests.get(f"{API}/manager/service-requests", headers=hdr(cust_tok), timeout=30)
    ok = r.status_code == 403
    record("D1 customer GET /manager/service-requests -> 403", ok, f"status={r.status_code} body={r.text[:200]}")

    r = requests.get(f"{API}/manager/leads", headers=hdr(cust_tok), timeout=30)
    ok = r.status_code == 403
    record("D2 customer GET /manager/leads -> 403", ok, f"status={r.status_code} body={r.text[:200]}")

    r = requests.post(f"{API}/admin/managers",
                      json={"phone": "9991110077", "perms_leads": True, "perms_service": True},
                      headers=hdr(cust_tok), timeout=30)
    ok = r.status_code == 403
    record("D3 customer POST /admin/managers -> 403", ok, f"status={r.status_code} body={r.text[:200]}")


def main():
    print(f"Base: {BASE_URL}")
    admin_tok, cust_tok = setup_tokens()
    print("Tokens OK")

    mgr_id = test_admin_managers(admin_tok)
    sr_id = test_service_requests(cust_tok)
    if sr_id:
        test_manager_flow(admin_tok, sr_id)
    else:
        record("C (skipped)", False, "No SR id from B1")
    test_gating(cust_tok)

    if mgr_id:
        test_delete_manager(admin_tok, mgr_id)

    passed = sum(1 for _, p, _ in results if p)
    total = len(results)
    print("\n" + "=" * 60)
    print(f"RESULT: {passed}/{total} passed")
    for name, ok, detail in results:
        if not ok:
            print(f"  - FAIL {name}  {detail}")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())

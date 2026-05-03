"""HANSA backend quick regression after frontend integration session."""
import os
import sys
import uuid
import requests

BASE = os.environ.get("BASE_URL", "https://fullstack-migration-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

results = []


def log(ok_, name, detail=""):
    status = "PASS" if ok_ else "FAIL"
    marker = "[+]" if ok_ else "[X]"
    line = f"{marker} {status}: {name}" + (f" -- {detail}" if detail else "")
    print(line)
    results.append((ok_, name, detail))


def post(path, token=None, **kw):
    h = kw.pop("headers", {}) or {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.post(API + path, headers=h, timeout=30, **kw)


def patch(path, token=None, **kw):
    h = kw.pop("headers", {}) or {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.patch(API + path, headers=h, timeout=30, **kw)


def get(path, token=None, **kw):
    h = kw.pop("headers", {}) or {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.get(API + path, headers=h, timeout=30, **kw)


def delete(path, token=None, **kw):
    h = kw.pop("headers", {}) or {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.delete(API + path, headers=h, timeout=30, **kw)


def admin_login():
    r = post("/auth/login", json={"email": "admin@rkai.com", "password": "admin123"})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    j = r.json()
    return j["access_token"], j["user"]


def customer_login_email(email, password):
    r = post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login {email} failed: {r.status_code} {r.text}"
    j = r.json()
    return j["access_token"], j["user"]


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
    j = r2.json()
    return j["access_token"], j["user"]


def ok(resp):
    return 200 <= resp.status_code < 300


def main():
    print(f"Running regression against: {API}\n")
    admin_tok, admin_user = admin_login()
    log(True, "Admin login (legacy email)", f"admin id={admin_user['id']}")

    try:
        ramesh_tok, ramesh = customer_login_email("ramesh@farm.com", "farmer123")
        log(True, "Ramesh login", f"id={ramesh['id']} phone={ramesh.get('phone')}")
    except AssertionError as e:
        log(False, "Ramesh login", str(e))
        ramesh_tok, ramesh = None, None

    # 1) Manager CRUD
    mgr_phone = "+919999300011"
    r = post("/admin/managers", token=admin_tok, json={
        "phone": mgr_phone, "perms_leads": True, "perms_service": True,
        "perms_warranty": True, "perms_points": True,
    })
    mgr_id = None
    if r.status_code == 200:
        j = r.json()
        perms = j.get("manager_perms", {})
        all_on = all(perms.get(k) is True for k in ("leads", "service", "warranty", "points"))
        log(all_on, "1a POST /admin/managers all-4-perms=true",
            f"status=200 perms={perms}")
        mgr_id = j["id"]
    else:
        log(False, "1a POST /admin/managers all-4-perms=true",
            f"HTTP {r.status_code}: {r.text[:200]}")

    if mgr_id:
        r = patch(f"/admin/managers/{mgr_id}", token=admin_tok, json={
            "perms_leads": True, "perms_service": False,
            "perms_warranty": True, "perms_points": False,
        })
        if r.status_code == 200:
            perms = r.json().get("manager_perms", {})
            saved = (perms.get("leads") is True and perms.get("service") is False
                     and perms.get("warranty") is True and perms.get("points") is False)
            log(saved, "1b PATCH /admin/managers toggle", f"perms={perms}")
        else:
            log(False, "1b PATCH /admin/managers toggle",
                f"HTTP {r.status_code}: {r.text[:200]}")
        r = delete(f"/admin/managers/{mgr_id}", token=admin_tok)
        log(r.status_code == 200 and r.json().get("demoted") is True,
            "1c DELETE /admin/managers", f"HTTP {r.status_code} body={r.text[:120]}")

    # 2) Lead PATCH backward-compat
    lead_id = None
    if ramesh_tok:
        lead_phone = "+919" + str(uuid.uuid4().int)[:9]
        r = post("/leads", token=ramesh_tok, json={
            "name": "Suresh Testcase", "phone": lead_phone,
            "equipment_interest": "Tiller", "notes": "Interested in demo",
        })
        if r.status_code in (200, 201):
            lead_id = r.json()["id"]
            log(True, "2a POST /leads as ramesh", f"lead_id={lead_id}")
        else:
            # Try /loyalty/leads
            r2 = post("/loyalty/leads", token=ramesh_tok, json={
                "name": "Suresh Testcase", "phone": lead_phone,
                "equipment_interest": "Tiller", "notes": "Interested in demo",
            })
            if r2.status_code in (200, 201):
                lead_id = r2.json()["id"]
                log(True, "2a POST /loyalty/leads (fallback)", f"lead_id={lead_id}")
            else:
                log(False, "2a POST /leads", f"HTTP {r.status_code}: {r.text[:200]} / alt HTTP {r2.status_code}: {r2.text[:200]}")

    if lead_id:
        r = patch(f"/admin/leads/{lead_id}", token=admin_tok, json={
            "status": "contacted", "notes": "old field works",
        })
        if r.status_code == 200:
            tl = r.json().get("timeline", [])
            last = tl[-1] if tl else {}
            log(last.get("remark") == "old field works",
                "2b PATCH /admin/leads {notes} legacy alias",
                f"last remark={last.get('remark')!r} tl_len={len(tl)}")
        else:
            log(False, "2b PATCH /admin/leads legacy notes",
                f"HTTP {r.status_code}: {r.text[:200]}")
        r = patch(f"/admin/leads/{lead_id}", token=admin_tok, json={
            "status": "lost", "remark": "new remark field works",
        })
        if r.status_code == 200:
            tl = r.json().get("timeline", [])
            last = tl[-1] if tl else {}
            log(last.get("remark") == "new remark field works",
                "2c PATCH /admin/leads {remark} new field",
                f"tl_len={len(tl)} last={last.get('remark')!r}")
        else:
            log(False, "2c PATCH /admin/leads remark",
                f"HTTP {r.status_code}: {r.text[:200]}")

    # 3) Dealer endpoint regression
    r = get("/admin/dealer-users", token=admin_tok)
    dealer_tok = None
    dealer_user_id = None
    if r.status_code == 200 and isinstance(r.json(), list) and r.json():
        for d in r.json():
            if d.get("phone"):
                dealer_phone = d["phone"]
                dealer_user_id = d["id"]
                try:
                    dealer_tok, _ = otp_login(dealer_phone)
                    log(True, "3-pre dealer OTP login",
                        f"dealer={dealer_user_id} phone={dealer_phone}")
                    break
                except Exception as e:
                    log(False, f"3-pre dealer OTP login {dealer_phone}", str(e))
    else:
        log(False, "3-pre GET /admin/dealer-users",
            f"HTTP {r.status_code}: {r.text[:150]}")

    test_lead_for_dealer = None
    if dealer_tok:
        r = get("/dealer/leads", token=dealer_tok)
        log(r.status_code == 200, "3a GET /dealer/leads",
            f"HTTP {r.status_code} count={len(r.json()) if ok(r) else '?'}")

        if ramesh_tok and dealer_user_id:
            lp = "+919" + str(uuid.uuid4().int)[:9]
            rr = post("/leads", token=ramesh_tok,
                      json={"name": "Dealer PATCH Test Lead", "phone": lp})
            if rr.status_code in (200, 201):
                test_lead_for_dealer = rr.json()["id"]
                ra = post(f"/admin/leads/{test_lead_for_dealer}/assign-dealers",
                          token=admin_tok,
                          json={"dealer_user_ids": [dealer_user_id], "note": "setup"})
                if ra.status_code != 200:
                    log(False, "3-setup assign-dealers",
                        f"HTTP {ra.status_code}: {ra.text[:150]}")

        if test_lead_for_dealer:
            r = patch(f"/dealer/leads/{test_lead_for_dealer}", token=dealer_tok,
                      json={"status": "contacted", "notes": "dealer legacy notes"})
            if r.status_code == 200:
                tl = r.json().get("timeline", [])
                last = tl[-1] if tl else {}
                log(last.get("remark") == "dealer legacy notes",
                    "3b PATCH /dealer/leads {status, notes}",
                    f"last remark={last.get('remark')!r}")
            else:
                log(False, "3b PATCH /dealer/leads notes",
                    f"HTTP {r.status_code}: {r.text[:180]}")

            r = patch(f"/dealer/leads/{test_lead_for_dealer}", token=dealer_tok,
                      json={"status": "contacted", "remark": "dealer new remark"})
            if r.status_code == 200:
                tl = r.json().get("timeline", [])
                last = tl[-1] if tl else {}
                log(last.get("remark") == "dealer new remark",
                    "3c PATCH /dealer/leads {status, remark}",
                    f"last remark={last.get('remark')!r}")
            else:
                log(False, "3c PATCH /dealer/leads remark",
                    f"HTTP {r.status_code}: {r.text[:180]}")

    # 4) Admin assign-dealers + /admin/dealer-users
    if dealer_user_id and ramesh_tok:
        lp = "+919" + str(uuid.uuid4().int)[:9]
        rr = post("/leads", token=ramesh_tok,
                  json={"name": "Assign-Dealers Test", "phone": lp})
        if rr.status_code in (200, 201):
            fresh_id = rr.json()["id"]
            r = post(f"/admin/leads/{fresh_id}/assign-dealers",
                     token=admin_tok,
                     json={"dealer_user_ids": [dealer_user_id], "note": "test"})
            if r.status_code == 200:
                lead = r.json()
                assigned = lead.get("assigned_dealer_user_ids") or []
                tl_len = len(lead.get("timeline") or [])
                log(dealer_user_id in assigned and tl_len >= 2,
                    "4a POST /admin/leads/{id}/assign-dealers",
                    f"assigned={assigned} tl_len={tl_len}")
            else:
                log(False, "4a POST /admin/leads/{id}/assign-dealers",
                    f"HTTP {r.status_code}: {r.text[:200]}")
        else:
            log(False, "4a setup POST /leads", f"HTTP {rr.status_code}")

    # Review says "POST /api/admin/dealer-users -> 200 (admin only)" but the
    # implementation uses GET. Verify both.
    r = get("/admin/dealer-users", token=admin_tok)
    log(r.status_code == 200, "4b GET /admin/dealer-users admin=200",
        f"HTTP {r.status_code} count={len(r.json()) if ok(r) else '?'}")
    if ramesh_tok:
        r = get("/admin/dealer-users", token=ramesh_tok)
        log(r.status_code in (401, 403),
            "4b-neg /admin/dealer-users non-admin blocked",
            f"HTTP {r.status_code}")

    # 5) Backwards-compat PATCH /manager/service-requests with note alias
    sr_id = None
    if ramesh_tok:
        rr = get("/admin/service-requests", token=admin_tok)
        if rr.status_code == 200 and isinstance(rr.json(), list) and rr.json():
            # Prefer a non-resolved, non-closed one
            eligible = [s for s in rr.json() if s.get("status") not in ("closed", "cancelled", "resolved")]
            sr_id = eligible[0]["id"] if eligible else rr.json()[0]["id"]
        if not sr_id:
            jpg = bytes.fromhex(
                "ffd8ffe000104a46494600010101006000600000ffdb004300080606070605080707070909"
                "080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c3034"
                "38383822272d4043402d4345323837ffc0000b080001000101011100ffc400160000010100000"
                "00000000000000000000009ffda0008010100003f00bfffd9"
            )
            files = {"photo": ("t.jpg", jpg, "image/jpeg")}
            data = {"title": "BWC Note Test", "description": "Testing note alias backcompat"}
            rr = requests.post(API + "/service-requests", files=files, data=data,
                               headers={"Authorization": f"Bearer {ramesh_tok}"}, timeout=30)
            if rr.status_code == 200:
                sr_id = rr.json()["id"]
            else:
                log(False, "5-setup create SR",
                    f"HTTP {rr.status_code}: {rr.text[:200]}")
        if sr_id:
            r = patch(f"/manager/service-requests/{sr_id}", token=admin_tok,
                      json={"status": "in_progress", "note": "works", "resolution": ""})
            if r.status_code == 200:
                tl = r.json().get("timeline", [])
                last = tl[-1] if tl else {}
                log(last.get("remark") == "works",
                    "5 PATCH /manager/service-requests {note alias}",
                    f"last remark={last.get('remark')!r}")
            else:
                log(False, "5 PATCH /manager/service-requests note alias",
                    f"HTTP {r.status_code}: {r.text[:200]}")

    print("\n" + "=" * 70)
    passed = sum(1 for a, _, _ in results if a)
    failed = sum(1 for a, _, _ in results if not a)
    print(f"TOTAL: {passed} PASS / {failed} FAIL")
    if failed:
        print("\nFailures:")
        for a, n, d in results:
            if not a:
                print(f"  - {n}: {d}")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()

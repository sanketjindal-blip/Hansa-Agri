"""Retest previously failing admin-lead PATCH purchased flow after loyalty.py fix."""
import os
import sys
import requests

BASE = "https://farm-gear-hub-4.preview.emergentagent.com/api"

results = []
def rec(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'}: {name}  {detail}")


def admin_token():
    # Legacy email login still works per test_credentials.md
    r = requests.post(f"{BASE}/auth/login", json={"email": "admin@rkai.com", "password": "admin123"}, timeout=20)
    if r.status_code != 200:
        # Try OTP on admin phone
        phone = "+919045666666"
        requests.post(f"{BASE}/auth/send-otp", json={"phone": phone}, timeout=20)
        # Read OTP directly from DB via helper - no direct DB here; fallback
        raise RuntimeError(f"Admin login failed: {r.status_code} {r.text}")
    return r.json()["access_token"]


def main():
    tok = admin_token()
    H = {"Authorization": f"Bearer {tok}"}

    # 1) Create admin-created lead
    body = {
        "name": "Retest Caller",
        "phone": "+919999000333",
        "manager_ids": [],
        "all_managers": False,
    }
    r = requests.post(f"{BASE}/admin/leads", json=body, headers=H, timeout=20)
    rec("POST /admin/leads 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
    if r.status_code != 200:
        return summary()
    lead = r.json()
    lead_id = lead.get("id")
    rec("lead.admin_created==True", lead.get("admin_created") is True, f"admin_created={lead.get('admin_created')}")
    rec("lead.referrer_user_id==''", lead.get("referrer_user_id") == "", f"referrer_user_id={lead.get('referrer_user_id')!r}")
    rec("lead.assigned_manager_ids==[]", lead.get("assigned_manager_ids") == [], f"assigned_manager_ids={lead.get('assigned_manager_ids')}")

    # 2) PATCH to purchased - MUST be 200 (regression fix)
    r = requests.patch(
        f"{BASE}/admin/leads/{lead_id}",
        json={"status": "purchased", "notes": ""},
        headers=H, timeout=20,
    )
    rec("PATCH /admin/leads/{id} purchased -> 200 (no 400)", r.status_code == 200,
        f"status={r.status_code} body={r.text[:300]}")
    if r.status_code >= 500:
        rec("5xx check", False, f"Server error {r.status_code}")
    if r.status_code == 200:
        updated = r.json()
        rec("updated.status=='purchased'", updated.get("status") == "purchased", f"status={updated.get('status')}")
        pts = updated.get("points_awarded", 0)
        rec("points_awarded is 0/absent (no referral payout)", (not pts) or pts == 0, f"points_awarded={pts}")

    # 3) Sanity: verify original referral payout still works. Find a pre-existing
    # customer-referred lead in 'new' state (admin_created != True, referrer_user_id truthy).
    r = requests.get(f"{BASE}/admin/leads?status=new", headers=H, timeout=20)
    if r.status_code == 200:
        candidates = [l for l in r.json()
                      if l.get("referrer_user_id")
                      and not l.get("admin_created")
                      and not l.get("points_awarded")]
        if candidates:
            cand = candidates[0]
            ref_uid = cand["referrer_user_id"]
            # Get referrer's balance BEFORE
            ru = requests.get(f"{BASE}/admin/users?q={cand.get('referrer_phone','')}", headers=H, timeout=20)
            bal_before = None
            if ru.status_code == 200:
                for u in ru.json():
                    if u.get("id") == ref_uid:
                        bal_before = int(u.get("points") or 0)
                        break
            if bal_before is None:
                # Fallback: use any phone search
                rec("referrer lookup", False, "could not find referrer user for sanity test")
            else:
                # Mark purchased
                pr = requests.patch(
                    f"{BASE}/admin/leads/{cand['id']}",
                    json={"status": "purchased", "notes": ""},
                    headers=H, timeout=20,
                )
                rec("Sanity: customer-referred lead PATCH purchased 200", pr.status_code == 200,
                    f"status={pr.status_code} body={pr.text[:200]}")
                if pr.status_code == 200:
                    rec("Sanity: points_awarded==500", pr.json().get("points_awarded") == 500,
                        f"points_awarded={pr.json().get('points_awarded')}")
                    # Check balance AFTER
                    ru2 = requests.get(f"{BASE}/admin/users?q={cand.get('referrer_phone','')}", headers=H, timeout=20)
                    bal_after = None
                    if ru2.status_code == 200:
                        for u in ru2.json():
                            if u.get("id") == ref_uid:
                                bal_after = int(u.get("points") or 0)
                                break
                    rec("Sanity: referrer balance +=500",
                        bal_after is not None and bal_after - bal_before == 500,
                        f"before={bal_before} after={bal_after} delta={None if bal_after is None else bal_after-bal_before}")
        else:
            rec("Sanity: pre-existing customer-referred lead", True,
                "SKIPPED - no eligible customer-referred lead in 'new' state (not a failure)")
    else:
        rec("GET /admin/leads?status=new 200", False, f"status={r.status_code}")

    # 4) GET /admin/leads shows retest lead with status=purchased
    r = requests.get(f"{BASE}/admin/leads", headers=H, timeout=20)
    ok = False
    if r.status_code == 200:
        for l in r.json():
            if l.get("id") == lead_id:
                ok = l.get("status") == "purchased"
                break
    rec("GET /admin/leads shows retest lead status=purchased", ok, f"")

    return summary()


def summary():
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"\n=== {passed}/{total} passed ===")
    for name, ok, detail in results:
        if not ok:
            print(f"  FAIL: {name}  {detail}")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())

"""Backend regression for HANSA new features:
- Notifications
- Admin Lead create/assign
- Admin Service Request list/assign
- Manager assignment-based filtering
- Customer SR notification on status update
"""
import os, sys, io, json, time, requests
from pathlib import Path
from PIL import Image
from pymongo import MongoClient

BASE = "https://fullstack-migration-1.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "rkai_app"
mdb = MongoClient(MONGO_URL)[DB_NAME]

PASSED, FAILED = [], []

def step(name, ok, detail=""):
    if ok:
        PASSED.append(name)
        print(f"  PASS  {name}")
    else:
        FAILED.append((name, detail))
        print(f"  FAIL  {name} :: {detail}")

def post(path, **kw):
    return requests.post(BASE + path, timeout=30, **kw)
def get(path, **kw):
    return requests.get(BASE + path, timeout=30, **kw)
def patch(path, **kw):
    return requests.patch(BASE + path, timeout=30, **kw)
def delete(path, **kw):
    return requests.delete(BASE + path, timeout=30, **kw)


def get_otp_from_db(phone):
    rec = mdb.otps.find_one({"phone": phone})
    return rec["code"] if rec else None


def login_admin_email():
    r = post("/auth/login", json={"email": "admin@rkai.com", "password": "admin123"})
    if r.status_code == 200:
        return r.json()["access_token"], r.json()["user"]
    return None, None


def login_phone(phone10):
    """Send OTP, read it from DB, verify."""
    r = post("/auth/send-otp", json={"phone": phone10})
    assert r.status_code == 200, f"send-otp failed: {r.status_code} {r.text}"
    norm_phone = r.json()["phone"]
    code = get_otp_from_db(norm_phone)
    if not code:
        raise RuntimeError(f"No OTP for {norm_phone}")
    r2 = post("/auth/verify-otp", json={"phone": phone10, "otp": code})
    assert r2.status_code == 200, f"verify-otp failed: {r2.status_code} {r2.text}"
    j = r2.json()
    return j["access_token"], j["user"]


def login_customer_email():
    r = post("/auth/login", json={"email": "ramesh@farm.com", "password": "ramesh123"})
    if r.status_code == 200:
        return r.json()["access_token"], r.json()["user"]
    # try farmer123
    r = post("/auth/login", json={"email": "ramesh@farm.com", "password": "farmer123"})
    if r.status_code == 200:
        return r.json()["access_token"], r.json()["user"]
    return None, None


def auth_h(tok):
    return {"Authorization": f"Bearer {tok}"}


def main():
    print("\n=== AUTH ===")
    admin_tok, admin_user = login_admin_email()
    if admin_tok:
        step("Admin email login", True, f"role={admin_user.get('role')}")
    else:
        # fallback to phone OTP
        admin_tok, admin_user = login_phone("9045666666")
        step("Admin phone OTP login", admin_user.get("role") == "admin",
             f"role={admin_user.get('role')}")
    assert admin_tok

    cust_tok, cust_user = login_customer_email()
    step("Customer ramesh login", cust_tok is not None and cust_user.get("role") == "customer",
         f"user={cust_user}")
    assert cust_tok

    # ============ B) Create 2 managers ============
    print("\n=== B) Create test managers ===")
    # Cleanup any pre-existing managers with these phones
    for p in ("+919999988887", "+919999988888"):
        u = mdb.users.find_one({"phone": p})
        if u:
            mdb.users.update_one(
                {"id": u["id"]},
                {"$set": {"role": "customer"}, "$unset": {"manager_perms": ""}}
            )

    r = post("/admin/managers", headers=auth_h(admin_tok),
             json={"phone": "9999988887", "name": "Mgr Both",
                   "perms_leads": True, "perms_service": True})
    step("Promote mgr1 (leads+service)", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    mgr1 = r.json()
    mgr1_id = mgr1["id"]
    step("mgr1 has leads+service perms",
         mgr1.get("manager_perms", {}).get("leads") and mgr1["manager_perms"].get("service"),
         f"{mgr1.get('manager_perms')}")

    r = post("/admin/managers", headers=auth_h(admin_tok),
             json={"phone": "9999988888", "name": "Mgr Service Only",
                   "perms_leads": False, "perms_service": True})
    step("Promote mgr2 (service only)", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    mgr2 = r.json()
    mgr2_id = mgr2["id"]
    step("mgr2 has service-only perms",
         (not mgr2.get("manager_perms", {}).get("leads")) and mgr2["manager_perms"].get("service"),
         f"{mgr2.get('manager_perms')}")

    # Login as managers via OTP for cross-user isolation tests
    mgr1_tok, _ = login_phone("9999988887")
    mgr2_tok, _ = login_phone("9999988888")
    step("mgr1 OTP login", mgr1_tok is not None)
    step("mgr2 OTP login", mgr2_tok is not None)

    # ============ A) Notifications ============
    print("\n=== A) Notifications ===")

    # 401 without auth
    r = get("/notifications")
    step("GET /notifications without auth -> 401", r.status_code == 401, f"{r.status_code}")

    # mgr1: list (should be empty or include any old notifs)
    r = get("/notifications", headers=auth_h(mgr1_tok))
    step("GET /notifications (mgr1) 200", r.status_code == 200, r.text[:200])
    j = r.json()
    step("Response shape items+unread_count",
         "items" in j and "unread_count" in j and isinstance(j["items"], list),
         f"keys={list(j.keys())}")
    initial_mgr1_unread = j["unread_count"]

    r = get("/notifications/unread-count", headers=auth_h(mgr1_tok))
    step("GET /notifications/unread-count (mgr1) 200",
         r.status_code == 200 and "unread_count" in r.json(),
         f"{r.status_code} {r.text[:200]}")

    # mgr2 baseline
    r = get("/notifications", headers=auth_h(mgr2_tok))
    step("GET /notifications (mgr2) 200", r.status_code == 200, r.text[:200])
    initial_mgr2_unread = r.json()["unread_count"]

    # ============ C) Admin Lead create + assign ============
    print("\n=== C) Admin Lead create + assign ===")

    # 1) Lead assigned to mgr1 only
    r = post("/admin/leads", headers=auth_h(admin_tok),
             json={"name": "Test Caller", "phone": "+919999000111",
                   "equipment_interest": "Tiller", "notes": "Wants demo",
                   "manager_ids": [mgr1_id], "all_managers": False})
    step("POST /admin/leads (mgr1 only) 200", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    lead1 = r.json()
    step("admin_created=True", lead1.get("admin_created") is True, f"{lead1}")
    step("source='call'", lead1.get("source") == "call", f"source={lead1.get('source')}")
    step("referrer_user_id is empty (no auto-payout)",
         lead1.get("referrer_user_id") == "", f"referrer_user_id={lead1.get('referrer_user_id')}")
    step("assigned_manager_ids == [mgr1_id]",
         lead1.get("assigned_manager_ids") == [mgr1_id],
         f"got={lead1.get('assigned_manager_ids')}")
    lead1_id = lead1["id"]

    # Check mgr1 received notification
    time.sleep(0.5)
    r = get("/notifications", headers=auth_h(mgr1_tok))
    notifs1 = r.json()["items"]
    has_lead_assigned = any(n["type"] == "lead_assigned" and n["ref_id"] == lead1_id for n in notifs1)
    step("mgr1 has notification type=lead_assigned for lead1",
         has_lead_assigned,
         f"types={[n.get('type') for n in notifs1[:5]]}")

    # mgr2 should NOT have this lead notification
    r = get("/notifications", headers=auth_h(mgr2_tok))
    notifs2 = r.json()["items"]
    mgr2_has_lead1 = any(n.get("ref_id") == lead1_id for n in notifs2)
    step("mgr2 does NOT have notification for lead1 (cross-user isolation)",
         not mgr2_has_lead1, f"unexpected ref_ids: {[n.get('ref_id') for n in notifs2]}")

    # 2) all_managers=True (should only target mgr1 since mgr2 has no leads perm)
    r = post("/admin/leads", headers=auth_h(admin_tok),
             json={"name": "All Mgr Lead", "phone": "+919999000222",
                   "manager_ids": [], "all_managers": True})
    step("POST /admin/leads (all_managers) 200", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    lead2 = r.json()
    lead2_id = lead2["id"]
    assigned_set = set(lead2.get("assigned_manager_ids") or [])
    step("all_managers includes mgr1 (has leads perm)",
         mgr1_id in assigned_set, f"assigned={assigned_set}")
    step("all_managers does NOT include mgr2 (no leads perm)",
         mgr2_id not in assigned_set, f"assigned={assigned_set}")

    time.sleep(0.5)
    r = get("/notifications", headers=auth_h(mgr1_tok))
    notifs1b = r.json()["items"]
    step("mgr1 got notification for lead2",
         any(n["type"] == "lead_assigned" and n["ref_id"] == lead2_id for n in notifs1b),
         f"first types={[n.get('type') for n in notifs1b[:5]]}")

    r = get("/notifications", headers=auth_h(mgr2_tok))
    notifs2b = r.json()["items"]
    step("mgr2 has NO notification for lead2",
         not any(n.get("ref_id") == lead2_id for n in notifs2b),
         f"got refs={[n.get('ref_id') for n in notifs2b]}")

    # 3) /admin/leads/{id}/assign
    r = post(f"/admin/leads/{lead1_id}/assign", headers=auth_h(admin_tok),
             json={"manager_ids": [mgr1_id], "all_managers": False, "note": "Call back tomorrow"})
    step("POST /admin/leads/{id}/assign 200", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        step("assign updates assigned_manager_ids",
             r.json().get("assigned_manager_ids") == [mgr1_id],
             f"got={r.json().get('assigned_manager_ids')}")

    # 4) PATCH lead1 to purchased — must NOT award points (referrer_user_id empty)
    # Get admin's points before
    admin_doc_before = mdb.users.find_one({"id": admin_user["id"]})
    admin_pts_before = int((admin_doc_before or {}).get("points") or 0)

    r = patch(f"/admin/leads/{lead1_id}", headers=auth_h(admin_tok),
              json={"status": "purchased", "notes": "test"})
    step("PATCH /admin/leads/{id} status=purchased 200",
         r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        step("Lead status moved to purchased",
             r.json().get("status") == "purchased",
             f"status={r.json().get('status')}")
        step("points_awarded stays 0 (no auto-payout for admin-created lead)",
             int(r.json().get("points_awarded") or 0) == 0,
             f"points_awarded={r.json().get('points_awarded')}")

    # Verify no other user got 500 pts. There's no referrer so we can only check that
    # admin balance did not jump (admin isn't the referrer either, but defense check).
    admin_doc_after = mdb.users.find_one({"id": admin_user["id"]})
    admin_pts_after = int((admin_doc_after or {}).get("points") or 0)
    step("Admin points unchanged (no payout)",
         admin_pts_after == admin_pts_before,
         f"before={admin_pts_before} after={admin_pts_after}")

    # 5) Negatives
    r = post("/admin/leads", headers=auth_h(admin_tok),
             json={"name": "", "phone": "+919999000333"})
    step("POST /admin/leads empty name -> 400",
         r.status_code == 400, f"{r.status_code} {r.text[:200]}")

    r = post("/admin/leads", headers=auth_h(admin_tok),
             json={"name": "Bad", "phone": "abc"})
    step("POST /admin/leads invalid phone -> 400",
         r.status_code == 400, f"{r.status_code} {r.text[:200]}")

    r = post("/admin/leads", headers=auth_h(cust_tok),
             json={"name": "x", "phone": "+919999999999"})
    step("POST /admin/leads non-admin -> 403",
         r.status_code == 403, f"{r.status_code} {r.text[:200]}")

    # ============ D) Admin Service Requests ============
    print("\n=== D) Admin Service Requests ===")

    # First, create SR as customer (multipart)
    img = Image.new("RGB", (32, 32), (200, 50, 50))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    files = {"photo": ("issue.jpg", buf, "image/jpeg")}
    data = {"title": "Engine issue", "description": "Please help"}
    r = requests.post(BASE + "/service-requests", headers=auth_h(cust_tok),
                      data=data, files=files, timeout=30)
    step("Customer POST /service-requests 200",
         r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    sr = r.json()
    sr_id = sr["id"]

    # Admin list
    r = get("/admin/service-requests", headers=auth_h(admin_tok))
    step("Admin GET /admin/service-requests 200",
         r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    has_sr = any(s["id"] == sr_id for s in r.json())
    step("Admin SR list contains the new SR", has_sr, "")

    r = get("/admin/service-requests?status=open", headers=auth_h(admin_tok))
    step("Admin GET /admin/service-requests?status=open 200",
         r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        all_open = all(s.get("status") == "open" for s in r.json())
        step("status=open filter is correct", all_open, "")

    # Assign to mgr2 with note
    r = post(f"/admin/service-requests/{sr_id}/assign", headers=auth_h(admin_tok),
             json={"manager_ids": [mgr2_id], "all_managers": False, "note": "Site visit needed"})
    step("Assign SR to mgr2 200", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        sr_doc = r.json()
        step("SR assigned_manager_ids == [mgr2_id]",
             sr_doc.get("assigned_manager_ids") == [mgr2_id],
             f"got={sr_doc.get('assigned_manager_ids')}")
        timeline = sr_doc.get("timeline") or []
        last = timeline[-1] if timeline else {}
        step("Timeline grew with 'assigned' + note",
             "assigned" in (last.get("action") or "") and last.get("note") == "Site visit needed",
             f"last={last}")

    time.sleep(0.5)
    r = get("/notifications", headers=auth_h(mgr2_tok))
    nlist = r.json()["items"]
    step("mgr2 received notification type=service_assigned ref_id=sr_id",
         any(n["type"] == "service_assigned" and n["ref_id"] == sr_id for n in nlist),
         f"types={[n.get('type') for n in nlist[:5]]}")

    # Re-assign with all_managers=True (both mgr1 and mgr2 have service perm)
    r = post(f"/admin/service-requests/{sr_id}/assign", headers=auth_h(admin_tok),
             json={"all_managers": True, "note": "Escalate to all"})
    step("Re-assign SR all_managers=True 200",
         r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        assigned = set(r.json().get("assigned_manager_ids") or [])
        step("assigned_manager_ids includes mgr1 (service perm)",
             mgr1_id in assigned, f"assigned={assigned}")
        step("assigned_manager_ids includes mgr2 (service perm)",
             mgr2_id in assigned, f"assigned={assigned}")

    # ============ E) Manager assignment-based filtering ============
    print("\n=== E) Manager filtering ===")

    # Admin (super-manager) should see all leads
    r = get("/manager/leads", headers=auth_h(admin_tok))
    step("Admin GET /manager/leads 200", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    leads_admin = r.json() if r.status_code == 200 else []
    step("Admin sees admin-created lead in /manager/leads",
         any(L["id"] == lead1_id for L in leads_admin),
         f"count={len(leads_admin)}")

    r = get("/manager/service-requests", headers=auth_h(admin_tok))
    step("Admin GET /manager/service-requests 200",
         r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        step("Admin sees the SR",
             any(s["id"] == sr_id for s in r.json()),
             f"count={len(r.json())}")

    # Customer trying manager endpoints
    r = get("/manager/leads", headers=auth_h(cust_tok))
    step("Customer GET /manager/leads -> 403", r.status_code == 403,
         f"{r.status_code} {r.text[:200]}")

    r = get("/manager/service-requests", headers=auth_h(cust_tok))
    step("Customer GET /manager/service-requests -> 403", r.status_code == 403,
         f"{r.status_code} {r.text[:200]}")

    # PATCH service-requests as admin -> in_progress; expect customer to receive a notification
    r = get("/notifications", headers=auth_h(cust_tok))
    cust_unread_before = r.json()["unread_count"]

    r = patch(f"/manager/service-requests/{sr_id}", headers=auth_h(admin_tok),
              json={"status": "in_progress", "note": "Tech assigned"})
    step("PATCH /manager/service-requests {status:in_progress} 200",
         r.status_code == 200, f"{r.status_code} {r.text[:200]}")

    time.sleep(0.5)
    r = get("/notifications", headers=auth_h(cust_tok))
    cust_notifs = r.json()["items"]
    step("Customer received notification type=service_status ref_id=sr_id",
         any(n["type"] == "service_status" and n["ref_id"] == sr_id for n in cust_notifs),
         f"types={[n.get('type') for n in cust_notifs[:5]]}")

    # ============ Test mark-read ============
    print("\n=== A) Notifications: mark-read ===")
    # mgr1 should have multiple unread now
    r = get("/notifications", headers=auth_h(mgr1_tok))
    items_m1 = r.json()["items"]
    unread_before = r.json()["unread_count"]
    step("mgr1 has unread > 0 to mark-read", unread_before > 0, f"unread={unread_before}")

    # Mark first one
    if items_m1:
        first_id = items_m1[0]["id"]
        r = post("/notifications/mark-read", headers=auth_h(mgr1_tok),
                 json={"ids": [first_id]})
        step("POST /notifications/mark-read {ids:[id]} 200",
             r.status_code == 200, f"{r.status_code} {r.text[:200]}")
        step("updated >= 0",
             isinstance(r.json().get("updated"), int) and r.json()["updated"] >= 0,
             f"{r.json()}")

    # Mark all
    r = post("/notifications/mark-read", headers=auth_h(mgr1_tok),
             json={"all": True})
    step("POST /notifications/mark-read {all:true} 200",
         r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        step("unread_count == 0 after all",
             r.json().get("unread_count") == 0,
             f"unread={r.json().get('unread_count')}")

    # 401 on mark-read without auth
    r = post("/notifications/mark-read", json={"all": True})
    step("POST /notifications/mark-read without auth -> 401",
         r.status_code == 401, f"{r.status_code}")

    # ============ F) Cleanup ============
    print("\n=== F) Cleanup ===")
    r = delete(f"/admin/managers/{mgr1_id}", headers=auth_h(admin_tok))
    step("DELETE mgr1 200", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    r = delete(f"/admin/managers/{mgr2_id}", headers=auth_h(admin_tok))
    step("DELETE mgr2 200", r.status_code == 200, f"{r.status_code} {r.text[:200]}")

    # SUMMARY
    print(f"\n=== SUMMARY ===  PASSED={len(PASSED)}  FAILED={len(FAILED)}")
    for n, d in FAILED:
        print(f"  FAIL  {n}\n        {d}")
    return len(FAILED) == 0


if __name__ == "__main__":
    ok = main()
    sys.exit(0 if ok else 1)

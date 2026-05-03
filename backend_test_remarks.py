"""Backend regression for HANSA "remarks/timeline + dealer assignment + manager
perms expansion" feature batch.

Covers:
A) Manager perms expansion (4-key perms, PATCH, negative all-false -> 400)
B) Dealer-assigned leads + dealer-assigned service requests
C) Dealer endpoints — full lead update + remark timeline + 500-pt referral payout
D) Manager warranty + points adjust + perm gating
E) Admin lead PATCH with remark -> timeline entry with role:"admin"
F) Cleanup (DELETE managers)
"""
import os, sys, io, json, time, requests
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
        print(f"  PASS  {name}" + (f" -- {detail}" if detail else ""))
    else:
        FAILED.append((name, detail))
        print(f"  FAIL  {name} :: {detail}")


def post(path, **kw):  return requests.post(BASE + path, timeout=30, **kw)
def get(path, **kw):   return requests.get(BASE + path, timeout=30, **kw)
def patch(path, **kw): return requests.patch(BASE + path, timeout=30, **kw)
def delete(path, **kw):return requests.delete(BASE + path, timeout=30, **kw)


def auth_h(tok): return {"Authorization": f"Bearer {tok}"}


def get_otp_from_db(phone):
    rec = mdb.otps.find_one({"phone": phone})
    return rec["code"] if rec else None


def login_phone(phone10_or_full):
    r = post("/auth/send-otp", json={"phone": phone10_or_full})
    assert r.status_code == 200, f"send-otp {r.status_code} {r.text}"
    norm = r.json()["phone"]
    code = get_otp_from_db(norm)
    assert code, f"no OTP for {norm}"
    r2 = post("/auth/verify-otp", json={"phone": phone10_or_full, "otp": code})
    assert r2.status_code == 200, f"verify-otp {r2.status_code} {r2.text}"
    j = r2.json()
    return j["access_token"], j["user"]


def login_email(email, password):
    r = post("/auth/login", json={"email": email, "password": password})
    if r.status_code == 200:
        j = r.json()
        return j["access_token"], j["user"]
    return None, None


def make_jpg_bytes(w=160, h=120, color=(20, 80, 200)):
    img = Image.new("RGB", (w, h), color)
    buf = io.BytesIO(); img.save(buf, format="JPEG", quality=70)
    return buf.getvalue()


def main():
    print("\n=== LOGIN: admin via OTP +919045666666 ===")
    admin_tok, admin_user = login_phone("9045666666")
    step("admin OTP login", admin_user.get("role") == "admin", f"role={admin_user.get('role')}")

    print("\n=== LOGIN: customer ramesh@farm.com (legacy email) ===")
    cust_tok, cust_user = login_email("ramesh@farm.com", "farmer123")
    if not cust_tok:
        cust_tok, cust_user = login_email("ramesh@farm.com", "ramesh123")
    assert cust_tok, "ramesh login failed"
    ramesh_id = cust_user["id"]
    step("customer login (ramesh)", True, f"id={ramesh_id}")

    # ---------------- A) Manager perms expansion ----------------
    print("\n=== A) Manager perms expansion ===")
    # cleanup any leftover M-All from previous runs
    for prev in mdb.users.find({"phone": "+919999700001"}):
        mdb.users.update_one({"id": prev["id"]}, {"$set": {"role": "customer"}, "$unset": {"manager_perms": ""}})

    r = post("/admin/managers", headers=auth_h(admin_tok), json={
        "phone": "+919999700001", "name": "M-All",
        "perms_leads": True, "perms_service": True,
        "perms_warranty": True, "perms_points": True,
    })
    step("A1 promote manager M-All all 4 perms", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    mgr = r.json() if r.status_code == 200 else {}
    perms = (mgr or {}).get("manager_perms", {})
    step("A1 response.manager_perms has all 4 keys = true",
         all(perms.get(k) is True for k in ["leads", "service", "warranty", "points"]),
         f"perms={perms}")
    mgr_id = mgr.get("id")

    # PATCH to {leads:T, service:F, warranty:F, points:F}
    r = patch(f"/admin/managers/{mgr_id}", headers=auth_h(admin_tok), json={
        "perms_leads": True, "perms_service": False,
        "perms_warranty": False, "perms_points": False,
    })
    step("A2 PATCH perms_leads only -> 200", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        new_perms = r.json().get("manager_perms", {})
        step("A2 perms updated correctly",
             new_perms.get("leads") is True and new_perms.get("service") is False
             and new_perms.get("warranty") is False and new_perms.get("points") is False,
             f"new_perms={new_perms}")

    # Negative: all four false -> 400
    r = patch(f"/admin/managers/{mgr_id}", headers=auth_h(admin_tok), json={
        "perms_leads": False, "perms_service": False,
        "perms_warranty": False, "perms_points": False,
    })
    step("A3 PATCH all-false -> 400", r.status_code == 400, f"{r.status_code} {r.text[:200]}")

    # Restore all 4 perms for downstream tests
    r = patch(f"/admin/managers/{mgr_id}", headers=auth_h(admin_tok), json={
        "perms_leads": True, "perms_service": True,
        "perms_warranty": True, "perms_points": True,
    })
    step("A4 restore M-All all 4 perms", r.status_code == 200, f"{r.status_code}")

    # ---------------- B) Dealer-assigned leads + SRs ----------------
    print("\n=== B) Dealer assignments ===")
    r = get("/admin/dealer-users", headers=auth_h(admin_tok))
    step("B1 GET /admin/dealer-users", r.status_code == 200, f"{r.status_code}")
    dealer_users = r.json() if r.status_code == 200 else []
    print(f"  -> dealer count: {len(dealer_users)}")
    # If we don't have at least 1, seed: create a dealer + promote a fresh phone
    if len(dealer_users) < 1:
        # Pick or create a dealer profile
        existing_dealers = mdb.dealers.find_one({})
        dealer_id = None
        if existing_dealers:
            dealer_id = existing_dealers["id"]
        else:
            r = post("/admin/dealers", headers=auth_h(admin_tok), json={
                "name": "Test Dealer 1", "address": "Indore, MP",
                "phone": "+919999500001", "whatsapp": "+919999500001",
                "state": "MP", "type": "Authorised Dealer",
            })
            step("B1a seed dealer profile", r.status_code == 200)
            dealer_id = r.json()["id"]
        r = post("/admin/promote-dealer", headers=auth_h(admin_tok), json={
            "phone": "+919999600001", "dealer_id": dealer_id,
        })
        step("B1b promote-dealer #1", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
        r = get("/admin/dealer-users", headers=auth_h(admin_tok))
        dealer_users = r.json()

    if len(dealer_users) < 2:
        existing_dealers = mdb.dealers.find_one({})
        dealer_id = existing_dealers["id"]
        r = post("/admin/promote-dealer", headers=auth_h(admin_tok), json={
            "phone": "+919999600002", "dealer_id": dealer_id,
        })
        step("B1c promote-dealer #2", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
        r = get("/admin/dealer-users", headers=auth_h(admin_tok))
        dealer_users = r.json()

    d1 = dealer_users[0]["id"]
    d2 = dealer_users[1]["id"] if len(dealer_users) > 1 else d1
    print(f"  -> d1={d1}  d2={d2}  total dealer users={len(dealer_users)}")

    # Customer creates a fresh referral lead via /loyalty/leads -> POST /leads
    r = post("/leads", headers=auth_h(cust_tok), json={
        "name": "Dealer-Test", "phone": "+919998880001",
        "equipment_interest": "Plough",
    })
    step("B2 customer POST /leads referral", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    lead = r.json() if r.status_code == 200 else {}
    lead_id = lead.get("id")

    # Snapshot dealer1 unread count BEFORE
    before_count_d1 = mdb.notifications.count_documents({"user_id": d1, "type": "lead_assigned"})

    # Admin assign-dealers single d1
    r = post(f"/admin/leads/{lead_id}/assign-dealers", headers=auth_h(admin_tok), json={
        "dealer_user_ids": [d1], "note": "Please call ASAP",
    })
    step("B3 POST /admin/leads/{id}/assign-dealers [d1]", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    j = r.json() if r.status_code == 200 else {}
    step("B3 assigned_dealer_user_ids=[d1]", j.get("assigned_dealer_user_ids") == [d1],
         f"got={j.get('assigned_dealer_user_ids')}")
    timeline = j.get("timeline", [])
    has_assigned = any(("assigned_to_dealers" in (t.get("action") or "")) and t.get("remark") == "Please call ASAP" for t in timeline)
    step("B3 timeline contains assigned_to_dealers + remark", has_assigned, f"timeline={timeline}")
    # Notification check
    after_count_d1 = mdb.notifications.count_documents({"user_id": d1, "type": "lead_assigned", "ref_id": lead_id})
    step("B3 d1 received in-app notification (lead_assigned)", after_count_d1 > 0, f"count={after_count_d1}")

    # Reassign with all_dealers=true
    r = post(f"/admin/leads/{lead_id}/assign-dealers", headers=auth_h(admin_tok), json={
        "all_dealers": True, "note": "All dealers please attend",
    })
    step("B4 POST assign-dealers all_dealers=true", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    j = r.json() if r.status_code == 200 else {}
    all_dealer_ids = sorted(u["id"] for u in dealer_users)
    got_ids = sorted(j.get("assigned_dealer_user_ids", []))
    step("B4 assigned_dealer_user_ids equals ALL dealer user ids",
         got_ids == all_dealer_ids,
         f"got={got_ids} expected={all_dealer_ids}")

    # Reset back to just d1 for downstream dealer tests
    r = post(f"/admin/leads/{lead_id}/assign-dealers", headers=auth_h(admin_tok), json={
        "dealer_user_ids": [d1], "note": "Reset to d1",
    })
    step("B4b reset to [d1]", r.status_code == 200)

    # SR: customer creates SR
    files = {
        "photo": ("hyd.jpg", make_jpg_bytes(), "image/jpeg"),
    }
    data = {"title": "Hydraulic leak", "description": "Oil leaking from cylinder"}
    r = requests.post(BASE + "/service-requests", headers=auth_h(cust_tok),
                      data=data, files=files, timeout=30)
    step("B5 customer POST /service-requests w/photo", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    sr = r.json() if r.status_code == 200 else {}
    sr_id = sr.get("id")

    before_sr_d1 = mdb.notifications.count_documents({"user_id": d1, "type": "service_assigned", "ref_id": sr_id})
    r = post(f"/admin/service-requests/{sr_id}/assign-dealers", headers=auth_h(admin_tok), json={
        "dealer_user_ids": [d1], "note": "Onsite check",
    })
    step("B6 POST SR assign-dealers [d1]", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    j = r.json() if r.status_code == 200 else {}
    step("B6 SR.assigned_dealer_user_ids=[d1]", j.get("assigned_dealer_user_ids") == [d1])
    sr_timeline = j.get("timeline", [])
    has_sr_assigned = any(("assigned_to_dealers" in (t.get("action") or "")) and t.get("remark") == "Onsite check" for t in sr_timeline)
    step("B6 SR timeline contains assigned_to_dealers + remark", has_sr_assigned, f"sr_timeline={sr_timeline}")
    after_sr_d1 = mdb.notifications.count_documents({"user_id": d1, "type": "service_assigned", "ref_id": sr_id})
    step("B6 d1 notified for SR (service_assigned)", after_sr_d1 > before_sr_d1, f"before={before_sr_d1} after={after_sr_d1}")

    # Negative: empty dealer_user_ids and all_dealers=false -> clears assignment, no notif sent
    notif_count_pre = mdb.notifications.count_documents({"user_id": d1, "type": "lead_assigned", "ref_id": lead_id})
    r = post(f"/admin/leads/{lead_id}/assign-dealers", headers=auth_h(admin_tok), json={
        "dealer_user_ids": [], "all_dealers": False, "note": "clear",
    })
    step("B7 POST assign-dealers empty -> 200", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    j = r.json() if r.status_code == 200 else {}
    step("B7 assigned_dealer_user_ids=[]", j.get("assigned_dealer_user_ids") == [], f"got={j.get('assigned_dealer_user_ids')}")
    notif_count_post = mdb.notifications.count_documents({"user_id": d1, "type": "lead_assigned", "ref_id": lead_id})
    step("B7 no new notif on clear", notif_count_post == notif_count_pre, f"pre={notif_count_pre} post={notif_count_post}")

    # Restore [d1] for downstream dealer tests
    r = post(f"/admin/leads/{lead_id}/assign-dealers", headers=auth_h(admin_tok), json={
        "dealer_user_ids": [d1], "note": "restore",
    })
    step("B7b restore [d1]", r.status_code == 200)
    r = post(f"/admin/service-requests/{sr_id}/assign-dealers", headers=auth_h(admin_tok), json={
        "dealer_user_ids": [d1], "note": "restore",
    })
    step("B7c SR restore [d1]", r.status_code == 200)

    # ---------------- C) Dealer endpoints ----------------
    print("\n=== C) Dealer endpoints ===")
    # Try logging in as dealer d1 via OTP using their phone from the user record
    d1_user = mdb.users.find_one({"id": d1})
    d1_phone = d1_user.get("phone") if d1_user else None
    dealer_tok = None
    if d1_phone:
        try:
            dealer_tok, dealer_who = login_phone(d1_phone)
            step("C0 login as dealer d1", dealer_who.get("role") == "dealer", f"role={dealer_who.get('role')}")
        except Exception as e:
            step("C0 login as dealer d1", False, f"falling back to admin token; {e}")
            dealer_tok = admin_tok
    else:
        dealer_tok = admin_tok

    # As dealer (if real dealer login), filter would only show assigned. As admin
    # the filter is empty (sees all) so admin still sees the lead.
    r = get("/dealer/leads", headers=auth_h(dealer_tok))
    step("C1 GET /dealer/leads", r.status_code == 200, f"{r.status_code}")
    leads = r.json() if r.status_code == 200 else []
    step("C1 includes assigned lead", any(L["id"] == lead_id for L in leads), f"len={len(leads)}")

    # PATCH to contacted with remark
    r = patch(f"/dealer/leads/{lead_id}", headers=auth_h(dealer_tok), json={
        "status": "contacted", "remark": "Customer requested call back tomorrow",
    })
    step("C2 PATCH /dealer/leads -> contacted", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    L = r.json() if r.status_code == 200 else {}
    step("C2 lead.status=contacted", L.get("status") == "contacted", f"got={L.get('status')}")
    last = (L.get("timeline") or [])[-1] if L.get("timeline") else {}
    step("C2 last timeline entry remark match", last.get("remark") == "Customer requested call back tomorrow",
         f"last={last}")
    step("C2 last timeline action contains 'status:'", "status:" in (last.get("action") or ""),
         f"action={last.get('action')}")

    # Snapshot ramesh balance
    r = get("/me/points", headers=auth_h(cust_tok))
    bal_before = r.json().get("balance", 0) if r.status_code == 200 else 0

    # PATCH to purchased with remark -> +500 to ramesh
    r = patch(f"/dealer/leads/{lead_id}", headers=auth_h(dealer_tok), json={
        "status": "purchased", "remark": "Bought tiller",
    })
    step("C3 PATCH /dealer/leads -> purchased", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    L = r.json() if r.status_code == 200 else {}
    last = (L.get("timeline") or [])[-1] if L.get("timeline") else {}
    step("C3 timeline remark=Bought tiller", last.get("remark") == "Bought tiller", f"last={last}")

    r = get("/me/points", headers=auth_h(cust_tok))
    bal_after = r.json().get("balance", 0) if r.status_code == 200 else 0
    step("C3 ramesh +500 points awarded", bal_after - bal_before == 500,
         f"before={bal_before} after={bal_after}")

    # SR list & PATCH
    r = get("/dealer/service-requests", headers=auth_h(dealer_tok))
    step("C4 GET /dealer/service-requests", r.status_code == 200, f"{r.status_code}")
    srs = r.json() if r.status_code == 200 else []
    step("C4 includes assigned SR", any(s["id"] == sr_id for s in srs), f"len={len(srs)}")

    before_cust_notif = mdb.notifications.count_documents({"user_id": ramesh_id, "type": "service_status", "ref_id": sr_id})
    r = patch(f"/dealer/service-requests/{sr_id}", headers=auth_h(dealer_tok), json={
        "status": "in_progress", "remark": "Tech on the way",
    })
    step("C5 PATCH SR in_progress", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    S = r.json() if r.status_code == 200 else {}
    step("C5 SR.status=in_progress", S.get("status") == "in_progress")
    last = (S.get("timeline") or [])[-1]
    step("C5 SR timeline remark=Tech on the way", last.get("remark") == "Tech on the way", f"last={last}")
    after_cust_notif = mdb.notifications.count_documents({"user_id": ramesh_id, "type": "service_status", "ref_id": sr_id})
    step("C5 customer (ramesh) got service_status notification", after_cust_notif > before_cust_notif,
         f"before={before_cust_notif} after={after_cust_notif}")

    # Negative: dealer trying to PATCH a lead they aren't assigned to -> 404
    # Make a fresh unassigned lead by ramesh and try PATCHing as dealer
    if dealer_tok != admin_tok:  # only meaningful when we logged in as actual dealer
        r = post("/leads", headers=auth_h(cust_tok), json={
            "name": "Stranger-Lead", "phone": "+919998880099",
            "equipment_interest": "Cultivator",
        })
        unassigned_lead_id = r.json()["id"]
        r = patch(f"/dealer/leads/{unassigned_lead_id}", headers=auth_h(dealer_tok), json={
            "status": "contacted", "remark": "x",
        })
        step("C6 dealer PATCHing unassigned lead -> 404", r.status_code == 404, f"{r.status_code} {r.text[:200]}")
    else:
        step("C6 dealer-not-assigned 404 negative", True, "SKIPPED (no real dealer login available)")

    # ---------------- D) Manager warranty + points ----------------
    print("\n=== D) Manager warranty + points ===")
    # M-All login is NOT possible without OTP — but admin login works since admin
    # role passes all manager guards. However the review explicitly asks: as the
    # manager from A. We'll attempt OTP login for +919999700001.
    mgr_tok = None
    try:
        mgr_tok, mgr_who = login_phone("+919999700001")
        step("D0 login as M-All manager via OTP", mgr_who.get("role") == "manager", f"role={mgr_who.get('role')}")
    except Exception as e:
        step("D0 login as M-All via OTP", False, f"falling back to admin: {e}")
        mgr_tok = admin_tok

    # Pick a product
    p = mdb.products.find_one({})
    pid = p["id"]; pname = p["name"]

    r = post("/manager/assign-warranty", headers=auth_h(mgr_tok), json={
        "phone": "+919998880050",
        "items": [{"product_id": pid, "quantity": 1}],
        "customer_name": "Mgr-W-Test",
    })
    step("D1 POST /manager/assign-warranty", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    order = r.json() if r.status_code == 200 else {}
    order_id = order.get("id")
    step("D1 order returned with id", bool(order_id), f"order_id={order_id}")
    if order_id:
        # Verify in DB
        dbo = mdb.orders.find_one({"id": order_id})
        if dbo:
            # role_label='manager' if mgr_tok was actual manager else 'admin'
            if mgr_tok != admin_tok:
                step("D1 order.assigned_by_dealer == manager.id",
                     dbo.get("assigned_by_dealer") == mgr_who["id"],
                     f"got={dbo.get('assigned_by_dealer')} mgr={mgr_who['id']}")
            else:
                step("D1 order.assigned_by_admin == admin.id",
                     dbo.get("assigned_by_admin") == admin_user["id"],
                     f"got={dbo.get('assigned_by_admin')}")
        else:
            step("D1 order found in DB", False, "no order doc")

    # Adjust points for ramesh
    r = get("/me/points", headers=auth_h(cust_tok))
    bal_before = r.json().get("balance", 0) if r.status_code == 200 else 0
    r = post("/manager/points/adjust", headers=auth_h(mgr_tok), json={
        "user_id": ramesh_id, "delta": 25, "reason": "Manual award",
    })
    step("D2 POST /manager/points/adjust +25", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    j = r.json() if r.status_code == 200 else {}
    step("D2 response.new_balance == before+25", j.get("new_balance") == bal_before + 25,
         f"before={bal_before} new_balance={j.get('new_balance')}")

    # In-app notif type=points_adjust
    notif = mdb.notifications.find_one(
        {"user_id": ramesh_id, "type": "points_adjust"},
        sort=[("created_at", -1)],
    )
    step("D2 ramesh received points_adjust notification", notif is not None,
         f"notif={notif and notif.get('title')}")

    # Negative: remove warranty perm from M-All, retry assign-warranty -> 403
    r = patch(f"/admin/managers/{mgr_id}", headers=auth_h(admin_tok), json={
        "perms_leads": True, "perms_service": True,
        "perms_warranty": False, "perms_points": True,
    })
    step("D3a remove warranty perm", r.status_code == 200, f"{r.status_code}")

    if mgr_tok != admin_tok:
        # Re-login to refresh token? token doesn't carry perms — security.py
        # re-reads user from DB on every call so existing token is fine.
        r = post("/manager/assign-warranty", headers=auth_h(mgr_tok), json={
            "phone": "+919998880050",
            "items": [{"product_id": pid, "quantity": 1}],
            "customer_name": "Mgr-W-Test2",
        })
        step("D3 manager-without-warranty -> 403", r.status_code == 403, f"{r.status_code} {r.text[:200]}")
    else:
        step("D3 manager-without-warranty -> 403", True, "SKIPPED (admin token bypasses all guards by design)")

    # Restore all 4 perms
    r = patch(f"/admin/managers/{mgr_id}", headers=auth_h(admin_tok), json={
        "perms_leads": True, "perms_service": True,
        "perms_warranty": True, "perms_points": True,
    })
    step("D4 restore all 4 perms", r.status_code == 200, f"{r.status_code}")

    # ---------------- E) Lead remark in admin update path ----------------
    print("\n=== E) Admin lead update with remark ===")
    # Use a fresh lead so we have predictable state. Use an admin-created lead
    # (no referrer_user_id) so 'contacted' is benign.
    r = post("/admin/leads", headers=auth_h(admin_tok), json={
        "name": "Admin-E-Test", "phone": "+919998881111",
        "equipment_interest": "Tiller", "notes": "",
    })
    e_lead_id = r.json()["id"] if r.status_code == 200 else None
    step("E0 admin creates lead", bool(e_lead_id), f"{r.status_code}")

    r = patch(f"/admin/leads/{e_lead_id}", headers=auth_h(admin_tok), json={
        "status": "contacted", "remark": "Caller asked for more info",
    })
    step("E1 admin PATCH lead status+remark", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    L = r.json() if r.status_code == 200 else {}
    found = any(t.get("remark") == "Caller asked for more info" and t.get("role") == "admin"
                for t in L.get("timeline", []))
    step("E1 timeline has entry remark+role:admin", found, f"timeline={L.get('timeline')}")

    # ---------------- F) Cleanup ----------------
    print("\n=== F) Cleanup ===")
    r = delete(f"/admin/managers/{mgr_id}", headers=auth_h(admin_tok))
    step("F1 DELETE manager M-All", r.status_code == 200, f"{r.status_code}")

    # Demote any test dealer users we created (only if we promoted fresh ones)
    # leave them — they're harmless seed data.

    # ---------------- SUMMARY ----------------
    print(f"\n=== RESULT: {len(PASSED)} PASS / {len(FAILED)} FAIL ===")
    for n, d in FAILED:
        print(f"  FAIL  {n} :: {d}")
    return 0 if not FAILED else 1


if __name__ == "__main__":
    sys.exit(main())

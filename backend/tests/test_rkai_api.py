"""RKAI Customer App backend tests covering auth, products, news, offers,
orders, warranty, support flows. Uses the public EXPO backend URL."""
import os
import uuid
import pytest
import requests
from pathlib import Path

# Load EXPO_PUBLIC_BACKEND_URL from frontend/.env
def _load_base_url():
    env_path = Path("/app/frontend/.env")
    for line in env_path.read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
            return line.split("=", 1)[1].strip().strip('"').rstrip("/")
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL not found")

BASE_URL = _load_base_url()
SEED_EMAIL = "ramesh@farm.com"
SEED_PASSWORD = "farmer123"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def seed_token(session):
    r = session.post(f"{BASE_URL}/api/auth/login",
                     json={"email": SEED_EMAIL, "password": SEED_PASSWORD},
                     timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data
    assert data["user"]["email"] == SEED_EMAIL
    return data["access_token"]


@pytest.fixture(scope="session")
def auth_headers(seed_token):
    return {"Authorization": f"Bearer {seed_token}", "Content-Type": "application/json"}


# ---------------- Health ----------------
def test_health(session):
    r = session.get(f"{BASE_URL}/api/", timeout=15)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---------------- Auth ----------------
class TestAuth:
    def test_login_seeded_user(self, seed_token):
        assert seed_token and isinstance(seed_token, str)

    def test_login_invalid_password(self, session):
        r = session.post(f"{BASE_URL}/api/auth/login",
                         json={"email": SEED_EMAIL, "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_register_and_me(self, session):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = session.post(f"{BASE_URL}/api/auth/register",
                         json={"email": email, "password": "pass1234", "name": "TEST User", "phone": "+910000"},
                         timeout=20)
        assert r.status_code == 200, r.text
        token = r.json()["access_token"]
        assert r.json()["user"]["email"] == email
        # me
        r2 = session.get(f"{BASE_URL}/api/auth/me",
                         headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["email"] == email
        # duplicate
        r3 = session.post(f"{BASE_URL}/api/auth/register",
                          json={"email": email, "password": "pass1234", "name": "TEST User"},
                          timeout=15)
        assert r3.status_code == 400

    def test_me_requires_token(self, session):
        r = session.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 401


# ---------------- Products ----------------
class TestProducts:
    def test_list(self, session):
        r = session.get(f"{BASE_URL}/api/products", timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 19, f"expected >=19 products, got {len(items)}"
        sample = items[0]
        for f in ["id", "name", "price", "category", "warranty_months"]:
            assert f in sample, f"missing field {f}"

    def test_categories(self, session):
        r = session.get(f"{BASE_URL}/api/products/categories", timeout=15)
        assert r.status_code == 200
        cats = r.json()
        assert isinstance(cats, list) and len(cats) > 0

    def test_featured(self, session):
        r = session.get(f"{BASE_URL}/api/products/featured", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_filter_by_category(self, session):
        cats = session.get(f"{BASE_URL}/api/products/categories").json()
        cat = cats[0]
        r = session.get(f"{BASE_URL}/api/products", params={"category": cat}, timeout=15)
        assert r.status_code == 200
        for it in r.json():
            assert it["category"] == cat

    def test_filter_all_returns_all(self, session):
        r_all = session.get(f"{BASE_URL}/api/products").json()
        r_kw = session.get(f"{BASE_URL}/api/products", params={"category": "all"}).json()
        assert len(r_all) == len(r_kw)

    def test_search(self, session):
        r = session.get(f"{BASE_URL}/api/products", params={"q": "tiller"}, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert all("tiller" in it["name"].lower() for it in items)

    def test_get_product_by_id(self, session):
        items = session.get(f"{BASE_URL}/api/products").json()
        pid = items[0]["id"]
        r = session.get(f"{BASE_URL}/api/products/{pid}", timeout=15)
        assert r.status_code == 200
        assert r.json()["id"] == pid

    def test_get_product_404(self, session):
        r = session.get(f"{BASE_URL}/api/products/does-not-exist", timeout=15)
        assert r.status_code == 404


# ---------------- News & Offers ----------------
def test_news(session):
    r = session.get(f"{BASE_URL}/api/news", timeout=15)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list) and len(items) > 0


def test_offers(session):
    r = session.get(f"{BASE_URL}/api/offers", timeout=15)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list) and len(items) > 0
    codes = [o.get("code") for o in items]
    # at least one expected promo code present
    assert any(c in codes for c in ["RKAI10", "HARROW15", "FARMER500"]), f"got codes {codes}"


# ---------------- Orders & Warranty ----------------
class TestOrdersAndWarranty:
    def test_seed_orders_present(self, session, auth_headers):
        r = session.get(f"{BASE_URL}/api/orders", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        orders = r.json()
        assert len(orders) >= 2, f"expected seeded 2 orders, got {len(orders)}"

    def test_seed_warranties(self, session, auth_headers):
        r = session.get(f"{BASE_URL}/api/warranties", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        ws = r.json()
        assert len(ws) >= 3, f"expected >=3 warranty records, got {len(ws)}"
        for w in ws:
            for f in ["id", "product_id", "product_name", "purchase_date", "expiry_date",
                      "warranty_months", "days_total", "days_left", "percent_remaining", "status"]:
                assert f in w, f"missing {f} in warranty"
            assert w["status"] in ("active", "expired")

    def test_warranties_unauth(self, session):
        r = session.get(f"{BASE_URL}/api/warranties", timeout=15)
        assert r.status_code == 401

    def test_checkout_creates_order_and_warranty(self, session, auth_headers):
        products = session.get(f"{BASE_URL}/api/products").json()
        # find a tiller for promo RKAI10
        tiller = next((p for p in products if p["category"].lower() == "tillers"), products[0])
        payload = {
            "items": [{"product_id": tiller["id"], "quantity": 1}],
            "full_name": "TEST Buyer",
            "phone": "+919999999999",
            "address": "TEST Addr",
            "city": "Hapur",
            "state": "UP",
            "pincode": "201015",
            "payment_method": "cod",
            "promo_code": "RKAI10",
        }
        r = session.post(f"{BASE_URL}/api/orders/checkout",
                         headers=auth_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["status"] == "confirmed"
        assert order["subtotal"] == round(float(tiller["price"]), 2)
        # promo applied only if tiller category matches; offer rule is server-side flat. Check discount when code present
        if order["promo_code"] == "RKAI10":
            assert order["discount"] > 0
            assert order["total"] == round(order["subtotal"] - order["discount"], 2)

        # GET single order
        r2 = session.get(f"{BASE_URL}/api/orders/{order['id']}", headers=auth_headers, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["id"] == order["id"]

        # warranty for new order present
        ws = session.get(f"{BASE_URL}/api/warranties", headers=auth_headers, timeout=15).json()
        assert any(w["order_id"] == order["id"] for w in ws)

    def test_checkout_empty_cart(self, session, auth_headers):
        r = session.post(f"{BASE_URL}/api/orders/checkout", headers=auth_headers,
                         json={"items": [], "full_name": "x", "phone": "x", "address": "x",
                               "city": "x", "state": "x", "pincode": "x"}, timeout=15)
        assert r.status_code == 400

    def test_checkout_invalid_product(self, session, auth_headers):
        r = session.post(f"{BASE_URL}/api/orders/checkout", headers=auth_headers,
                         json={"items": [{"product_id": "nope", "quantity": 1}],
                               "full_name": "x", "phone": "x", "address": "x",
                               "city": "x", "state": "x", "pincode": "x"}, timeout=15)
        assert r.status_code == 404

    def test_checkout_unauth(self, session):
        r = session.post(f"{BASE_URL}/api/orders/checkout",
                         json={"items": [], "full_name": "x", "phone": "x", "address": "x",
                               "city": "x", "state": "x", "pincode": "x"}, timeout=15)
        assert r.status_code == 401


# ---------------- Support ----------------
class TestSupport:
    def test_create_and_list_ticket(self, session, auth_headers):
        payload = {"subject": "TEST Subject", "message": "TEST message body"}
        r = session.post(f"{BASE_URL}/api/support/tickets",
                         headers=auth_headers, json=payload, timeout=15)
        assert r.status_code == 200
        tid = r.json()["id"]
        r2 = session.get(f"{BASE_URL}/api/support/tickets",
                         headers=auth_headers, timeout=15)
        assert r2.status_code == 200
        assert any(t["id"] == tid for t in r2.json())

    def test_ticket_unauth(self, session):
        r = session.get(f"{BASE_URL}/api/support/tickets", timeout=15)
        assert r.status_code == 401

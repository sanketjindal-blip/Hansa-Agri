# RKAI Customer App - Product Requirements Document

## Overview
Customer-facing mobile app for **Ramkishan Agri Innovate Pvt Ltd (RKAI)**, an agriculture machinery manufacturer (Meerut / Hapur, U.P.). Built with React Native Expo (mobile) + FastAPI + MongoDB.

**Tagline:** OUR CULTURE IS AGRICULTURE — Energizing the Future of Farming.

## Core Features (Shipped)

### Customer
1. **Auth** — JWT email/password signup & login (AsyncStorage token persistence). Demo account pre-seeded.
2. **Home Dashboard** — Brand hero banner, warranty-expiry alert (< 60 days), active offers, category quick-links, featured products, latest updates, quick actions (Warranty / Dealers / Support).
3. **Product Catalog** — 19 RKAI products seeded from official catalogue (Tillers, Harrows, Ploughs, Cultivators, Ridgers, Subsoilers, Levellers, Weeders, Bund & Trench makers). Category filter + search.
4. **Product Detail** — Full specs table, key features, MRP + discount %, warranty months, recommended tractor HP, Add-to-Cart & Buy-Now.
5. **Cart** — AsyncStorage-persisted cart (survives app reload), quantity stepper, remove.
6. **Checkout** — Shipping address, promo codes (RKAI10, HARROW15, FARMER500 seeded), payment methods: COD + Razorpay (UPI/Card/Netbanking via WebView — requires API keys).
7. **My Purchases** — Order history with dates, status, items, total, warranty link.
8. **Warranty Tracker** — Auto-derived from orders. Progress bar, days left, active/expired status, claim button → support.
9. **News & Updates** — Company announcements, product launches.
10. **Offers & Discounts** — Promo banner cards with tap-to-copy codes.
11. **Service / Support** — Submit ticket + view ticket list. Direct call & email to +91 9045 333 332 / support@agriequipments.com.
12. **Dealer Locator** — 8 dealer locations across UP, Punjab, Bihar, Maharashtra, MP, Karnataka with Call / WhatsApp / Google-Maps deep-links.
13. **Profile** — User info, company contact, all menu links.

### Admin (role=admin only)
- Admin Dashboard with live stats (users, products, orders, open tickets).
- Publish News posts.
- Create Offers / promo codes.
- (Product create/delete endpoints also available via `/api/admin/products`).

## Tech Stack
- **Frontend:** React Native Expo SDK 54, Expo Router, AsyncStorage, axios, react-native-webview.
- **Backend:** FastAPI, Motor (async MongoDB), JWT (pyjwt), bcrypt, razorpay SDK (optional).
- **Design:** Brand colors (Orange #FF6600, Green #2E7D32) from RKAI logo. Outfit/Manrope typography guidelines.

## Seed Data
- **Admin:** `admin@rkai.com` / `admin123`
- **Demo customer:** `ramesh@farm.com` / `farmer123` (has 2 past orders → 3 live warranty records)
- **Promo codes:** RKAI10, HARROW15, FARMER500

## Mocked / Pending
- **Razorpay**: Integration implemented end-to-end (create-order + signature verify + WebView checkout) — user must add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to `/app/backend/.env` to enable. Until then, Razorpay option is shown disabled and COD is the only active payment method.
- **Push notifications**: Replaced with in-app warranty-expiry alert banner on Home (no APNs/FCM setup needed).

## Business Enhancement Hook
**Warranty-expiry alerts** drive return customers — farmers see a bright in-app banner 60 days before expiry with a one-tap shortcut to raise a service claim or re-order. This reliably converts warranty events into service & upsell revenue.

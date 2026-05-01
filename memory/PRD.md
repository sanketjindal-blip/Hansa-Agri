# HANSA (हंसा) Customer App - Product Requirements Document

## Brand
- **Company:** Ramkishan Agri Innovate Pvt Ltd (RKAI)
- **Brand name:** **HANSA / हंसा**
- **Tagline:** हमारी संस्कृति ही कृषि है — OUR CULTURE IS AGRICULTURE
- **Logo:** bundled at `/app/frontend/assets/images/hansa-logo.jpeg`
- **Colors:** Orange `#FF6600` + Green `#2E7D32` (from logo).

## Features
### Customer
- JWT auth (signup/login), AsyncStorage token persistence.
- **Bilingual UI (English + हिन्दी)** via in-app i18n with toggle in Profile → Language.
- Home: HANSA logo header, warranty-expiry banner, hero, offers, categories, featured products, news, quick actions (Warranty / Dealers / Support).
- Catalog with search + category filter · product detail (specs/features/HP/warranty) · Add-to-Cart / Buy-Now.
- Cart (AsyncStorage persisted) → Checkout (address, promo codes, COD + Razorpay WebView) → Order.
- **SMS on order placement** via Twilio (to farmer's phone).
- My Purchases · Warranty Tracker (auto-computed, progress bars, claim) · News · Offers · Dealer Locator (Call / WhatsApp / Maps) · Support tickets.

### Admin (role=admin)
- Admin Dashboard (live stats).
- Publish News + Create Offers.
- **Full Product CRUD UI** (`/admin-products`): list, create, edit (all fields including specs as Key:Value lines, features per-line, featured flag, image URL preview), delete.
- **Warranty SMS reminders**: one-tap button sends SMS to every farmer whose warranty expires within 45 days.

## Tech
- **Frontend:** React Native Expo SDK 54, Expo Router, AsyncStorage, axios, react-native-webview.
- **Backend:** FastAPI, Motor (MongoDB), JWT (pyjwt), bcrypt, twilio SDK, razorpay SDK (optional).
- **i18n:** custom lightweight provider keyed in AsyncStorage.

## Credentials
- Admin: `admin@rkai.com` / `admin123`
- Demo farmer: `ramesh@farm.com` / `farmer123` (2 past orders → 3 warranty records)
- Twilio: ACCOUNT_SID `AC7c374dee4fa5d31ee4783dcf38bf041b`, FROM `+16184861759` (configured).
- Razorpay: keys empty — Razorpay option is disabled in checkout until you populate `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`.

## Notes / Caveats
- Twilio trial accounts only send to **verified recipient numbers**. Verify the test farmer's number in the Twilio console, or upgrade account, to see actual SMS. The backend does not fail if SMS is rejected — it logs silently.
- Razorpay checkout is fully implemented (create-order, WebView checkout, signature verify) and activates automatically once keys are added.
- Hindi translations cover all tabs, headers, CTAs, empty-states, warranty/orders/cart/profile/catalog; product data (names, specs) stays in English (as in the catalogue).

## Business Hooks
- **Warranty reminders** via Twilio SMS drive re-engagement and service revenue.
- **Promo codes** (RKAI10, HARROW15, FARMER500) lift conversion.
- **Hindi UI** doubles addressable market in rural UP/Bihar/MP/Maharashtra.

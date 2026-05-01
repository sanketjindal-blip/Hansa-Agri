import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Lang = 'en' | 'hi';

const STRINGS: Record<string, Record<Lang, string>> = {
  // common
  app_name: { en: 'HANSA', hi: 'हंसा' },
  tagline: { en: 'OUR CULTURE IS AGRICULTURE', hi: 'हमारी संस्कृति ही कृषि है' },
  welcome_back: { en: 'Welcome back', hi: 'पुनः स्वागत है' },
  sign_in_sub: { en: 'Sign in to your HANSA farmer account', hi: 'अपने हंसा किसान खाते में साइन इन करें' },
  email: { en: 'Email', hi: 'ईमेल' },
  password: { en: 'Password', hi: 'पासवर्ड' },
  sign_in: { en: 'Sign In', hi: 'साइन इन करें' },
  use_demo: { en: 'Use Demo Farmer Account', hi: 'डेमो किसान खाता इस्तेमाल करें' },
  new_here: { en: 'New here?', hi: 'नए हैं?' },
  create_account: { en: 'Create account', hi: 'खाता बनाएँ' },
  full_name: { en: 'Full Name', hi: 'पूरा नाम' },
  phone_optional: { en: 'Phone (optional)', hi: 'फ़ोन (वैकल्पिक)' },
  password_hint: { en: 'Password (min 6)', hi: 'पासवर्ड (कम से कम 6)' },
  already_have: { en: 'Already have an account?', hi: 'पहले से खाता है?' },

  // tabs
  home: { en: 'Home', hi: 'होम' },
  products: { en: 'Products', hi: 'उत्पाद' },
  warranty: { en: 'Warranty', hi: 'वारंटी' },
  orders: { en: 'Orders', hi: 'ऑर्डर' },
  profile: { en: 'Profile', hi: 'प्रोफ़ाइल' },

  // home
  namaste: { en: 'Namaste', hi: 'नमस्ते' },
  what_harvest: { en: 'What will you harvest today?', hi: 'आज आप क्या बोएँगे?' },
  active_offers: { en: 'Active Offers', hi: 'चालू ऑफ़र' },
  view_all: { en: 'View all', hi: 'सभी देखें' },
  shop_by_cat: { en: 'Shop by Category', hi: 'श्रेणी से खरीदें' },
  featured_products: { en: 'Featured Products', hi: 'चुनिंदा उत्पाद' },
  latest_updates: { en: 'Latest Updates', hi: 'ताज़ा अपडेट' },
  dealers: { en: 'Dealers', hi: 'डीलर' },
  support: { en: 'Support', hi: 'सहायता' },
  shop_now: { en: 'Shop Now', hi: 'अभी खरीदें' },
  warranty_expiring: { en: 'Warranty expiring soon', hi: 'वारंटी जल्द समाप्त हो रही' },
  days_left: { en: 'days left', hi: 'दिन शेष' },

  // catalog
  search_placeholder: { en: 'Search tillers, harrows...', hi: 'खोजें टिलर, हैरो...' },
  all: { en: 'All', hi: 'सभी' },
  no_products: { en: 'No products found', hi: 'कोई उत्पाद नहीं मिला' },

  // product detail
  add_to_cart: { en: 'Add to Cart', hi: 'कार्ट में जोड़ें' },
  buy_now: { en: 'Buy Now', hi: 'अभी खरीदें' },
  key_features: { en: 'Key Features', hi: 'मुख्य विशेषताएँ' },
  specifications: { en: 'Specifications', hi: 'विशेष विवरण' },
  months_warranty: { en: 'months warranty', hi: 'महीने की वारंटी' },
  save: { en: 'Save', hi: 'बचत' },

  // cart
  cart: { en: 'Cart', hi: 'कार्ट' },
  empty_cart: { en: 'Your cart is empty', hi: 'आपका कार्ट खाली है' },
  browse_products: { en: 'Browse Products', hi: 'उत्पाद देखें' },
  subtotal: { en: 'Subtotal', hi: 'उप-योग' },
  checkout: { en: 'Checkout', hi: 'चेकआउट' },

  // checkout
  shipping_address: { en: 'Shipping Address', hi: 'डिलीवरी पता' },
  address: { en: 'Address (village, street)', hi: 'पता (गाँव, गली)' },
  city: { en: 'City', hi: 'शहर' },
  state: { en: 'State', hi: 'राज्य' },
  pincode: { en: 'Pincode', hi: 'पिनकोड' },
  promo_code: { en: 'Promo Code', hi: 'प्रोमो कोड' },
  apply: { en: 'Apply', hi: 'लागू करें' },
  payment_method: { en: 'Payment Method', hi: 'भुगतान विधि' },
  cod: { en: 'Cash on Delivery', hi: 'डिलीवरी पर नकद' },
  cod_sub: { en: 'Pay when you receive the product', hi: 'उत्पाद मिलने पर भुगतान करें' },
  razorpay: { en: 'Razorpay (UPI / Card / Netbanking)', hi: 'Razorpay (UPI / कार्ड / नेटबैंकिंग)' },
  order_summary: { en: 'Order Summary', hi: 'ऑर्डर सारांश' },
  discount: { en: 'Discount', hi: 'छूट' },
  shipping: { en: 'Shipping', hi: 'शिपिंग' },
  free: { en: 'Free', hi: 'मुफ़्त' },
  total: { en: 'Total', hi: 'कुल' },
  place_order: { en: 'Place Order', hi: 'ऑर्डर करें' },

  // warranty
  warranty_tracker: { en: 'Warranty Tracker', hi: 'वारंटी ट्रैकर' },
  coverage_sub: { en: 'All your products & their coverage', hi: 'आपके सभी उत्पाद और उनकी कवरेज' },
  active: { en: 'ACTIVE', hi: 'सक्रिय' },
  expired: { en: 'EXPIRED', hi: 'समाप्त' },
  purchased: { en: 'Purchased', hi: 'खरीदा' },
  expires: { en: 'Expires', hi: 'समाप्ति' },
  days_left_lbl: { en: 'Days Left', hi: 'दिन शेष' },
  claim_warranty: { en: 'Claim Warranty', hi: 'वारंटी दावा करें' },
  warranty_expired_btn: { en: 'Warranty Expired', hi: 'वारंटी समाप्त' },
  no_warranties: { en: 'No warranties yet', hi: 'अभी कोई वारंटी नहीं' },

  // orders
  my_purchases: { en: 'My Purchases', hi: 'मेरी खरीदारी' },
  track_sub: { en: 'Track your orders and past purchases', hi: 'अपने ऑर्डर और पिछली खरीदारी देखें' },
  no_orders: { en: 'No orders yet', hi: 'अभी कोई ऑर्डर नहीं' },
  start_shopping: { en: 'Start Shopping', hi: 'खरीदारी शुरू करें' },
  view_warranty: { en: 'View Warranty', hi: 'वारंटी देखें' },

  // profile
  account: { en: 'Account', hi: 'खाता' },
  my_orders: { en: 'My Orders', hi: 'मेरे ऑर्डर' },
  offers_discounts: { en: 'Offers & Discounts', hi: 'ऑफ़र और छूट' },
  news_updates: { en: 'News & Updates', hi: 'समाचार और अपडेट' },
  find_dealer: { en: 'Find a Dealer', hi: 'डीलर खोजें' },
  support_service: { en: 'Support & Service', hi: 'सहायता और सेवा' },
  admin_dashboard: { en: 'Admin Dashboard', hi: 'एडमिन डैशबोर्ड' },
  company: { en: 'Company', hi: 'कंपनी' },
  logout: { en: 'Logout', hi: 'लॉगआउट' },
  language: { en: 'Language', hi: 'भाषा' },
  english: { en: 'English', hi: 'अंग्रेज़ी' },
  hindi: { en: 'हिन्दी', hi: 'हिन्दी' },
};

type Ctx = { lang: Lang; t: (k: string) => string; setLang: (l: Lang) => void };
const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    AsyncStorage.getItem('rkai_lang').then((v) => {
      if (v === 'en' || v === 'hi') setLangState(v);
    });
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem('rkai_lang', l).catch(() => {});
  }, []);

  const t = useCallback((k: string) => {
    return STRINGS[k]?.[lang] ?? STRINGS[k]?.en ?? k;
  }, [lang]);

  return <I18nCtx.Provider value={{ lang, t, setLang }}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const c = useContext(I18nCtx);
  if (!c) throw new Error('useI18n must be within I18nProvider');
  return c;
}

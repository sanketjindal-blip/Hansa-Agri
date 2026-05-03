/**
 * `PwaInstaller` — web-only side-effect component:
 *   1. Registers `/sw.js` once after the first paint so the offline shell
 *      kicks in on the next visit. No-op on native.
 *   2. Listens for `beforeinstallprompt`, stashes the event, and shows a tiny
 *      "Install HANSA app" banner the user can dismiss. Tapping it triggers
 *      the native browser install dialog (Add to Home Screen / Install app).
 *
 * Mounted once in `_layout.tsx`. Renders nothing on iOS / Android / Expo Go.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

const DISMISS_KEY = 'hansa_pwa_install_dismissed_v1';

export default function PwaInstaller() {
  const [deferred, setDeferred] = useState<any>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;

    // 0) Inject the PWA manifest link + apple-touch-icon + theme-color so
    // the browser treats this as installable. Idempotent — only added once.
    try {
      const head = document.head;
      if (!head.querySelector('link[rel="manifest"]')) {
        const m = document.createElement('link');
        m.rel = 'manifest'; m.href = '/manifest.json'; head.appendChild(m);
      }
      if (!head.querySelector('link[rel="apple-touch-icon"]')) {
        const a = document.createElement('link');
        a.rel = 'apple-touch-icon';
        a.setAttribute('href', '/assets/images/icon.png');
        head.appendChild(a);
      }
      if (!head.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
        const c = document.createElement('meta');
        c.name = 'apple-mobile-web-app-capable'; c.content = 'yes'; head.appendChild(c);
      }
      if (!head.querySelector('meta[name="apple-mobile-web-app-title"]')) {
        const t = document.createElement('meta');
        t.name = 'apple-mobile-web-app-title'; t.content = 'HANSA'; head.appendChild(t);
      }
    } catch { /* SSR or sandboxed iframe */ }

    // 1) Register the service worker (production only — dev has HMR).
    const isProd = !window.location.hostname.includes('localhost')
      && !window.location.hostname.includes('127.0.0.1');
    if (isProd && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      });
    }

    // 2) Hook the install prompt.
    const onBefore = (e: any) => {
      e.preventDefault();
      setDeferred(e);
      try {
        if (window.localStorage.getItem(DISMISS_KEY)) return;
      } catch { /* private browsing */ }
      setHidden(false);
    };
    const onInstalled = () => { setHidden(true); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onBefore);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBefore);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice?.outcome) setHidden(true);
  }, [deferred]);

  const dismiss = useCallback(() => {
    setHidden(true);
    try { window.localStorage.setItem(DISMISS_KEY, '1'); } catch { /* no-op */ }
  }, []);

  if (Platform.OS !== 'web' || hidden || !deferred) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.card}>
        <Ionicons name="download" size={20} color={theme.colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Install HANSA app</Text>
          <Text style={styles.sub}>Add it to your home screen for instant access</Text>
        </View>
        <TouchableOpacity onPress={install} style={styles.installBtn}>
          <Text style={styles.installTxt}>Install</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={dismiss} style={styles.x}><Ionicons name="close" size={18} color={theme.colors.textMuted} /></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    width: '100%',
    maxWidth: 460,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 12px 30px -10px rgba(0,0,0,0.25)' } as any)
      : {}),
  },
  title: { fontSize: 13, fontWeight: '800', color: theme.colors.textPrimary },
  sub: { fontSize: 11, color: theme.colors.textMuted, marginTop: 1 },
  installBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  installTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },
  x: { padding: 4 },
});

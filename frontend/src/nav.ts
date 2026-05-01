import { router } from 'expo-router';

/**
 * Robust back navigation: uses router.back() when there is history,
 * otherwise falls back to the given route (defaults to /(tabs)/profile).
 *
 * Fixes the case where a screen was opened from a deep link / direct route
 * push and `back()` would otherwise no-op.
 */
export function safeBack(fallback: string = '/(tabs)/profile') {
  try {
    if ((router as any).canGoBack && (router as any).canGoBack()) {
      router.back();
      return;
    }
  } catch {}
  router.replace(fallback as any);
}

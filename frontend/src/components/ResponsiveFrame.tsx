/**
 * `ResponsiveFrame` — wraps the entire app and gives it a polished, centered
 * "phone canvas" look on web/desktop while leaving the mobile native layout
 * completely untouched.
 *
 *   • mobile (<768px) → pass-through: fills the viewport edge-to-edge.
 *   • web tablet/desktop → fills viewport with a soft slate background, and
 *     centers a 480px-wide phone-shaped column with subtle elevation. This
 *     way the existing mobile-first screens feel intentional on a desktop
 *     browser instead of a stretched-out strip.
 *
 *   Admin / dashboard pages can still expand to a wider canvas by detecting
 *   the breakpoint with `useBreakpoint()` and overriding their own layout —
 *   this wrapper just provides the default "phone in the middle of a desk".
 */
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useBreakpoint } from '../hooks/useBreakpoint';

const PHONE_MAX_WIDTH = 480;

export default function ResponsiveFrame({ children }: { children: React.ReactNode }) {
  const { isWeb, isMobile } = useBreakpoint();

  if (!isWeb || isMobile) {
    // Native or narrow web: pass through unchanged.
    return <>{children}</>;
  }

  return (
    <View style={styles.outer}>
      <View style={styles.phone}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: '#1F2937', // slate-800 — neutral slate for the desk
    alignItems: 'center',
    justifyContent: 'center',
    // CSS background pattern for a subtle "lined notebook" feel on web only
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.04), transparent 40%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.04), transparent 40%)',
        } as any)
      : {}),
  },
  phone: {
    width: '100%',
    maxWidth: PHONE_MAX_WIDTH,
    height: '100%',
    maxHeight: 880,
    backgroundColor: '#F9FAFB',
    borderRadius: 28,
    overflow: 'hidden',
    // Soft elevation + accent border on web only
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 30px 60px -15px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08)',
        } as any)
      : {}),
  },
});

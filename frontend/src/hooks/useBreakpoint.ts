/**
 * Tiny wrapper around `useWindowDimensions` that exposes mobile / tablet /
 * desktop breakpoints. Matches the values used by ResponsiveFrame.
 *
 *   <  768px → mobile (default native phone layout)
 *   768-1024 → tablet (still centered phone-style column on web)
 *   ≥ 1024px → desktop (admin pages can opt into a wider canvas)
 */
import { useWindowDimensions, Platform } from 'react-native';

export const BREAKPOINT_TABLET = 768;
export const BREAKPOINT_DESKTOP = 1024;

export function useBreakpoint() {
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isMobile = width < BREAKPOINT_TABLET;
  const isTablet = width >= BREAKPOINT_TABLET && width < BREAKPOINT_DESKTOP;
  const isDesktop = width >= BREAKPOINT_DESKTOP;
  return { width, height, isWeb, isMobile, isTablet, isDesktop };
}

/** Returns true when we should render the centered "phone canvas" web shell. */
export function useIsWebDesktop() {
  const { isWeb, isMobile } = useBreakpoint();
  return isWeb && !isMobile;
}

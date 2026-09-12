'use client';
import { useSyncExternalStore } from 'react';
const MOBILE_QUERY = '(max-width: 767px)';
const subscribe = (callback: () => void) => {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
};
export function useIsMobile() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(MOBILE_QUERY).matches, () => false);
}

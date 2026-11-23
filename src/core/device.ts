/** Lightweight runtime mobile/touch detection for FPS, DPR, bloom & touch UI optimizations */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const narrow = Math.min(window.innerWidth || 1024, window.innerHeight || 768) <= 768;
  return coarse || narrow;
}

/** Caps devicePixelRatio to 1.5 on mobile (saves ~44% GPU fill-rate on 3x screens) and 2 on desktop */
export function getOptimalDpr(): number {
  if (typeof window === 'undefined') return 1;
  const raw = window.devicePixelRatio || 1;
  return isMobileDevice() ? Math.min(raw, 1.5) : Math.min(raw, 2);
}

/**
 * Unthrottled 250ms background ticker powered by an inline Web Worker
 * (with automatic window.setInterval fallback).
 *
 * Browsers pause requestAnimationFrame and heavily throttle window.setInterval
 * when a tab is hidden or a window is minimized. A Web Worker timer continues
 * firing reliably so simulation, ant cooldowns, timers, and multiplayer sync
 * never freeze when the user switches tabs or minimizes the window.
 */

type TickListener = () => void;

const listeners = new Set<TickListener>();
let worker: Worker | null = null;
let fallbackInterval: number | null = null;

function dispatchTick() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      // Keep other listeners running
    }
  }
}

function ensureStarted() {
  if (worker || fallbackInterval !== null) return;

  try {
    const src = `setInterval(function(){ postMessage(0); }, 250);`;
    const blob = new Blob([src], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    worker = new Worker(url);
    worker.onmessage = dispatchTick;
    worker.onerror = () => {
      if (worker) {
        try {
          worker.terminate();
        } catch {
          // Ignore
        }
        worker = null;
      }
      if (fallbackInterval === null) {
        fallbackInterval = window.setInterval(dispatchTick, 250);
      }
    };
  } catch {
    fallbackInterval = window.setInterval(dispatchTick, 250);
  }
}

export function subscribeBackgroundTick(fn: TickListener): () => void {
  listeners.add(fn);
  ensureStarted();
  return () => {
    listeners.delete(fn);
  };
}

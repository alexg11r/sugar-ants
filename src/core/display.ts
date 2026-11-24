import { DisplayMode, ResolutionId } from './types';

export interface ResolutionPreset {
  id: ResolutionId;
  labelRu: string;
  labelEn: string;
  width: number;
  height: number;
}

export const RESOLUTION_PRESETS: ResolutionPreset[] = [
  { id: 'auto', labelRu: 'Авто (экран)', labelEn: 'Auto (Native)', width: 0, height: 0 },
  { id: '1280x720', labelRu: '1280 × 720 (HD)', labelEn: '1280 × 720 (HD)', width: 1280, height: 720 },
  { id: '1366x768', labelRu: '1366 × 768', labelEn: '1366 × 768', width: 1366, height: 768 },
  { id: '1600x900', labelRu: '1600 × 900 (HD+)', labelEn: '1600 × 900 (HD+)', width: 1600, height: 900 },
  { id: '1920x1080', labelRu: '1920 × 1080 (Full HD)', labelEn: '1920 × 1080 (Full HD)', width: 1920, height: 1080 },
  { id: '2560x1440', labelRu: '2560 × 1440 (2K QHD)', labelEn: '2560 × 1440 (2K QHD)', width: 2560, height: 1440 }
];

interface DesktopBridgeInfo {
  isDesktop: boolean;
  fullscreen: boolean;
  width: number;
  height: number;
  screenWidth: number;
  screenHeight: number;
}

interface WebView2Bridge {
  postMessage: (msg: string) => void;
  addEventListener: (event: 'message', listener: (ev: { data: unknown }) => void) => void;
}

function getDesktopInfo(): DesktopBridgeInfo | null {
  const w = window as unknown as { __sugarDesktop?: DesktopBridgeInfo };
  return w.__sugarDesktop && w.__sugarDesktop.isDesktop ? w.__sugarDesktop : null;
}

function getWebView(): WebView2Bridge | null {
  const w = window as unknown as { chrome?: { webview?: WebView2Bridge } };
  return w.chrome?.webview && typeof w.chrome.webview.postMessage === 'function' ? w.chrome.webview : null;
}

export function isDesktopApp(): boolean {
  return Boolean(getDesktopInfo() || getWebView());
}

export function getPresetById(id: ResolutionId): ResolutionPreset {
  return RESOLUTION_PRESETS.find((p) => p.id === id) || RESOLUTION_PRESETS[0];
}

export function getNativeScreenSize(): { width: number; height: number } {
  const d = getDesktopInfo();
  if (d && d.screenWidth > 0 && d.screenHeight > 0) {
    return { width: d.screenWidth, height: d.screenHeight };
  }
  return {
    width: Math.round((window.screen?.width || window.innerWidth) * (window.devicePixelRatio || 1)),
    height: Math.round((window.screen?.height || window.innerHeight) * (window.devicePixelRatio || 1))
  };
}

export function getCurrentDisplayMode(fallback: DisplayMode): DisplayMode {
  const d = getDesktopInfo();
  if (d) return d.fullscreen ? 'fullscreen' : 'windowed';
  if (typeof document !== 'undefined' && 'fullscreenElement' in document) {
    return document.fullscreenElement ? 'fullscreen' : 'windowed';
  }
  return fallback;
}

/**
 * Computes canvas backing pixel scale so selecting a resolution preset smoothly tunes
 * internal render sharpness in fullscreen and matches exact dimensions in windowed mode.
 */
export function getCanvasRenderScale(resolution: ResolutionId, viewW: number, viewH: number, baseDpr: number): number {
  const preset = getPresetById(resolution);
  if (preset.id === 'auto' || preset.width <= 0 || preset.height <= 0 || viewW <= 0 || viewH <= 0) {
    return baseDpr;
  }
  const scaleX = preset.width / viewW;
  const scaleY = preset.height / viewH;
  const target = Math.min(scaleX, scaleY);
  return Math.max(0.5, Math.min(2.5, target));
}

/** Applies Fullscreen / Windowed mode and Resolution on Windows Desktop (WebView2) or Desktop Web browsers */
export function applyDisplaySettings(mode: DisplayMode, resolution: ResolutionId, userInitiated = false): void {
  const preset = getPresetById(resolution);
  const wv = getWebView();
  if (wv) {
    const d = getDesktopInfo();
    if (d) {
      d.fullscreen = mode === 'fullscreen';
      if (preset.width > 0) {
        d.width = preset.width;
        d.height = preset.height;
      }
    }
    try {
      wv.postMessage(
        JSON.stringify({
          type: 'setDisplay',
          fullscreen: mode === 'fullscreen',
          width: preset.width,
          height: preset.height,
          auto: preset.id === 'auto'
        })
      );
    } catch {
      // Ignore bridge errors
    }
    return;
  }

  // Standard Web Browser Fullscreen API (requires user gesture)
  if (!userInitiated || typeof document === 'undefined') return;
  if (mode === 'fullscreen') {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  } else if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
}

/** Subscribes to external display mode changes (e.g. pressing F11 / Alt+Enter in Sugar Ants.exe or Esc in browser) */
export function subscribeDisplayChanges(onChange: (mode: DisplayMode) => void): void {
  const wv = getWebView();
  if (wv && typeof wv.addEventListener === 'function') {
    wv.addEventListener('message', (ev) => {
      try {
        const data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
        if (data && data.type === 'displayState' && typeof data.fullscreen === 'boolean') {
          const d = getDesktopInfo();
          if (d) {
            d.fullscreen = data.fullscreen;
            if (typeof data.width === 'number') d.width = data.width;
            if (typeof data.height === 'number') d.height = data.height;
          }
          onChange(data.fullscreen ? 'fullscreen' : 'windowed');
        }
      } catch {
        // Ignore non-JSON messages
      }
    });
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('fullscreenchange', () => {
      if (isDesktopApp()) return;
      onChange(document.fullscreenElement ? 'fullscreen' : 'windowed');
    });
  }
}

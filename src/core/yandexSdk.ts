interface YaGamesSDK {
  features?: {
    LoadingAPI?: {
      ready?: () => void;
    };
    GameplayAPI?: {
      start?: () => void;
      stop?: () => void;
    };
  };
  environment?: {
    i18n?: {
      lang?: string;
    };
  };
}

interface YaGamesGlobal {
  init?: () => Promise<YaGamesSDK>;
}

let cachedSdk: YaGamesSDK | null = null;
let gameplayActive = false;

/**
 * Safe Yandex Games SDK bridge:
 * - On Yandex Games (where /sdk.js defines window.YaGames), signals LoadingAPI.ready()
 *   and tracks GameplayAPI.start()/stop() cleanly for moderation compliance.
 * - Everywhere else (Windows EXE, Android APK/AAB, itch.io, offline), acts as a zero-overhead no-op!
 */
export function initYandexSdk(): void {
  try {
    const yg = (window as unknown as { YaGames?: YaGamesGlobal }).YaGames;
    if (!yg || typeof yg.init !== 'function') return;
    yg.init()
      .then((ysdk) => {
        cachedSdk = ysdk;
        try {
          ysdk.features?.LoadingAPI?.ready?.();
        } catch {
          // Ignore SDK feature errors
        }
        if (gameplayActive) {
          try {
            ysdk.features?.GameplayAPI?.start?.();
          } catch {
            // Ignore
          }
        }
      })
      .catch(() => {
        // Ignore offline/non-Yandex init rejection
      });
  } catch {
    // Ignore
  }
}

export function notifyYandexGameplayStart(): void {
  if (gameplayActive) return;
  gameplayActive = true;
  try {
    cachedSdk?.features?.GameplayAPI?.start?.();
  } catch {
    // Ignore
  }
}

export function notifyYandexGameplayStop(): void {
  if (!gameplayActive) return;
  gameplayActive = false;
  try {
    cachedSdk?.features?.GameplayAPI?.stop?.();
  } catch {
    // Ignore
  }
}

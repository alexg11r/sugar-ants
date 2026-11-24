declare const __HIDE_EXTERNAL_LINKS__: boolean | undefined;
declare const __IS_DEMO_VERSION__: boolean | undefined;

/**
 * Центральный переключатель для публикационных сборок (Яндекс Игры, Poki, CrazyGames и т.д.).
 *
 * Как включить скрытие всех внешних ссылок (Telegram, Boosty):
 * 1) Через команду сборки: `npm run build:store` или `npm run build:yandex` (или `HIDE_EXTERNAL_LINKS=true npm run build`)
 * 2) Либо вручную переключить `DEFAULT_HIDE_EXTERNAL_LINKS` ниже на `true`.
 */
const DEFAULT_HIDE_EXTERNAL_LINKS = false;
const DEFAULT_IS_DEMO_VERSION = false;

export const hideExternalLinks: boolean =
  typeof __HIDE_EXTERNAL_LINKS__ === 'boolean'
    ? __HIDE_EXTERNAL_LINKS__
    : DEFAULT_HIDE_EXTERNAL_LINKS;

/** Включает демо-версию: доступны только первые 2 уровня, после 2-го уровня открывается экран с 2 QR (Boosty + Telegram) */
export const isDemoVersion: boolean =
  typeof __IS_DEMO_VERSION__ === 'boolean'
    ? __IS_DEMO_VERSION__
    : DEFAULT_IS_DEMO_VERSION;

export const DEMO_MAX_LEVELS = 2;

export const TELEGRAM_URL = 'https://t.me/graxstudio';
export const BOOSTY_URL = 'https://boosty.to/graxstudio';

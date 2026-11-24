declare const __HIDE_EXTERNAL_LINKS__: boolean | undefined;

/**
 * Центральный переключатель для публикационных сборок (Яндекс Игры, Poki, CrazyGames и т.д.).
 *
 * Как включить скрытие всех внешних ссылок (например, Telegram):
 * 1) Через команду сборки: `npm run build:store` (или `HIDE_EXTERNAL_LINKS=true npm run build`)
 * 2) Либо вручную переключить `DEFAULT_HIDE_EXTERNAL_LINKS` ниже на `true`.
 */
const DEFAULT_HIDE_EXTERNAL_LINKS = false;

export const hideExternalLinks: boolean =
  typeof __HIDE_EXTERNAL_LINKS__ === 'boolean'
    ? __HIDE_EXTERNAL_LINKS__
    : DEFAULT_HIDE_EXTERNAL_LINKS;

export const TELEGRAM_URL = 'https://t.me/graxstudio';

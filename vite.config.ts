import { defineConfig, Plugin } from 'vite';

function storePackagingHtmlPlugin(opts: {
  stripExternalLinks: boolean;
  injectYandexSdk: boolean;
  isDemo: boolean;
}): Plugin {
  return {
    name: 'sugar-ants-store-packaging',
    transformIndexHtml(html) {
      let out = html;
      if (opts.stripExternalLinks) {
        out = out.replace(/<a\b[^>]*\bdata-external-link\b[^>]*>[\s\S]*?<\/a>/gi, '');
      }
      if (opts.injectYandexSdk && !out.includes('/sdk.js')) {
        out = out.replace('</head>', '    <script src="/sdk.js"></script>\n  </head>');
      }
      if (opts.isDemo) {
        out = out.replace(/<title>([^<]*)<\/title>/i, '<title>Sugar Ants Demo — Медитативная колония</title>');
      }
      return out;
    }
  };
}

export default defineConfig(({ mode }) => {
  const envRaw = process.env.HIDE_EXTERNAL_LINKS ?? process.env.VITE_HIDE_EXTERNAL_LINKS;
  const demoEnv = process.env.DEMO_VERSION ?? process.env.VITE_DEMO_VERSION;
  const isStoreMode = mode === 'store' || mode === 'yandex';
  const isDemo =
    mode === 'demo' || demoEnv === 'true' || demoEnv === '1';

  const resolvedOverride = isStoreMode
    ? true
    : envRaw === 'true' || envRaw === '1'
      ? true
      : envRaw === 'false' || envRaw === '0'
        ? false
        : undefined;

  return {
    base: './',
    define: {
      __HIDE_EXTERNAL_LINKS__:
        resolvedOverride === undefined ? 'undefined' : JSON.stringify(resolvedOverride),
      __IS_DEMO_VERSION__: JSON.stringify(isDemo)
    },
    plugins: [
      storePackagingHtmlPlugin({
        stripExternalLinks: resolvedOverride === true,
        injectYandexSdk: mode === 'yandex',
        isDemo
      })
    ],
    server: {
      host: true,
      port: 5173
    }
  };
});

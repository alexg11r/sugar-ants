import { defineConfig, Plugin } from 'vite';

function storePackagingHtmlPlugin(opts: {
  stripExternalLinks: boolean;
  injectYandexSdk: boolean;
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
      return out;
    }
  };
}

export default defineConfig(({ mode }) => {
  const envRaw = process.env.HIDE_EXTERNAL_LINKS ?? process.env.VITE_HIDE_EXTERNAL_LINKS;
  const isStoreMode = mode === 'store' || mode === 'yandex';
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
        resolvedOverride === undefined ? 'undefined' : JSON.stringify(resolvedOverride)
    },
    plugins: [
      storePackagingHtmlPlugin({
        stripExternalLinks: resolvedOverride === true,
        injectYandexSdk: mode === 'yandex'
      })
    ],
    server: {
      host: true,
      port: 5173
    }
  };
});

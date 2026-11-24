import { defineConfig, Plugin } from 'vite';

function stripExternalLinksHtmlPlugin(enabled: boolean): Plugin {
  return {
    name: 'sugar-ants-strip-external-links',
    transformIndexHtml(html) {
      if (!enabled) return html;
      return html.replace(/<a\b[^>]*\bdata-external-link\b[^>]*>[\s\S]*?<\/a>/gi, '');
    }
  };
}

export default defineConfig(({ mode }) => {
  const envRaw = process.env.HIDE_EXTERNAL_LINKS ?? process.env.VITE_HIDE_EXTERNAL_LINKS;
  const resolvedOverride =
    mode === 'store'
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
    plugins: [stripExternalLinksHtmlPlugin(resolvedOverride === true)],
    server: {
      host: true,
      port: 5173
    }
  };
});

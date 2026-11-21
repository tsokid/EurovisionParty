// vite.gallery.config.ts — dev-only screen gallery (see gallery/main.tsx).
//   node node_modules/vite/bin/vite.js --config vite.gallery.config.ts
// Not used by `npm run build`, the prerender or the deploy.
//
// - Reuses the main config's plugins (content, React, Tailwind) minus the PWA.
// - Serves gallery/index.html at http://localhost:4190/ (?screen=<id>).
// - Replaces src/lib/supabase.ts with gallery/fakeSupabase.ts, so no request
//   ever reaches Supabase. envDir points at gallery/ so the real
//   VITE_SUPABASE_* values from .env are not even loaded.

import { defineConfig, type Plugin, type PluginOption, type UserConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mainConfig from './vite.config';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const REAL_SUPABASE = path.join(ROOT, 'src/lib/supabase.ts');
const FAKE_SUPABASE = path.join(ROOT, 'gallery/fakeSupabase.ts');

function fakeSupabasePlugin(): Plugin {
  return {
    name: 'gallery-fake-supabase',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!/(^|\/)supabase(\.ts)?$/.test(source)) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      return resolved && path.normalize(resolved.id) === REAL_SUPABASE ? FAKE_SUPABASE : null;
    },
    load(id) {
      // Belt and braces: the real client module must never be served.
      if (path.normalize(id.split('?')[0]) === REAL_SUPABASE) {
        throw new Error('[gallery] src/lib/supabase.ts was loaded — the fake alias failed');
      }
      return null;
    },
  };
}

function galleryEntryPlugin(): Plugin {
  return {
    name: 'gallery-entry',
    configureServer(server) {
      // Runs before Vite's own middlewares: `/` and `/index.html` → gallery page.
      server.middlewares.use((req, _res, next) => {
        const [pathname, query] = (req.url ?? '/').split('?');
        if (pathname === '/' || pathname === '/index.html') {
          req.url = '/gallery/index.html' + (query ? `?${query}` : '');
        }
        next();
      });
    },
  };
}

function flatten(plugins: PluginOption[]): Plugin[] {
  return plugins.flatMap((p) => (Array.isArray(p) ? flatten(p) : p && typeof p === 'object' && 'name' in p ? [p as Plugin] : []));
}

export default defineConfig((env) => {
  const base = (typeof mainConfig === 'function' ? mainConfig({ ...env, isSsrBuild: false }) : mainConfig) as UserConfig;
  const plugins = flatten((base.plugins ?? []) as PluginOption[]).filter((p) => !p.name.startsWith('vite-plugin-pwa'));
  return {
    define: base.define,
    resolve: base.resolve,
    plugins: [fakeSupabasePlugin(), galleryEntryPlugin(), ...plugins],
    envDir: path.join(ROOT, 'gallery'),
    cacheDir: path.join(ROOT, 'node_modules/.vite-gallery'),
    optimizeDeps: { entries: ['gallery/index.html'] },
    server: { port: 4190, strictPort: true },
  };
});

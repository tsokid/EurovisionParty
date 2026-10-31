import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const CONTENT_DIR = path.join(ROOT, 'content')
const CONTENT_DATA = path.join(ROOT, 'src/lib/seo/contentData.ts')
const CONTENT_DATA_CLIENT = path.join(ROOT, 'src/lib/seo/contentData.client.ts')

/** Every *.json under content/, as forward-slash paths relative to it. */
function contentFiles(dir = CONTENT_DIR, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    if (d.isDirectory()) return contentFiles(path.join(dir, d.name), `${prefix}${d.name}/`)
    return d.name.endsWith('.json') ? [`${prefix}${d.name}`] : []
  })
}

/**
 * Split content loading (keeps the ~1.7 MB snapshot out of the client JS):
 * - client graph: src/lib/seo/contentData.ts (eager import.meta.glob of
 *   content/**) resolves to contentData.client.ts; SSR and vitest keep the
 *   eager module;
 * - client build: content/**\/*.json is published as static (minified) JSON at
 *   dist/content/**, which useContent() fetches on client-side navigation;
 * - dev server: /content/** is served straight from content/.
 */
function contentPlugin(isSsrBuild: boolean): Plugin {
  return {
    name: 'europarty-content',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (isSsrBuild || options?.ssr || !/(^|\/)contentData$/.test(source)) return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      return resolved && path.normalize(resolved.id) === CONTENT_DATA ? CONTENT_DATA_CLIENT : null
    },
    configureServer(server) {
      server.middlewares.use('/content', (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? '').split('?')[0]).replace(/^\/+/, '')
        const file = path.resolve(CONTENT_DIR, rel)
        if (!rel.endsWith('.json') || !file.startsWith(CONTENT_DIR + path.sep) || !existsSync(file) || !statSync(file).isFile()) {
          return next()
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(readFileSync(file))
      })
    },
    generateBundle() {
      if (isSsrBuild) return
      for (const rel of contentFiles()) {
        const json = JSON.parse(readFileSync(path.join(CONTENT_DIR, rel), 'utf8'))
        this.emitFile({ type: 'asset', fileName: `content/${rel}`, source: JSON.stringify(json) })
      }
    },
  }
}

/**
 * Build date for e.g. a guide page's dateModified: the HEAD commit's date
 * (YYYY-MM-DD), so the client and SSR builds (separate processes) and any
 * rebuild of the same commit agree. Today (UTC) only outside a git checkout.
 */
function buildDate(): string {
  try {
    const d = execSync('git log -1 --format=%cs', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  } catch {
    // not a git checkout
  }
  return new Date().toISOString().slice(0, 10)
}
const BUILD_DATE = buildDate()

export default defineConfig(({ isSsrBuild }) => ({
  define: {
    'import.meta.env.VITE_BUILD_DATE': JSON.stringify(BUILD_DATE),
  },
  plugins: [
    contentPlugin(!!isSsrBuild),
    react(),
    tailwindcss(),
    // The SSR bundle (dist-server) needs no service worker or manifest.
    !isSsrBuild && VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        navigateFallbackDenylist: [/^\/sitemap\.xml$/, /^\/robots\.txt$/, /^\/llms\.txt$/, /^\/content\//],
        // Belt-and-braces only: keeps prerendered HTML out of the precache
        // manifest. Once the SW controls the page, its NavigationRoute still
        // answers navigations (including /en/** and /el/**) with the cached
        // index.html SPA shell; prerendered HTML reaches crawlers and first
        // visits, not SW-controlled navigations.
        // The lazy admin chunk loads on /admin only: not precached for
        // every visitor (tests/scripts/swPrecache.test.ts).
        globIgnores: ['en.html', 'el.html', 'en/**', 'el/**', '404.html', 'content/**', 'assets/AdminRoute-*.js'],
      },
      manifest: {
        name: 'Eurovision Games',
        short_name: 'Eurovision Games',
        description: 'Eurovision Grand Final Party Game',
        theme_color: '#1a0533',
        background_color: '#0f0520',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
  // dist/.vite/manifest.json lets tests/scripts/bundleSize.test.ts tell public
  // chunks from the lazy admin chunk.
  build: { manifest: !isSsrBuild },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
}))

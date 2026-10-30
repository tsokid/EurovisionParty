import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // The SSR bundle (dist-server) needs no service worker or manifest.
    !isSsrBuild && VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        navigateFallbackDenylist: [/^\/sitemap\.xml$/, /^\/robots\.txt$/, /^\/llms\.txt$/],
        // Belt-and-braces only: keeps prerendered HTML out of the precache
        // manifest. Once the SW controls the page, its NavigationRoute still
        // answers navigations (including /en/** and /el/**) with the cached
        // index.html SPA shell; prerendered HTML reaches crawlers and first
        // visits, not SW-controlled navigations.
        globIgnores: ['en.html', 'el.html', 'en/**', 'el/**', '404.html'],
      },
      manifest: {
        name: 'Eurovision Games 2026',
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
  resolve: {
    alias: {
      '@': '/src',
    },
  },
}))

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // L'aggiornamento è proposto all'utente (banner "Aggiorna"), non applicato di nascosto.
      registerType: 'prompt',
      manifest: {
        name: 'Quadra',
        short_name: 'Quadra',
        description: 'Libro mastro personale: conti, movimenti e budget.',
        lang: 'it',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#f3efe3',
        background_color: '#f3efe3',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Si precacheano solo la shell e gli asset con hash; font solo latin (le altre varianti restano in rete).
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}', '**/jetbrains-mono-latin-[0-9]*.woff2'],
        // Login (/auth/callback) e config passano dalla rete/shell, mai dalla cache del service worker.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/auth-config\.json$/, /^\/sw\.js$/, /^\/workbox-/],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: { sourcemap: false, target: 'es2022' },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})

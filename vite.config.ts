import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.svg', 'icons/*.png', 'samples/**/*'],
      manifest: false, // We're using our own public/manifest.json
      workbox: {
        // Cache strategies
        runtimeCaching: [
          {
            // Cache sample audio files (large, immutable)
            urlPattern: /^.*\/samples\/.*\.(mp3|wav|ogg|flac)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'audio-samples-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache font files
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
        // Precache app shell
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Skip worklet files from precaching (they're loaded dynamically)
        globIgnores: ['**/worklets/**'],
      },
      devOptions: {
        enabled: false, // Disable in dev to avoid conflicts
      },
    }),
  ],
  // Add WASM support
  optimizeDeps: {
    exclude: ['dsp_core'], // Don't pre-bundle WASM
  },

  build: {
    target: 'esnext', // Required for top-level await
  },

  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },

  assetsInclude: ['**/*.wasm'],
})

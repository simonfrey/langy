import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/langy/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'Langy',
        short_name: 'Langy',
        description: 'Language learning with spaced repetition',
        scope: '/langy/',
        start_url: '/langy/',
        display: 'standalone',
        theme_color: '#6366f1',
        background_color: '#0f172a',
        icons: [
          { src: '/langy/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/langy/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/langy/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})

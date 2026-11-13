import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Vercel builds (VERCEL=1) route database calls through /sb (see vercel.json). SB_PROXY=1 tests it locally.
const sbProxy = process.env.VERCEL || process.env.SB_PROXY ? '/sb' : ''
const supabaseUrl = 'https://jooogfukzhnhdzlpimcc.supabase.co'

// Relative base so the same build works on GitHub Pages (/repo-name/) and locally.
export default defineConfig({
  base: './',
  define: { __SB_PROXY__: JSON.stringify(sbProxy) },
  server: {
    // Local stand-in for the Vercel pass-through
    proxy: { '/sb': { target: supabaseUrl, changeOrigin: true, rewrite: (p) => p.replace(/^\/sb/, '') } },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png'],
      manifest: {
        name: 'Member Registry · အဖွဲ့ဝင် မှတ်တမ်း',
        short_name: 'Members',
        description: 'Record and search organisation members',
        theme_color: '#4f46e5',
        background_color: '#f6f7f9',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // never cache database / login traffic
        navigateFallbackDenylist: [/^\/auth/, /^\/rest/, /^\/sb\//],
      },
    }),
  ],
})

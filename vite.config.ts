import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProduction = mode === 'production';

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'icon.svg'],
        manifest: {
          id: '/',
          name: 'سامانه جامع طلاب',
          short_name: 'سامانه طلاب',
          description: 'سیستم جامع مدیریت آموزشی، پژوهشی و انضباطی طلاب با تحلیل هوشمند',
          theme_color: '#4f46e5',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '/',
          scope: '/',
          lang: 'fa',
          dir: 'rtl',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^\/api\/.*/i,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /\.(?:js|css|woff2|woff|png|svg|ico)$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'static-assets-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    base: env.VITE_BASE_PATH || '/',
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        external: [
          'firebase', 'firebase/app', 'firebase/firestore', 'firebase/auth',
          '@firebase/app', '@firebase/firestore',
          'mysql2', 'net', 'tls', 'fs', 'crypto', 'stream', 'buffer'
        ],
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom')) {
                return 'vendor-react';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('recharts')) {
                return 'vendor-charts';
              }
              if (id.includes('jspdf') || id.includes('html2pdf') || id.includes('html2canvas') || id.includes('xlsx')) {
                return 'vendor-pdf-export';
              }
              if (id.includes('motion')) {
                return 'vendor-animation';
              }
              if (id.includes('@supabase')) {
                return 'vendor-supabase';
              }
            }
          }
        }
      }
    },
    server: {
      host: '0.0.0.0',
      allowedHosts: true,
      hmr: !isProduction,
      watch: isProduction ? null : {},
      cors: true,
      port: parseInt(env.VITE_PORT || '5173'),
    },
    preview: {
      host: '0.0.0.0',
      allowedHosts: true,
      cors: true,
      port: parseInt(env.VITE_PREVIEW_PORT || '4173'),
    },
  };
});

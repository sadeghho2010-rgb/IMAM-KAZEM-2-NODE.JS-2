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
          cleanupOutdatedCaches: true,
          globPatterns: ['**/*.{js,css,html,woff2}'],
          globIgnores: [
            '**/vendor-pdf*',
            '**/vendor-excel*',
            '**/*.jpg',
            '**/*.jpeg',
            '**/*.png',
            '**/*latin*.woff2',
            '**/*500*.woff2',
            '**/*800*.woff2'
          ],
          maximumFileSizeToCacheInBytes: 3000000,
          runtimeCaching: [
            {
              urlPattern: /\/assets\/(vendor-pdf|vendor-excel).*\.js$/,
              handler: 'CacheFirst',
              options: { 
                cacheName: 'lazy-vendor',
                expiration: { maxEntries: 10 }
              }
            },
            {
              urlPattern: /\.(?:jpg|jpeg|png|webp|svg)$/,
              handler: 'CacheFirst',
              options: { 
                cacheName: 'images',
                expiration: { maxEntries: 30 }
              }
            }
          ]
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
      modulePreload: {
        resolveDependencies: (filename, deps) => {
          return deps.filter(dep => 
            !dep.includes('vendor-pdf') && 
            !dep.includes('vendor-excel')
          );
        }
      },
      rollupOptions: {
        external: [
          'firebase', 'firebase/app', 'firebase/firestore', 'firebase/auth',
          '@firebase/app', '@firebase/firestore',
          'mysql2', 'net', 'tls', 'fs', 'crypto', 'stream', 'buffer'
        ],
        output: {
          manualChunks(id) {
            if (id.includes('html2pdf') || id.includes('jspdf') || id.includes('html2canvas')) {
              return 'vendor-pdf-export';
            }
            if (id.includes('xlsx')) {
              return 'vendor-excel';
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

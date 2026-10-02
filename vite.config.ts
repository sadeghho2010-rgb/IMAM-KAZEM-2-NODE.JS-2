import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProduction = mode === 'production' || process.env.NODE_ENV === 'production';

  return {
    plugins: [react()],
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    
    // Base path: configurable via VITE_BASE_PATH or default to '/'
    base: env.VITE_BASE_PATH || process.env.VITE_BASE_PATH || '/',
    
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
          },
        },
      },
    },
    
    server: {
      // Bind to all network interfaces for Runflare, Docker, VPS, and Cloud
      host: '0.0.0.0',
      
      // Allow all hosts to prevent "Blocked request: This host is not allowed"
      allowedHosts: true,
      
      // CORS enabled for cross-origin setups and webhooks
      cors: true,
      
      // HMR settings
      hmr: process.env.DISABLE_HMR === 'true' || isProduction ? false : true,
      
      // Watch settings
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      
      // Port configuration
      port: parseInt(env.VITE_PORT || process.env.PORT || '3000', 10),
      strictPort: false,
    },
    
    preview: {
      host: '0.0.0.0',
      allowedHosts: true,
      cors: true,
      port: parseInt(env.VITE_PREVIEW_PORT || '4173', 10),
    },
  };
});

import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProduction = mode === 'production';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    base: env.VITE_BASE_PATH || '/',
    build: {
      outDir: 'dist',
      sourcemap: false,
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

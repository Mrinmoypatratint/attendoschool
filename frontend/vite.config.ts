import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { nativeEntryHtml } from './scripts/nativeHtml';

// Check if .env is in frontend/, otherwise fallback to repository root .env
const envDir = fs.existsSync(path.resolve(__dirname, '.env'))
  ? __dirname
  : path.resolve(__dirname, '..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');
  const backendPort = env.BACKEND_PORT || env.PORT || process.env.PORT || '5002';
  const backendTarget = env.VITE_BACKEND_URL || `http://localhost:${backendPort}`;

  return {
  base: './',
  envDir,
  build: mode === 'native' ? { target: ['chrome83', 'safari15'] } : undefined,
  plugins: [react(), {
    name: 'native-offline-shell',
    transformIndexHtml(html: string) {
      if (mode !== 'native') return html;
      // A packaged app must render even when these third-party hosts are slow
      // or offline. Use the existing local font fallbacks and load checkout
      // independently of the initial WebView document.
      return nativeEntryHtml(html);
    }
  }],
  // Prebundle the native bridge before the first simulated/device login. This
  // prevents a dependency-discovery reload from resetting a form in dev/CI.
  optimizeDeps: {
    include: ['@capacitor/core', '@capacitor/app', '@capacitor/browser', '@capacitor/filesystem', '@capacitor/share']
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  }
  };
});

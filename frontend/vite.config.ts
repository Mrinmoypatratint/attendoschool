import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Check if .env is in frontend/, otherwise fallback to repository root .env
const envDir = fs.existsSync(path.resolve(__dirname, '.env'))
  ? __dirname
  : path.resolve(__dirname, '..');

export default defineConfig({
  base: './',
  envDir,
  plugins: [react()],
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
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  }
});

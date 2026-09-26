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
  server: { port: 5173 }
});
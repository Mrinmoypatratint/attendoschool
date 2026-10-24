#!/usr/bin/env bash
# ====================================================================
# AttendoSchool - CloudPanel VPS Deployment & Update Script
# Domain: attendoschool.online
# User: attendoschool
# Target: /home/attendoschool/htdocs/attendoschool.online
# ====================================================================

set -e

APP_DIR="/home/attendoschool/htdocs/attendoschool.online"

echo "===================================================================="
echo "🚀 Starting AttendoSchool VPS Deployment for attendoschool.online"
echo "Target Directory: $APP_DIR"
echo "Timestamp: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "===================================================================="

cd "$APP_DIR"

# 1. Environment & Pre-Flight Checks
echo "🔍 Checking environment..."
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found in PATH. Please verify Node.js installation."
  exit 1
fi

echo "✅ Node.js: $(node -v)"
echo "✅ NPM: $(npm -v)"

# Ensure PM2 is available (either global or in path)
if ! command -v pm2 &> /dev/null; then
  echo "⚠️ PM2 not found in PATH, checking npm prefix or nvm..."
  if [ -f "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh"
  fi
fi

if ! command -v pm2 &> /dev/null; then
  echo "📦 Installing PM2 locally or globally..."
  npm install -g pm2 || npm install pm2
  export PATH="$PATH:$APP_DIR/node_modules/.bin"
fi

echo "✅ PM2: $(pm2 -v 2>/dev/null || echo 'installed')"

# 2. Check for .env file
if [ ! -f "$APP_DIR/.env" ] && [ ! -f "$APP_DIR/backend/.env" ]; then
  echo "⚠️ WARNING: No .env found in root or backend/. Copying .env.example..."
  if [ -f "$APP_DIR/.env.example" ]; then
    cp "$APP_DIR/.env.example" "$APP_DIR/.env"
    echo "⚠️ Please review $APP_DIR/.env with your production Supabase and SMTP keys."
  fi
fi

# 3. Install Dependencies
echo "📦 Installing Backend dependencies..."
npm --prefix backend install --omit=dev

echo "📦 Installing Frontend dependencies & build tools..."
npm --prefix frontend install

# 4. Build Applications
echo "🔨 Compiling Backend TypeScript..."
npm --prefix backend run build

echo "🔨 Bundling Frontend React SPA with Vite..."
VITE_API_URL="/api" npm --prefix frontend run build

# 5. Verify Frontend Build Artifact
if [ ! -f "$APP_DIR/frontend/dist/index.html" ]; then
  echo "❌ Frontend build failed: index.html not found!"
  exit 1
fi
echo "✅ Frontend build verified ($(find frontend/dist -type f | wc -l) files generated)."

# 6. PM2 Process Lifecycle Management
echo "⚡ Updating PM2 backend process..."
mkdir -p "$APP_DIR/logs"

if pm2 describe attendoschool-backend &> /dev/null; then
  echo "🔄 Reloading existing PM2 cluster without downtime..."
  pm2 reload ecosystem.config.cjs --env production
else
  echo "🚀 Starting new PM2 cluster..."
  pm2 start ecosystem.config.cjs --env production
fi

pm2 save

# 7. Internal Service Verification
echo "🩺 Verifying backend health on internal port..."
sleep 3
HEALTH_RESPONSE=$(curl -sS --max-time 10 http://127.0.0.1:3000/health || echo "FAILED")
echo "Health probe response: $HEALTH_RESPONSE"

if [[ "$HEALTH_RESPONSE" == *"ok"* ]]; then
  echo "✅ Backend successfully responded to health probe."
else
  echo "⚠️ Backend health probe warning. Checking logs..."
  pm2 logs attendoschool-backend --lines 20 --nostream
fi

echo "===================================================================="
echo "🎉 DEPLOYMENT COMPLETE!"
echo "Frontend: https://attendoschool.online"
echo "Backend API: https://attendoschool.online/api"
echo "Health Probe: https://attendoschool.online/health"
echo "===================================================================="

#!/usr/bin/env bash
# ====================================================================
# AttendoSchool - Hostinger VPS Automated Full-Stack Provisioning Script
# Domain: attendoschool.optinetinnovations.in
# OS: Ubuntu / Debian LTS (Hostinger KVM VPS)
# ====================================================================

set -e

echo "===================================================================="
echo "🚀 AttendoSchool - Hostinger VPS Setup Starting"
echo "Target Subdomain: attendoschool.optinetinnovations.in"
echo "===================================================================="

# 1. Update APT Repositories
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential ufw nginx certbot python3-certbot-nginx

# 2. Install Node.js 20 LTS
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'.' -f1 | sed 's/v//') -lt 20 ]]; then
  echo "📦 Installing Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi

echo "✅ Node.js Version: $(node -v)"
echo "✅ NPM Version: $(npm -v)"

# 3. Install PM2 Globally
if ! command -v pm2 &> /dev/null; then
  echo "⚙️ Installing PM2 Process Manager..."
  sudo npm install -g pm2
fi

# 4. Clone or Setup Repository in /var/www/attendoschool
APP_DIR="/var/www/attendoschool"

if [ ! -d "$APP_DIR" ]; then
  echo "📥 Cloning AttendoSchool repository into $APP_DIR..."
  sudo mkdir -p /var/www
  sudo git clone https://github.com/Mrinmoypatratint/attendoschool.git "$APP_DIR"
  sudo chown -R $USER:$USER "$APP_DIR"
else
  echo "🔄 Repository already present in $APP_DIR. Pulling latest main..."
  cd "$APP_DIR"
  git pull origin main
fi

cd "$APP_DIR"

# 5. Install Dependencies & Build
echo "🔨 Installing dependencies and building production assets..."
npm --prefix backend ci
npm --prefix frontend ci
npm run build

# 6. Configure Nginx
echo "🌐 Configuring Nginx reverse proxy..."
sudo cp "$APP_DIR/deploy/hostinger/attendoschool.conf" /etc/nginx/sites-available/attendoschool.conf
sudo ln -sf /etc/nginx/sites-available/attendoschool.conf /etc/nginx/sites-enabled/attendoschool.conf
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl reload nginx

# 7. Configure and Start PM2 Process
echo "⚡ Starting Backend API with PM2 cluster..."
pm2 delete attendoschool-backend 2>/dev/null || true
pm2 start ecosystem.config.cjs --env production
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME || true

# 8. Configure Firewall (UFW)
echo "🛡️ Configuring Firewall (ports 80, 443, 22)..."
sudo ufw allow 22/tcp || true
sudo ufw allow 'Nginx Full' || true
sudo ufw --force enable || true

# 9. Free Let's Encrypt SSL
echo "🔒 Requesting SSL Certificate for attendoschool.optinetinnovations.in..."
echo "Note: Ensure your DNS A-Record for attendoschool.optinetinnovations.in points to this VPS IP first."
sudo certbot --nginx -d attendoschool.optinetinnovations.in --non-interactive --agree-tos --register-unsafely-without-email --redirect || {
  echo "⚠️ SSL setup can be run anytime once DNS propagates using:"
  echo "   sudo certbot --nginx -d attendoschool.optinetinnovations.in"
}

echo "===================================================================="
echo "🎉 DEPLOYMENT READY!"
echo "Frontend: https://attendoschool.optinetinnovations.in"
echo "Backend API: https://attendoschool.optinetinnovations.in/api"
echo "Health Probe: https://attendoschool.optinetinnovations.in/health"
echo "===================================================================="

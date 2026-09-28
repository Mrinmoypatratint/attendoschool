# Hostinger VPS Full-Stack Deployment Guide
### Domain: `https://attendoschool.optinetinnovations.in`

This guide shows you how to host **both the Frontend and Backend** on your **Hostinger VPS** using **Nginx, PM2, Node.js 20, and GitHub Actions CI/CD**.

---

## Architecture Overview

```
                        [ Internet Visitor ]
                                 │
                                 ▼
                     https://attendoschool.optinetinnovations.in
                                 │
                   [ Nginx Reverse Proxy (Port 443/80) ]
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
      Static Assets & SPA                     Backend API (/api/)
   /var/www/attendoschool/frontend/dist        Node.js / PM2 Cluster
   (HTML, JS, CSS, Logos, Caching)             http://127.0.0.1:5000
```

- **Unified Origin**: Both frontend and backend run under `https://attendoschool.optinetinnovations.in`.
- **Zero CORS Issues**: The frontend talks to `/api/` directly on the same domain.
- **Auto CI/CD**: Pushing to `main` on GitHub triggers an automated SSH build and PM2 reload on the VPS.

---

## Step 1: Point Your DNS to the Hostinger VPS IP

1. In your **DNS Management** (where `optinetinnovations.in` is registered, e.g., Hostinger DNS or Cloudflare):
2. Add a new **A-Record**:
   - **Type**: `A`
   - **Name / Subdomain**: `attendoschool`
   - **Points to / Target IP**: `YOUR_HOSTINGER_VPS_IP` *(found in Hostinger hPanel > VPS dashboard)*
   - **TTL**: `300` (or Automatic)

---

## Step 2: One-Line Server Setup on Hostinger VPS

1. Connect to your Hostinger VPS via SSH from your computer terminal:
   ```bash
   ssh root@YOUR_HOSTINGER_VPS_IP
   ```
2. Run the automated AttendoSchool setup script:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/Mrinmoypatratint/attendoschool/main/scripts/hostinger-vps-setup.sh | bash
   ```

### What this script does automatically:
- Installs Node.js 20 LTS, npm, git, PM2, and Nginx.
- Clones `https://github.com/Mrinmoypatratint/attendoschool.git` into `/var/www/attendoschool`.
- Builds the production backend and frontend.
- Configures Nginx for `attendoschool.optinetinnovations.in`.
- Starts the backend using PM2 cluster mode (`pm2 start ecosystem.config.cjs`).
- Configures PM2 to restart automatically if the VPS reboots (`pm2 startup`).
- Issues a free Let's Encrypt SSL certificate via Certbot.

---

## Step 3: Enable Automated GitHub Actions CI/CD

To have every `git push origin main` automatically update the live site on your VPS:

1. Open your repository on GitHub:
   **[https://github.com/Mrinmoypatratint/attendoschool/settings/secrets/actions](https://github.com/Mrinmoypatratint/attendoschool/settings/secrets/actions)**
2. Click **New repository secret** and add:

| Secret Name | Value | Description |
| :--- | :--- | :--- |
| `HOSTINGER_VPS_HOST` | `YOUR_VPS_IP` | Your Hostinger VPS Public IP address |
| `HOSTINGER_VPS_USER` | `root` | VPS SSH username (default `root`) |
| `HOSTINGER_VPS_SSH_KEY` | *(Your private SSH key)* | Recommended SSH Key authentication |
| `HOSTINGER_VPS_PASSWORD` | *(Your VPS root password)* | Alternative if not using SSH keys |
| `HOSTINGER_VPS_PORT` | `22` | SSH port (default 22) |

---

## Step 4: Verify the Deployment

1. **Frontend App**: Open [https://attendoschool.optinetinnovations.in](https://attendoschool.optinetinnovations.in)
2. **Backend Health Check**: Open [https://attendoschool.optinetinnovations.in/health](https://attendoschool.optinetinnovations.in/health) &rarr; returns `{ "status": "ok" }`
3. **Backend API**: Open [https://attendoschool.optinetinnovations.in/api](https://attendoschool.optinetinnovations.in/api)
4. **PM2 Status**: On the VPS, run:
   ```bash
   pm2 status
   pm2 logs attendoschool-backend
   ```

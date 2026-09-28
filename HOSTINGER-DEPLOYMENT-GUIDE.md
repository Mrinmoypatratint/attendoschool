# Hostinger CI/CD Deployment Guide for attendoschool.optinetinnovations.in

This guide walks you through automatically deploying the **AttendoSchool** frontend to your Hostinger subdomain **`attendoschool.optinetinnovations.in`** on every `git push` via **GitHub Actions CI/CD**.

---

## 1. Create the Subdomain in Hostinger hPanel

1. Log in to your [Hostinger hPanel](https://hpanel.hostinger.com/).
2. Select your domain **`optinetinnovations.in`** and click **Manage**.
3. In the left sidebar, navigate to **Domains** &rarr; **Subdomains**.
4. Enter the details:
   - **Subdomain Name**: `attendoschool`
   - **Domain**: `optinetinnovations.in`
   - **Custom folder for subdomain**: check or confirm it points to:
     `public_html/attendoschool`
5. Click **Create**.
6. *(Important)* In hPanel, go to **Security** &rarr; **SSL** and click **Install SSL** for `attendoschool.optinetinnovations.in` (free lifetime Let's Encrypt SSL provided by Hostinger).

---

## 2. Retrieve Your Hostinger FTP Credentials

1. In Hostinger hPanel, go to **Files** &rarr; **FTP Accounts**.
2. Note down your credentials:
   - **FTP IP / Host**: (e.g., `ftp.optinetinnovations.in` or the Hostinger FTP IP like `185.xxx.xxx.xxx`)
   - **FTP Username**: (e.g., `u123456789`)
   - **FTP Password**: (click **Change password** if needed)
   - **FTP Port**: `21`

---

## 3. Add Secrets to Your GitHub Repository

1. Open your GitHub repository in your browser:
   **[https://github.com/Mrinmoypatratint/attendoschool/settings/secrets/actions](https://github.com/Mrinmoypatratint/attendoschool/settings/secrets/actions)**
2. Click the green **New repository secret** button and add these secrets:

| Secret Name | Value | Description |
| :--- | :--- | :--- |
| `HOSTINGER_FTP_SERVER` | `ftp.optinetinnovations.in` *(or Hostinger FTP IP)* | Hostinger FTP hostname |
| `HOSTINGER_FTP_USERNAME` | `u123456789` | Your Hostinger FTP username |
| `HOSTINGER_FTP_PASSWORD` | `your_ftp_password` | Your Hostinger FTP password |
| `HOSTINGER_SERVER_DIR` | `public_html/attendoschool/` | Subdomain folder on Hostinger *(defaults to `public_html/attendoschool/`)* |
| `VITE_API_URL` | `https://attendoschool-backend.onrender.com/api` | Production backend API endpoint |

> **Note on Multi-Domain Accounts**: If `optinetinnovations.in` is an addon domain in Hostinger, your directory might be `domains/optinetinnovations.in/public_html/attendoschool/`. You can verify the exact path in Hostinger **File Manager**.

---

## 4. How the Automated CI/CD Pipeline Works

Whenever you push to `main` (`git push origin main`):
1. **GitHub Actions Workflow** (`.github/workflows/ci-cd.yml`) automatically triggers.
2. It typechecks and compiles both backend and frontend.
3. It bundles the production frontend with:
   - Dynamic API routing configured for `attendoschool.optinetinnovations.in`.
   - Hostinger Apache/LiteSpeed `.htaccess` with client-side SPA routing, HTTPS redirect, asset caching, and security headers.
4. It connects securely over **FTPS** to Hostinger and deploys directly to `public_html/attendoschool/`.

---

## 5. Verify Your Live Subdomain

Once GitHub Actions finishes uploading:
1. Open your subdomain in your browser:
   **[https://attendoschool.optinetinnovations.in](https://attendoschool.optinetinnovations.in)**
2. Navigate between pages (e.g. Dashboard, Attendance, Timetable, Notifications).
3. Refresh any page directly to confirm `.htaccess` SPA routing redirects cleanly to `index.html`.
4. Open Developer Tools (`F12`) &rarr; **Network** tab to verify API calls connect to `https://attendoschool-backend.onrender.com/api`.

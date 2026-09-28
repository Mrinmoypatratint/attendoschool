# Hostinger CI/CD Deployment Guide for AttendoSchool

This guide walks you through automatically deploying the **AttendoSchool** frontend to **Hostinger Web / Cloud Hosting** (`public_html`) on every `git push` via **GitHub Actions CI/CD**.

---

## 1. Retrieve Your Hostinger FTP Credentials

1. Log in to your [Hostinger Account (hPanel)](https://hpanel.hostinger.com/).
2. Select your hosting account or website and click **Manage**.
3. In the sidebar, navigate to **Files** &rarr; **FTP Accounts**.
4. Note down the following details:
   - **FTP IP / Host**: (e.g. `185.xxx.xxx.xxx` or `ftp.yourdomain.com`)
   - **FTP Username**: (e.g. `u123456789`)
   - **FTP Password**: (If you don't remember it, click **Change password**)
   - **FTP Port**: `21` (default)

---

## 2. Add Hostinger Secrets to Your GitHub Repository

1. Open your GitHub repository in your browser:
   `https://github.com/Mrinmoypatratint/attendoschool`
2. Click **Settings** (top tabs).
3. In the left sidebar, click **Secrets and variables** &rarr; **Actions**.
4. Click the green **New repository secret** button and add each of the following:

| Secret Name | Value | Description |
| :--- | :--- | :--- |
| `HOSTINGER_FTP_SERVER` | `ftp.yourdomain.com` *(or your Hostinger FTP IP)* | Hostinger FTP hostname |
| `HOSTINGER_FTP_USERNAME` | `u123456789` | Your Hostinger FTP username |
| `HOSTINGER_FTP_PASSWORD` | `your_ftp_password` | Your Hostinger FTP password |
| `HOSTINGER_SERVER_DIR` *(Optional)* | `public_html/` | Target directory (`public_html/` or `domains/yourdomain.com/public_html/` if you host multiple domains) |
| `VITE_API_URL` *(Optional)* | `https://attendoschool-backend.onrender.com/api` | Your production backend API endpoint |

---

## 3. How the Automated CI/CD Pipeline Works

Whenever you push code to the `main` branch:
1. **GitHub Actions Workflow** (`.github/workflows/ci-cd.yml`) automatically triggers.
2. It typechecks and compiles the **backend** and **frontend**.
3. It builds the production bundle into `frontend/dist/` (including `.htaccess` for Apache/LiteSpeed SPA routing and security).
4. It connects securely over **FTPS** to Hostinger and uploads the built assets to `public_html/`.

---

## 4. SPA Routing on Hostinger (.htaccess)

Hostinger web servers use LiteSpeed/Apache. The build process automatically deploys `frontend/public/.htaccess` to `public_html/.htaccess` with:
- **Client-Side SPA Routing**: Routes like `/login`, `/dashboard`, and hash routes load cleanly without `404 Not Found` errors.
- **HTTPS Enforcement**: Automatically redirects HTTP visitors to secure HTTPS.
- **Asset Caching**: Enables 1-year browser caching for scripts, fonts, and images.
- **Security Headers**: Injects `X-Content-Type-Options`, `X-XSS-Protection`, and `Referrer-Policy`.

---

## 5. Verify Your Live Site

Once the GitHub Action completes:
1. Open your domain in your browser: `https://yourdomain.com`
2. Test navigating between tabs and refreshing the page to verify `.htaccess` routing works smoothly.
3. Check the browser developer console (`F12`) to verify the backend API connects to `https://attendoschool-backend.onrender.com/api`.

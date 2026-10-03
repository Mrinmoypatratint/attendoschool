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

---

## 3. GitHub Configuration

### 3.1 Enable Auto-Merge Permissions
To allow GitHub Actions to automatically compare and merge remote developer branches (e.g., `Indranil`, `sweta-mondal`, `feature/*`) into `main`:
1. Open your GitHub repository:
   **[Settings > Actions > General](https://github.com/Mrinmoypatratint/attendoschool/settings/actions)**
2. Scroll to **Workflow permissions**:
   - Select **Read and write permissions**
   - Check **Allow GitHub Actions to create and approve pull requests**
3. Click **Save**.

### 3.2 Add Secrets to Your GitHub Repository
1. Open your GitHub repository in your browser:
   **[Settings > Secrets and variables > Actions](https://github.com/Mrinmoypatratint/attendoschool/settings/secrets/actions)**
2. Click the green **New repository secret** button and add these secrets:

| Secret Name | Value | Description |
| :--- | :--- | :--- |
| `HOSTINGER_FTP_SERVER` | `ftp.optinetinnovations.in` *(or Hostinger FTP IP)* | Hostinger FTP hostname |
| `HOSTINGER_FTP_USERNAME` | `u123456789` | Your Hostinger FTP username |
| `HOSTINGER_FTP_PASSWORD` | `your_ftp_password` | Your Hostinger FTP password |
| `HOSTINGER_SERVER_DIR` | `public_html/attendoschool` | Subdomain folder on Hostinger *(defaults to `public_html/attendoschool`)* |
| `VITE_API_URL` | `https://attendoschool-backend.onrender.com/api` | Production backend API endpoint |
| `RENDER_DEPLOY_HOOK_URL` | *(Optional Render Deploy Hook URL)* | Automatically triggers backend deployment on Render |

> **Note on Multi-Domain Accounts**: If `optinetinnovations.in` is an addon domain in Hostinger, your directory might be `domains/optinetinnovations.in/public_html/attendoschool/`. You can verify the exact path in Hostinger **File Manager**.

---

## 4. How the Multi-Branch CI/CD Pipeline Works

Whenever any developer pushes to **any** remote branch (e.g. `Indranil`, `sweta-mondal`, `main`):
1. **Continuous Testing & Typecheck**:
   - Backend compile & comprehensive 50-test suite runs.
   - Frontend TypeScript check & Vite production build runs.
2. **Compare & Auto-Merge**:
   - Compares the remote branch against `main`.
   - Simulates merge to check for conflicts without altering code.
   - If clean: commits and pushes to `origin/main`.
   - If conflict exists: aborts safely and logs conflicting files in the GitHub Actions summary.
3. **Automated Frontend Deployment to Hostinger Premium**:
   - Bundles the production frontend with Hostinger `.htaccess` for SPA routing & caching.
   - Securely uploads via **FTPS** to `public_html/attendoschool` on your Hostinger Premium plan.
4. **Backend API Deployment**:
   - Hosted on Render (tracks `main` branch automatically) or triggered via `RENDER_DEPLOY_HOOK_URL`.


---

## 5. Verify Your Live Subdomain

Once GitHub Actions finishes uploading:
1. Open your subdomain in your browser:
   **[https://attendoschool.optinetinnovations.in](https://attendoschool.optinetinnovations.in)**
2. Navigate between pages (e.g. Dashboard, Attendance, Timetable, Notifications).
3. Refresh any page directly to confirm `.htaccess` SPA routing redirects cleanly to `index.html`.
4. Open Developer Tools (`F12`) &rarr; **Network** tab to verify API calls connect to `https://attendoschool-backend.onrender.com/api`.

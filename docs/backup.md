# AttendoSchool backup and emergency recovery

Backups are not enabled just by adding this code. Complete the setup below, take a backup, and test restoring it. The owner has now approved completing setup while deferring age key creation. The private backup repo has been created. Deployment now prepares private server folders, tools, a dedicated worker and a schedule that stays explicitly paused until a public recipient and repo-scoped token are configured. No laptop/USB is needed for running daily jobs; the offline identity is for decrypting/restoring later. No private age key is generated on the server.

## Quick answers

| Situation | Go to |
| --- | --- |
| Set up free daily backups | [One-time setup](#one-time-setup-on-the-current-vps) |
| Save a backup on my laptop | [Admin menu](#admin-menu) |
| Open a downloaded encrypted file | [Restore a downloaded file](#restore-a-file-downloaded-from-the-admin-panel) |
| Server disappeared | [Server gone](#server-gone-without-warning) |
| Deleted the wrong rows | [Accidental deletion](#accidental-deletion-of-some-rows) |
| Passwords or environment lost | [Environment lost](#environment-lost) |
| Backup failed | [Troubleshooting](#failure-messages-and-fixes) |
| Move hosting | [Planned move](#planned-move-to-a-new-server) |

## Rules to keep

Keep three copies: working data, an encrypted GitHub release, and an encrypted laptop/USB copy. Use two different kinds of storage. Keep one copy away from the server. This is the 3-2-1 rule.

Encrypt before uploading. The VPS has only the **public** age recipient. Keep the private identity on your laptop and a USB stick. Do not put it in GitHub, the VPS, CI secrets, an issue, or chat. Losing every copy of that private key means old encrypted backups are lost forever.

Never commit dumps, keys, secrets, `.env` files or encrypted backup archives. A separate private repository stores **Release attachments**, never database commits. Test restores monthly. A green backup button is not proof of a usable restore.

## What the code actually stores

This is a source-code inventory, not a claim about the current production account. Live engine, plan, PostgreSQL major version, storage usage and external services remain **[TO CONFIRM]**. The owner does not yet know whether legacy Firebase contains unique live data.

| Data / evidence | Classification | How it is protected or rebuilt |
| --- | --- | --- |
| PostgreSQL/Supabase tables: `backend/src/db.ts`, `database/schema.sql`, `database/migrations/` | MUST | `pg_dump -Fc` includes database schemas, rows, indexes, sequences, functions and constraints. It does not include cluster-global role definitions/passwords or tablespaces. Recreate roles and compatible extensions on the destination. |
| Students, users/password hashes, schools, attendance, billing, invoices, announcements, audit logs, RBAC configuration | MUST | Included in the full database dump. Never use seed data as a restore. |
| Assignment/announcement files in `attachment_blobs`: `backend/src/utils/firebaseStorage.ts`, `uploadToStorage()` | MUST | PostgreSQL is the primary attachment store when configured. Base64 file bodies are part of the dump. |
| Supabase Storage bucket `assignment-submissions` and any other buckets: `backend/src/utils/supabaseStorage.ts` | MUST if used | Export bucket metadata and file bytes via the Storage API. A database dump alone does not recover those bytes. The exporter walks folders and paginates listings. |
| Legacy Firestore: `backend/src/firebase.ts`, `services/firestoreService.ts`, `services/firestoreSync.ts`, routes using `collections` | MUST if unique data exists | **Not silently covered by a PostgreSQL dump.** This backup refuses Firebase/dual-driver settings and requires explicit confirmation if Firebase credentials are present. The existing `exportFullBackup.ts` is a legacy JSON export, not a tested complete Firestore disaster-recovery solution; it can miss subcollections/types. Verify/migrate those stores before enabling this system. |
| Legacy Firebase Storage: `backend/src/utils/firebaseStorage.ts` | MUST if used | Configured buckets cause an explicit failure. Export/migrate them separately first. Do not set an exclusion merely to make a warning disappear. |
| Local uploads, if added/configured | MUST | Set `BACKUP_UPLOAD_DIR` to one dedicated uploads folder. Do not point it at the checkout, database volume, logs or backups. No active app route currently writes ordinary uploads to a local directory. |
| Runtime application secrets; SMTP settings written back to `.env`: `backend/src/config/env.ts`, `services/notificationService.ts` | MUST | Reconstruct `config.tar/runtime.env` from the worker environment, only in encrypted backups. Template keys plus an application-key allowlist are included. Backup token/config and container variables are excluded. |
| PM2 / Compose / nginx config: `ecosystem.config.cjs`, `docker-compose*.yml`, `deploy/nginx/nginx.conf` | MUST for quick recovery | Known config files are allowlisted in `config.tar`. Also available in the code repo. External nginx/PM2/system configs, cron and TLS files are **not** discovered by this archive; save their nonsecret settings separately and renew certificates. |
| Redis cache: `backend/src/utils/cache.ts` | Rebuild | Empty cache repopulates from PostgreSQL. No Redis dump needed. |
| Redis/in-memory notification queue: `backend/src/services/queueService.ts` | Disposable queue, with a limitation | Do not back it up as the database. In-flight email/SMS jobs may be lost; inspect persistent notification records and resend carefully to avoid duplicates. |
| In-memory fallback leaves, demo data, settings: `backend/src/store/leavesStore.ts`, route fallbacks | Not reliably recoverable | Memory disappears on restart and cannot be recovered with `pg_dump`. Ensure live features persist real records. Do not operate production using a fallback store. |
| `backups/` and the new queue/status/audit files | Operational state | Local newest three copies plus external encrypted releases. Queue status is outside the backed-up DB. Keep `audit.jsonl` for investigation. Backups never recursively include themselves. |
| PM2/backend logs, old JSON exports from `src/scripts/backup_postgresql.ts` / `exportFullBackup.ts` | Usually not required for restore | Logs help investigations; old exports contain sensitive plaintext. Retire legacy export schedules only after the new restore drill passes. Never automatically delete them without review. |
| Search | Rebuild | No separate search index service was found. Searches use app/database queries. Database indexes are restored from the dump. |
| Browser localStorage / offline attendance: `frontend/src/services/offlineAttendanceQueue.ts` | MUST sync outstanding work | Unsynced attendance exists only on that device. Connect and sync before a planned move; a server backup cannot capture offline devices. JWT session tokens do not need backup. |
| Code, build outputs, dependencies, assets | Rebuild | Clone the approved code commit; `npm ci` and build. `node_modules`, `dist`, logs and `.git` never enter the backup. |
| GitHub, Hostinger, Supabase, payment, email and domain accounts / DNS | MUST retain access separately | Keep recovery codes and registrar details offline. Application archives cannot recover lost account ownership. |

Production deployment evidence: `.github/workflows/deploy.yml` uses SSH to `/home/attendoschool/htdocs/attendoschool.online` and reloads PM2. This is **Variant A: cron on a VPS**, even when its database is hosted by Supabase. Compose files are an alternative, not proof production uses Docker. GitHub username: `Mrinmoypatratint`, from `origin`.

### Secrets inventory (names only; no real values)

No database-column encryption key was found (`createCipher` / `createDecipher` are not used for application data). Thus no app encryption key is presently known to make database columns permanently unreadable. The **age private backup identity** has that irreversible property for backups.

| Secret names / source | If lost | Recovery |
| --- | --- | --- |
| age private identity (laptop/USB only) | Cannot decrypt existing backups | Recover another offline copy. Otherwise old encrypted archives are unrecoverable; create a new pair for future backups. |
| `DATABASE_URL`, `SUPABASE_DATABASE_URL`, `DB_PASSWORD`, `PGPASSWORD`; backup-only `BACKUP_DATABASE_URL` | Database cannot connect | Reset the database role password through the provider/local administrator; update app and backup connection settings. Database data remains. |
| `JWT_SECRET` (`config/env.ts`) | Existing sessions become invalid | Generate a strong replacement (at least 32 characters); everyone signs in again. Password hashes remain in the database. |
| `SUPABASE_SERVICE_ROLE_KEY` | Remote file exports/uploads and privileged APIs fail | Retrieve/rotate in Supabase. Never expose it as a `VITE_` variable. Restore storage bytes separately. |
| `FIREBASE_PRIVATE_KEY`, `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_SERVICE_ACCOUNT_KEY`, credential files named by `FIREBASE_SERVICE_ACCOUNT_PATH` / `GOOGLE_APPLICATION_CREDENTIALS` | Legacy Firestore/storage access fails | Issue a new service account credential after confirming ownership. Files outside runtime env are not automatically archived. Keep account recovery access separately. |
| `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Payments/signature verification fail | Rotate at Razorpay; update webhook endpoint configuration too. `RAZORPAY_KEY_ID` / `VITE_RAZORPAY_KEY_ID` are public identifiers. |
| `SMTP_PASS` (actual app setting), `SMTP_PASSWORD` (older production template alias), `SMTP_USER` | Email delivery fails | Create a new mail app password; configure **SMTP_PASS**, which the app reads. An old alias alone does not configure email. |
| `BREVO_API_KEY`, `SENDINBLUE_API_KEY`, `RESEND_API_KEY` | Email APIs fail | Rotate in the corresponding provider. |
| `GMAIL_RELAY_URL`, `GOOGLE_SCRIPT_URL` | May stop email or disclose a relay endpoint | Redeploy/rotate the Apps Script relay, then update configuration. Treat URL tokens as secrets. |
| `SMS_API_KEY`, `SMS_PROVIDER_API_KEY`, `WHATSAPP_API_KEY` | Messaging fails | Rotate through the configured provider. Provider URLs containing credentials also require rotation. |
| `REDIS_PASSWORD`, credentials inside `REDIS_URL`, `REDIS_QUEUE_URL`, `REDIS_CACHE_URL` | Cache/queue access fails | Rotate and reconnect. Cache can rebuild; check lost pending notifications. |
| `BACKUP_GH_TOKEN` / dedicated `GH_TOKEN` | Release uploads/retention fail | Renew a fine-grained token limited to the separate backup repo. Never include it in the archive. |
| `BACKUP_HEARTBEAT_URL` | Heartbeat may be forged or fail | Reset the monitor push URL. It is excluded with backup settings. |
| CI `HOSTINGER_VPS_SSH_KEY`, VPS host/user/port; GitHub/registrar recovery codes | Deployment/account access fails | Restore offline account recovery access; replace SSH keys. These are outside app env and not automatically included. |

Other template values (host/port/database/user, project/bucket IDs, public URLs, company details, sender names, tax rates, feature flags, pool and rate-limit settings) are configuration, not decryption keys. All keys in every env example are considered by the runtime allowlist, except `BACKUP_*`, `GH_TOKEN`, `GITHUB_TOKEN`. Extra supported provider/Redis/Firebase/PG variables are also allowlisted. Tests check the production template explicitly. Arbitrary process variables are not copied.

## What each method covers

| Method | Coverage / frequency | Maximum data loss | Incremental cost / setup |
| --- | --- | --- | --- |
| Manual admin export to laptop | Database, bounded uploads, config; secrets only if age enabled | Since last manual export | ₹0, existing server/disk/browser; enable owner menu and worker |
| Nightly cron → age → private GitHub Release | Same archive, plus configurable off-server retention | Normally under 24 hours **only while every nightly run succeeds** | No added backup service; uses existing VPS resources and private Releases |
| Latest three local backups | Same archive; daily/manual share one queue | Since latest successful job; server loss destroys these copies | Existing server disk; not an off-server backup |
| USB / second laptop copy | Copy `.age` release assets, keep parts together | Since last copy | ₹0 with hardware you already own; no purchase required |
| Provider backups | Provider/plan dependent | **[TO CONFIRM]** | Do not assume a paid plan or include it in the ₹0 design |
| PITR/WAL | Can recover between daily dumps if independently configured | Depends on continuous WAL coverage | **Not enabled.** Supabase PITR is a paid add-on. WAL-G itself is free but free storage quotas, retention and provider charges need confirmation. No paid feature is proposed or provisioned. |

Recommended today: verified PostgreSQL-only configuration, nightly encrypted releases, local copies, a free heartbeat alert, weekly laptop/USB copies, and monthly restore drills. Later: measure growth and recovery time; reconsider upload size and PITR only after checking free capacity and obtaining owner approval for any paid service.

## One-time setup on the current VPS

These commands are instructions for the owner. Running them changes the VPS/accounts and requires the owner's approval first. Nothing here was executed on production during development.

1. **Confirm stores and versions.** Check which database the live app uses, whether any unique documents remain in Firestore/Firebase Storage, whether Supabase Storage has objects, and whether local uploads exist. Run `SHOW server_version;` through the provider's SQL console. Set `DB_DRIVER=postgres`, disable dual sync only if accurate. Never guess or disable a live store just to pass preflight. If Firebase still holds unique data, stop and export/migrate it with a separate verified runbook.
2. **Create a key on your laptop/WSL**, never on the VPS:

   ```bash
   umask 077
   mkdir -p ~/.config/attendoschool
   age-keygen -o ~/.config/attendoschool/backup.agekey
   age-keygen -y ~/.config/attendoschool/backup.agekey
   ```

   Copy only the printed `age1...` public recipient to the server. Copy the private file to an existing USB stick and protect both devices. This key is generated by you, not committed or sent here.
3. **Separate PRIVATE repository:** [Mrinmoypatratint/attendoschool-private-backups](https://github.com/Mrinmoypatratint/attendoschool-private-backups) has been created with a README. Keep it private. Do not use `Mrinmoypatratint/attendoschool` for dumps.
4. **Create a fine-grained GitHub token.** Select only the new backup repo, with Contents read/write and the necessary metadata read permission. Set an expiry and a calendar reminder before it expires. The private repo must contain an initial README commit so releases have a target commit. Keep the token out of the code repo's history and app archives.
5. **Install tools after approving the VPS change.** Need Node 22+, Bash, GNU tar, `flock`/util-linux, `age`, `gh`, `psql`, `pg_dump`, `pg_restore`. Use the **same major** PostgreSQL client as the server. The Docker worker defaults to the official PostgreSQL 16 image because the supplied Compose database is 16; change `BACKUP_PG_MAJOR` if the real hosted server differs. Debian bookworm packages for age and gh were checked. For PM2, use your OS/PostgreSQL package instructions; do not blindly install a different major.
6. **Create the private backup config**, as the same Unix user that runs the backend:

   ```bash
   install -d -m 700 /home/attendoschool/.config
   touch /home/attendoschool/.config/attendoschool-backup.env
   chmod 600 /home/attendoschool/.config/attendoschool-backup.env
   nano /home/attendoschool/.config/attendoschool-backup.env
   ```

   Fill it with trusted Bash assignments. Quote values containing shell characters. Never paste this file into chat:

   ```bash
   BACKUP_DIR=/home/attendoschool/backups/private
   BACKUP_AGE_RECIPIENT='age1_REPLACE_WITH_YOUR_PUBLIC_RECIPIENT'
   BACKUP_GITHUB_REPO='Mrinmoypatratint/attendoschool-private-backups'
   BACKUP_GH_TOKEN='REPLACE_WITH_BACKUP_REPO_ONLY_TOKEN'
   # Direct DB or Supabase SESSION-mode URL, never transaction pooler port 6543.
   BACKUP_DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require'
   DB_DRIVER=postgres
   ENABLE_DUAL_DB_SYNC=false
   SECONDARY_DB=none
   BACKUP_RETENTION_DAYS=14
   BACKUP_MONTHLY_KEEP=12
   BACKUP_LOCAL_KEEP=3
   BACKUP_UPLOAD_MAX_BYTES=1500000000
   BACKUP_SPLIT_BYTES=1900000000
   # Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY if remote Storage is used.
   # Set BACKUP_STORAGE_DISABLED=true ONLY if there are no remote files to export.
   # Set BACKUP_FIREBASE_CONFIRMED_UNUSED=true ONLY after checking legacy data.
   # BACKUP_UPLOAD_DIR=/dedicated/local/uploads
   # BACKUP_HEARTBEAT_URL='your-private-free-monitor-push-url'
   ```

   The worker loads app settings from `backend/.env`, then the root `.env`, without overriding settings already supplied by this config. Its environment must represent the same app as the web process. These are runtime app settings, not a copy of the backup config. The backup token and heartbeat are deliberately excluded from archives.
7. **Configure the backend** with the same absolute `BACKUP_DIR` and public `BACKUP_AGE_RECIPIENT`. The web process must be able to read/write that directory. Keep them server-side, never in `VITE_` variables. Set both values in `backend/.env` or the PM2 environment; the daily config alone does not configure the web process. Build the app and reload only after approval.
8. **Start the dedicated worker**, after deployment approval:

   ```bash
   cd /home/attendoschool/htdocs/attendoschool.online
   pm2 start ecosystem.config.cjs --only attendoschool-backups
   pm2 save
   pm2 logs attendoschool-backups --lines 30
   ```

   The process definition points at the config path above. Run one worker per backup directory. It uses its own filesystem queue, an OS `flock`, one job process at a time, and a separate process group for dump tools. It does not use the notifications queue or consume its worker capacity. PM2 web workers share the same disk/PID namespace. Do not place this queue on NFS or use it across servers.
9. **Run once manually** and wait for success:

   ```bash
   BACKUP_CONFIG_FILE=/home/attendoschool/.config/attendoschool-backup.env \
     bash scripts/backup.sh
   ```

   Verify the release exists in the private backup repository and contains only `.age` or `.age.part-00000` attachments. The script refuses a public repo or the application code repo. Same-minute tag collisions fail rather than overwrite; retry in the next UTC minute. An interrupted upload remains a draft; inspect/delete that draft after confirming a good replacement.
10. **Schedule daily**, using `crontab -e` for that user:

    ```cron
    17 2 * * * BACKUP_CONFIG_FILE=/home/attendoschool/.config/attendoschool-backup.env /bin/bash /home/attendoschool/htdocs/attendoschool.online/scripts/backup.sh >> /home/attendoschool/backup-cron.log 2>&1
    ```

    This is 02:17 in the VPS cron timezone; check `date` first. Release tags and logs use UTC. Make the log owner-only and rotate it. The worker must stay running. Cron waits for that worker's success. A missing worker eventually fails the queued record instead of pretending a backup exists.
11. **Add a missed-run alert.** Use an existing self-hosted Uptime Kuma push monitor or a confirmed free healthchecks.io check. Set its period/grace longer than 24 hours plus expected job duration. Put its private ping URL in `BACKUP_HEARTBEAT_URL`. Success pings only after publishing and retention. No success ping means the external monitor alerts. Test the monitor's missed-run alert; a heartbeat configuration is not proof notifications work. Local manual backups do not satisfy the nightly heartbeat.
12. **Test the menu and both restore paths.** Sign in as platform Super Admin. Take and download a backup, then run the downloaded-file restore below. Separately restore a nightly release with `restore.sh`. Check rows and an actual attachment in side databases/directories. Record the date and measured restore time.

### Docker alternative (not the current PM2 deployment)

Compose mounts `backup_data` at `/app/backups/private` in both backend and worker. Set `BACKUP_DIR` to that exact path in `.env.production`. Both run as UID 1000. The worker shares the backend PID namespace so vanished-job checks refer to the same processes. Never expose this volume through nginx.

Before first start, after owner approval:

```bash
docker compose -f docker-compose.production.yml build backend backup-worker
docker compose -f docker-compose.production.yml run --rm --user 0 --entrypoint sh backup-worker \
  -c 'mkdir -p /app/backups/private && chown 1000:1000 /app/backups/private && chmod 700 /app/backups/private'
docker compose -f docker-compose.production.yml up -d backend backup-worker
```

This fixes only the backup directory ownership; it does not change database data. No sudo password is passed. To queue a daily export from host cron in this variant, run `docker compose -f docker-compose.production.yml exec -T backup-worker node /app/scripts/backup/runner.cjs daily` from the checkout directory. The container already has its env from Compose; the Bash config-file wrapper is for the PM2/host variant. Local host uploads need a matching read-only bind mount in the worker if you use `BACKUP_UPLOAD_DIR`.

The root `.dockerignore` keeps live env files, credential JSON, keys, backups and dependency folders out of the build context. Backend Docker build context is now the repo root, with `dockerfile: backend/Dockerfile`, so it can load shared backup code.

## Admin menu

Only **SUPER_ADMIN** sees the top-navbar Backups button and can list, queue or download backups. School administrators with every other permission still get HTTP 403. Existing `/api/backups` and `/api/backups-v21` mounts use the same real routes. A second request while reserved/running gets 409.

“Take backup now” returns 202 and queues work; the page polls job status. It does not dump in the HTTP request. A completion message includes a Download action. “Download latest backup” picks the most recent ready job; “All backups…” opens a dialog showing time, actor, size, encryption, status, warnings, errors and downloads. The existing backup pages use the same real records; there are no example successes, fabricated checksums or made-up uptime/RPO claims.

The API streams the finished private file with `Cache-Control: no-store` and attachment disposition, after validating its ID, filename, size and SHA-256. Downloads and backup lifecycle events record actor/time/ID/size in an owner-only `audit.jsonl`. Request/download events also use the existing platform audit helper; the worker mirrors completion into `audit_logs`. If that mirror is unavailable, the durable file remains. Download events mean a transfer was authorized/started, not that the browser saved every byte.

The browser currently uses a Blob save for compatibility, so very large downloads can exceed browser memory. Use the encrypted Release/CLI restore path for large files. The API and all database/archive/encryption processes stream to files; no database dump is held in Node memory.

Encryption OFF still permits an offline manual backup but excludes runtime secrets, and the UI warns. The database may itself contain personal information and stored provider settings: **unencrypted does not mean safe to share**. Daily upload refuses encryption OFF. Keep unencrypted files private/offline.

Status files are atomic JSON outside the DB. Download IDs follow `attendoschool-backup-YYYYMMDD-HHMMSS-8hex`; filenames must match exactly. Missing, modified, unfinished and symlink files are rejected. Dead jobs become failed. Unclaimed records older than four hours fail. Expired live jobs become failed but retain their reservation until the worker stops, preventing overlapping dumps; the worker normally kills its job process group after three hours. A separate OS lock serializes reservation, claim, recovery and release across PM2 web processes. Recipient fingerprints check that web and worker use the same public key. A single-host private directory and one OS-locked worker are required.

### Settings and archive contents

| Setting | Default / purpose |
| --- | --- |
| `BACKUP_DIR` | Checkout `backups/private` if unset; use an explicit shared absolute path |
| `BACKUP_AGE_RECIPIENT` | Empty means manual offline files without runtime secrets; daily upload requires it |
| `BACKUP_DATABASE_URL` | Dedicated direct/session connection; otherwise app URL or `DB_*` settings |
| `BACKUP_GITHUB_REPO`, `BACKUP_GH_TOKEN` | Separate private release repo and scoped token |
| `BACKUP_RETENTION_DAYS` / `BACKUP_MONTHLY_KEEP` | 14 days, plus every backup from day 1 of months in the latest 12-month calendar window; unrelated tags and the just-created tag are never removed |
| `BACKUP_LOCAL_KEEP` / `BACKUP_FAILED_DAYS` | Newest 3 ready local archives; remove failed records older than 7 days |
| `BACKUP_UPLOAD_MAX_BYTES` | 1,500,000,000 bytes for local + remote file bodies; exceeding it skips the uploads archive with a clear warning |
| `BACKUP_UPLOAD_DIR` | Optional dedicated local uploads directory; symlinks/special files are refused |
| `BACKUP_STORAGE_DISABLED` | false; true only if remote Supabase files are intentionally excluded/absent |
| `BACKUP_FIREBASE_CONFIRMED_UNUSED` | false; explicit attestation after investigating Firebase credentials/data |
| `BACKUP_SPLIT_BYTES` | 1,900,000,000 bytes, never above this limit; split encrypted data only; at most 1,000 assets |
| `BACKUP_MIN_FREE_BYTES` | At least 1 GiB, also requires estimated `3 × database size + 2 × upload limit` free |
| `BACKUP_STALE_SECONDS` | 14,400 seconds; queued-job expiry / stale lock checks |
| `BACKUP_HEARTBEAT_URL` | Optional private success heartbeat; never archived |
| `BACKUP_PG_MAJOR` | Docker worker build argument, default 16; must match the live server |
| `BACKUP_CONFIG_FILE` | Host entrypoint path to a trusted Bash file, required mode 600, never a symlink |

The outer archive contains `database.dump`, `config.tar`, optional `uploads.tar`, `README.txt`, `coverage.json`, and `SHA256SUMS`. Checksums cover every payload file other than the checksum list itself. `coverage.json` records exclusions; inspect it before assuming files are present. Each PostgreSQL custom dump starts `PGDMP` and must pass `pg_restore --list`. Upload exports are not atomic with the DB snapshot. Pause writes for a strict migration snapshot. If uploads exceed 1.5 GB, do not claim full protection: keep a separate object-storage copy, review free space/quota, or increase the limit only when capacity supports it. No paid storage is enabled.

## Basic restore (does not touch any database)

On Linux/WSL with age, gh, GNU tar, Node 22+ and compatible PostgreSQL tools:

```bash
umask 077
mkdir -p ~/attendoschool-recovery
cd ~/attendoschool-recovery
# Export a read-capable token for your private backup repo locally; do not paste it here.
bash /PATH/TO/CODE/scripts/restore.sh \
  Mrinmoypatratint/attendoschool-private-backups \
  ~/.config/attendoschool/backup.agekey
```

It downloads the latest published release, joins numerically ordered parts, decrypts to a new mode-700 directory, rejects unsafe/duplicate/link archive members, verifies all checksums, and prints next commands. A failure removes that new recovery directory. It never connects to PostgreSQL or starts the app. Keep decrypted files on an encrypted laptop disk and remove them after your drill.

To choose a date, list releases with `gh release list --repo Mrinmoypatratint/attendoschool-private-backups`, then supply the exact tag as the last argument, for example `backup-2026-11-08-0217`. This is an example tag; verify that your release exists. All tag timestamps are UTC.

### Load and verify a SIDE database

After the script prints its extracted path, use a new database name, never the live one:

```bash
cd /PRINTED/PATH/extracted
pg_restore --list database.dump
createdb attendoschool_restore
pg_restore --exit-on-error --no-owner --no-privileges -d attendoschool_restore database.dump
psql -d attendoschool_restore -c 'SELECT count(*) FROM students;'
mkdir -m 700 restored-config restored-files
tar -xf config.tar -C restored-config
test ! -f uploads.tar || tar -xf uploads.tar -C restored-files
```

Specify the destination with your local `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`/`PGPASSWORD` environment as needed; do not put passwords in command arguments. Use a compatible PostgreSQL server and installed extensions. A full hosted Supabase dump can contain provider-managed schemas/roles unavailable in plain PostgreSQL; use a compatible Supabase staging target or review a `pg_restore --list` selection before restoring app schemas. The local real drill tests an ordinary PostgreSQL fixture, not your hosted project's extensions or RLS. Hosted restore compatibility is **[TO CONFIRM]** before relying on this system.

Recreate buckets and their policies in a compatible target using `restored-files/remote/buckets.json`. Upload each file under `remote/objects/BUCKET/KEY` through that target's Storage API, preserving bucket and key; do not copy files into database directories. Supabase DB metadata and stored file bytes must agree; verify a real assignment can download. Local files under `restored-files/local/` go into the configured uploads directory, after review. The restore helper intentionally does not make account/storage changes for you.

`restored-config/runtime.env` uses JSON-encoded values to preserve multiline keys, quotes and backslashes. It is **not** a shell script or a drop-in dotenv file. To start a reviewed copy of the app with these exact values, from the code checkout:

```bash
node scripts/backup/load-env.cjs /RECOVERY/restored-config/runtime.env \
  pm2 start ecosystem.config.cjs --env production
```

First update its database/storage destinations to the side environment if this is a drill. Do not accidentally start an app against the recovered production URL. For a permanent `.env`, transfer the reviewed values into the provider/PM2 environment or backend env file, taking care with multiline credentials. The loader passes values through environment, never command arguments. Backup settings/token were excluded and must be configured again. Build code/dependencies before starting it.

## Emergency runbooks

Every destructive recovery step needs an owner review. Preserve current data and logs first. Never restore over the live database to recover a few rows.

### Planned move to a new server

**When:** changing hosting. **Data loss:** none only if writes/offline sync are paused and the final snapshot covers everything.
1. Keep the old server available. Build the approved code commit on the new server.
2. Sync offline devices. Pause writes, take a final encrypted backup, download it, inspect coverage.
3. Restore into a new compatible DB and separate file storage; restore reviewed configuration.
4. Check sign-in, schools, recent attendance, invoices, an attachment, email and payments in safe test mode.
5. Switch traffic/DNS only after owner approval. Keep the previous DB/host intact until the new system is verified. Then enable worker/cron/heartbeat on the new server.

### Server gone without warning

**When:** VPS lost. **Data loss:** since the latest successful off-server backup, potentially more if alerts were ignored.
1. Use offline account recovery details and the laptop/USB key.
2. Restore the latest published private release on a fresh server, into a new DB/files location.
3. Rebuild code, install compatible tools, recover config, rotate exposed credentials if loss could involve compromise.
4. Verify data, then approve DNS/traffic changes. Recreate cron and test a new backup plus alert.

### Accidental deletion of some rows

**When:** a few records were deleted. **Data loss:** only deleted records should be recovered; preserve newer legitimate records.
1. Stop the action causing deletion and make an encrypted copy of the current state.
2. Restore the backup from just before deletion into a SIDE database.
3. Identify exact rows, related foreign keys and tenants. Export only those rows; review SQL and conflicts.
4. Apply the reviewed inserts in a transaction to production only after approval. Do not overwrite the whole database. Audit which school/records were restored.

### Bad deploy or migration

**When:** a deployment broke the app. **Data loss:** none for a code-only rollback; a full DB rollback loses changes after the snapshot.
1. Record current commit/schema and back up the current DB before changing anything.
2. Prefer reverting code when schema remains compatible.
3. For destructive schema changes, test restore into a side DB, reconcile newer writes, then plan a reviewed migration/cutover. Do not apply an old dump over a running app.

### Database will not start or is corrupted

**When:** storage/database failure. **Data loss:** since last usable snapshot or provider PITR point.
1. Stop app writes. Preserve the damaged volume/files and logs; do not delete PostgreSQL WAL or data files.
2. Check provider status, disk space and service logs. Do not run improvised repair commands.
3. Restore a validated backup into a new cluster/host with compatible extensions, verify counts and files, then switch the app after approval.

### Disk full

**When:** writes/backups fail for space. **Data loss:** none if files are preserved; the next backup cannot succeed until space is available.
1. Check `df -h`, database/provider quota and backup directory usage.
2. After verifying off-server good copies, remove selected old completed local backups and rotate logs/build caches. Keep IDs/status together. Worker retention handles new-format backups; it never sweeps arbitrary directories.
3. Never delete `postgres_data`, `pg_wal`, database tables, the latest good off-server backup, key files or unsynced uploads. Retry and test heartbeat.

### Server hacked

**When:** compromise suspected. **Data loss:** since a trusted pre-incident snapshot; later writes require careful review.
1. Isolate the host and preserve evidence. Do not trust its binaries or its newest backups.
2. Recover on a fresh server from a backup dated before the compromise. Use the offline identity only on a trusted laptop.
3. Rotate database credentials, JWT, storage/service accounts, payment/webhook keys, messaging/email keys, GitHub token and SSH credentials. Review provider access and DNS.
4. Reapply legitimate later changes selectively. Follow the applicable breach notification process. Encryption protects stored backup content; it cannot make a compromised live server trustworthy.

### Uploaded files lost

**When:** attachments missing. **Data loss:** since last backup containing upload bytes, not merely metadata.
1. Inspect `coverage.json`. If PostgreSQL `attachment_blobs` was primary, restore/copy the relevant blob rows from a side DB.
2. For external files, extract `uploads.tar` into a private staging folder and restore only the needed keys through the correct storage API/local folder.
3. Verify permissions/policies and open a real attachment. If uploads were skipped for size or legacy Firebase was never exported, this archive cannot recover them.

### Search/cache lost

**When:** Redis or search results are empty. **Data loss:** cache none; pending notification jobs may be lost.
1. Confirm PostgreSQL is intact. Restart/reconnect cache; normal app queries repopulate it.
2. Restore database indexes with the database if needed; no separate index service was found.
3. Review pending communications before resending. Do not blindly replay payments/messages.

### Environment lost

**When:** `.env`/PM2 settings missing. **Data loss:** no DB data is erased by losing config.
1. Decrypt an **encrypted** backup and extract `config.tar`.
2. Review `runtime.env`; restore application values using `load-env.cjs` or the deployment environment. Offline backups made with encryption off contain no env secrets.
3. Regenerate missing credentials using the secrets table, restore backup-only settings separately, then build/start the reviewed app. JWT rotation logs users out.

### Backup key lost

**When:** laptop identity missing. **Data loss:** all archives for which no matching private identity remains.
1. Recover your protected USB/laptop copy; the server's public recipient cannot decrypt anything.
2. If no private copy exists, do not claim old backups are recoverable. Create a new pair and immediately take/test a new backup while live data still exists.
3. Keep old archives only if a key might be recovered; never upload private identities to “fix” this.

### Nightly backup failing

**When:** missed-run alert or failed job. **Data loss:** the recovery gap grows until a new backup succeeds.
1. Read `backup-cron.log`, `pm2 logs attendoschool-backups`, and the job's error in All backups.
2. Use the fixes table below; check token expiry, private repo access, disk, DB tool major, worker, same-minute tags and connectivity.
3. Run manually, restore-test the result, and confirm the heartbeat resumes. A webhook failure after successful publication still needs an alert configuration fix.

### Restore a specific date

**When:** investigating a historical state. **Data loss:** none while using a side DB; a full cutover would lose subsequent changes.
1. List the private repo's releases; choose the exact UTC tag.
2. Pass it as the last argument to `restore.sh`.
3. Restore to a side DB, verify the desired records and inspect monthly retention gaps. Daily copies older than 14 days are not guaranteed except day-1 monthly copies.

### Restore a copy on my laptop

**When:** practicing or investigating. **Data loss:** none to production.
1. Use Linux/WSL with a compatible local PostgreSQL and no live application `.env` loaded.
2. Download/decrypt with the key on your laptop; use a new local database and separate file directories.
3. Override restored DB/storage/provider settings before launching any app, disable outbound communications/payments, and keep decrypted student information private. Remove the test DB/files when finished.

### Restore a file downloaded from the admin panel

**When:** using a manual laptop copy. **Data loss:** since that backup's timestamp if used for a full replacement.
1. For an encrypted file:

   ```bash
   bash /PATH/TO/CODE/scripts/restore.sh --file \
     ~/Downloads/attendoschool-backup-YYYYMMDD-HHMMSS-8hex.tar.age \
     ~/.config/attendoschool/backup.agekey
   ```

2. Then follow the side-database steps. For a plaintext `.tar`, extract only a trusted file in a new private directory, inspect its member names first, and run `sha256sum -c SHA256SUMS`; it has no runtime secrets. Prefer encryption for all future backups. Never pipe unknown archives directly into your home/root directory.
3. A quick trusted-file view is `age -d -i KEY FILE | tar tf -`. The menu's short `age -d -i key FILE | tar xf -` command extracts into your current directory; create a private empty directory first. The supplied restore helper is safer because it validates archive members and checksums.

### DNS/registrar lost

**When:** domain/account unavailable. **Data loss:** DB backups do not recover registrar ownership.
1. Use registrar recovery email/codes and ownership evidence stored offline.
2. Keep the server/database intact while recovering the account. Recreate reviewed DNS records and TLS only after approval.
3. If ownership cannot be recovered, choose a replacement domain after approval and update app URLs, CORS, email/payment webhooks and user communications.

### Customer deletion requests and old backups

**When:** a data erasure request or retention deadline applies. **Data loss:** intentional removal, subject to applicable lawful retention.
1. Identify the relevant tenant/person and remove live data plus external files under an approved process. Keep a minimal deletion ledger outside restored application data so deleted people do not silently reappear.
2. Document backup expiry and restrict backups to disaster recovery. On a restore, replay the deletion ledger before reopening access. If law requires removing individual backup copies earlier, review affected releases and replacement backups; do not assume encryption by itself meets erasure duties.
3. Review the currently applicable provisions and commencement dates of India's DPDP Act/Rules, contracts and other record-retention duties with a qualified adviser. This code does not set a universal legal retention period. See the [official MeitY rules publication](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digital-Personal-Data-Protection-Rules-2025). Check cross-border storage obligations before placing student backups on GitHub. **[TO CONFIRM]** applicability, effective dates and your lawful retention policy.

## Failure messages and fixes

| Message / symptom | Fix |
| --- | --- |
| Super Admin access required / HTTP 403 | Use platform SUPER_ADMIN. School-level permissions cannot override this restriction. |
| Already queued/running / HTTP 409 | Wait or inspect All backups and worker logs. Do not start another dump manually into the same folder. |
| Worker did not pick up job | Start the dedicated worker with the same directory/env; expired queued jobs fail after the configured limit. |
| Job disappeared / exceeded time limit | Inspect/stop the dedicated worker first; verify no child dump/encryption tools are alive, then restart. Never delete a live reservation to force overlap. |
| Backup lock owner cannot be verified / invalid status | Keep the files for investigation. Check permissions and shared PID namespace; do not trust/edit a filename to download another path. |
| Required tool unavailable | Install/locate Node, GNU tar, age, gh and matching-major PostgreSQL clients in cron/worker PATH. |
| pg_dump major mismatch | Install the server's major. `SHOW server_version_num` and `pg_dump --version` must agree. |
| Direct/session URL required | Use direct PostgreSQL or Supabase session mode (commonly 5432), not transaction pooler port 6543. IPv4/direct endpoint availability is provider dependent. |
| Dump invalid / pg_restore failed | Check DB permissions, connectivity, tool major, free space. A failed validation never becomes ready. |
| Free disk space insufficient | Free reviewed logs/old local copies or move the backup folder to existing sufficient disk. Do not delete DB data/WAL. |
| Storage export HTTP error | Check service-role key, project URL, network and bucket access. Do not disable export if real files exist. |
| Uploads skipped above limit | Keep an independent file copy. Review free capacity before increasing the limit. Inspect coverage; database success is not full file coverage. |
| Firebase/legacy configuration detected | Investigate unique data and export/migrate it; do not falsely attest it is unused. |
| GitHub private repo/token failure; gh failed | Confirm exact separate private repo, README commit, token Contents rights, repository selection and expiry. Renew an expired token and retry next minute. |
| Release tag already exists | Retry in the next UTC minute. Never overwrite a prior good release. Check any interrupted draft. |
| Config must be chmod 600 | Correct mode, real file (no symlink), same server user. |
| Backup file missing/changed/not ready | Refresh list; local retention may have removed it. Use a verified external release; do not edit the JSON to bypass checks. |
| age decrypt/checksum failed | Check key identity, all split parts/order, full download and chosen release. Preserve evidence; try another known good copy. |
| Heartbeat warning/missed alert | Check monitor URL/network and alert delivery. Verify the release exists; repair the monitor as well as the backup. |

## Checks calendar

| Frequency | Check |
| --- | --- |
| Daily | Latest successful private release, expected size/coverage, worker alive and heartbeat; investigate missed alerts that day |
| Weekly | Download an encrypted copy to laptop/USB; verify repository remains private and disk/Storage usage is within limits |
| Monthly | Full restore drill to a side DB; open an attachment, verify recent attendance, measure RTO, inspect all exclusion warnings |
| Quarterly | Test account recovery and missed-run alerts; review access/token scopes, data-deletion replay and restore compatibility after upgrades |
| Yearly / before expiry | Renew backup token before its chosen expiry; check key/USB readability, retention/legal policy, free-tier limits and provider recovery access |

## Verified tools, privacy, limits and cost sources

Checked against primary sources on 8 November 2026. Recheck before setup and after provider changes:

- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases): each asset must be below 2 GiB; up to 1,000 assets per release. GitHub documents no total release-size/bandwidth quota here. This does not make Releases a guaranteed unlimited backup SLA; terms, abuse controls and account access still apply. The default 1.9 billion-byte split stays below the per-file limit.
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions): private-repo CI uses the included allowance and can incur charges beyond it. Set spending controls/no paid overage. Nightly backups here use existing VPS cron, not hosted Actions minutes or paid artifact storage. The additional backup CI job is short, but cannot guarantee an account-wide ₹0 bill if other usage exceeds allowance.
- [GitHub scheduled workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule): schedules may be delayed/dropped under load; inactivity disabling after 60 days applies to public repositories. This is another reason not to use that schedule as the primary timer for this VPS.
- [Supabase backup docs](https://supabase.com/docs/guides/platform/backups): Free projects should make/export their own backups; provider DB backups do not include Storage file bytes. Paid backup retention/PITR must not be assumed free. Your current plan and recoverable provider backups are **[TO CONFIRM]**.
- [age usage](https://github.com/FiloSottile/age): public recipient encryption and offline identity decryption. The test suite uses real age; no private production key is installed in CI or the server.
- [PostgreSQL pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html): custom-format dump and pg_restore; one DB per dump, not cluster-global roles. This implementation deliberately enforces matching majors as requested.
- [Debian bookworm age](https://packages.debian.org/bookworm/age) and [gh](https://packages.debian.org/bookworm/gh): packages exist for the chosen worker OS. Its PostgreSQL tools come from the matching official PostgreSQL base image. Docker image build on this Windows host is **[TO CONFIRM]** because Docker is not installed here; CI's real DB drill uses a disposable PostgreSQL 16 container.

Student data stays encrypted before leaving the server for GitHub. The private repo still exposes filenames/timestamps/sizes to authorized repo readers. Limit access, protect laptops/USBs, and do not attach dumps or decrypted screenshots to support tickets. `umask 077` and mode-700/600 directories/files reduce accidental access. A trusted server administrator can still read temporary plaintext while creating a backup, just as they can read the live DB. Temporary plaintext is removed on completion/failure; a hard host crash may leave private `.work-*` files for reviewed cleanup after confirming no active backup. Disk encryption is a separate host control.

## Tests and implementation files

### Automated setup when key creation is deferred

The production deployment runs `scripts/backup/install-tools.sh` and `provision.cjs prepare`. These inspect database version/configuration without printing credentials, install only missing client tools on an apt-based VPS, create mode-700/600 backup state/config, preserve existing application settings, and add an idempotent cron entry. No database server upgrade, database restore, private age identity, or plaintext upload is performed. The tools installer uses the [official PostgreSQL repository helper](https://www.postgresql.org/download/linux/ubuntu/) only when the required client-major package is unavailable from the existing apt sources.

`scheduled.sh` logs PAUSED without creating a fake successful backup while either the public recipient or repo token is missing. Manual offline backups remain subject to the same real store-coverage checks. No broad GitHub CLI credential is copied to the VPS.

[Backup operations](https://github.com/Mrinmoypatratint/attendoschool/actions/workflows/backup-operations.yml) supports `inspect`, `prepare`, and `monitor`. It uses the existing GitHub Actions VPS credentials; your laptop does not need an SSH key. A daily 03:47 UTC monitor checks the last encrypted release recorded outside the database. Once enabled, a missing/expired/incomplete release fails the workflow; verify your [GitHub Actions notification settings](https://github.com/settings/notifications/actions) for failure emails. The monitor reports PAUSED while credentials are deferred. GitHub scheduled-workflow delay/inactivity limits still apply; the optional independent heartbeat remains useful.

When ready later, create your offline age identity and add only its public recipient as the code repo's `BACKUP_AGE_RECIPIENT` Actions secret. GitHub requires the account owner to create a fine-grained token; the available tools cannot mint it for you. Use [this prefilled token form](https://github.com/settings/personal-access-tokens/new?name=AttendoSchool-backups&target_name=Mrinmoypatratint&expires_in=90&contents=write), select **only** `attendoschool-private-backups`, and set its value as the `BACKUP_GH_TOKEN` [Actions secret](https://github.com/Mrinmoypatratint/attendoschool/settings/secrets/actions/new). Do not paste either the private identity or token into chat. See [GitHub's token documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#pre-filling-fine-grained-personal-access-token-details-using-url-parameters).

Run Backup operations → `prepare` to transfer these two settings over the existing encrypted SSH connection into the private server config and sync the public key into the web process. Empty workflow secrets do not erase existing server credentials. Then run one nightly-style backup and test both restore paths. Store coverage must also pass; a PostgreSQL dump never silently claims to cover unique Firebase data.

Core/format/retention: `scripts/backup/core.cjs`. Host daily entrypoint: `scripts/backup.sh`. Dedicated worker: `scripts/backup/worker.sh`, `worker.cjs`, `runner.cjs`; serialized queue mutations: `control.cjs`. Safe download/restore: `scripts/restore.sh`, `restore.cjs`. Exact-value env loader: `load-env.cjs`.

HTTP endpoints: `backend/src/routes/backups.ts`; shared manager adapter: `backend/src/services/backupService.ts`. UI: `frontend/src/components/BackupControls.tsx`, `super-admin/SuperAdminLayout.tsx`, both existing backup pages. Infrastructure: `ecosystem.config.cjs`, Compose, root Docker ignore and backend/worker Dockerfiles. Examples in root/backend/frontend list backup settings; frontend examples explicitly mark them server-only.

Run local safe tests:

```bash
BACKUP_REQUIRE_AGE=1 npm run test:backups
for script in scripts/backup.sh scripts/restore.sh scripts/backup/worker.sh scripts/backup/tests/*.sh; do bash -n "$script"; done
shellcheck -S warning scripts/backup.sh scripts/restore.sh scripts/backup/worker.sh scripts/backup/tests/*.sh
bash scripts/backup/tests/roundtrip.sh
# Disposable PostgreSQL 16 Docker container; no application database is used:
bash scripts/backup/tests/postgres-roundtrip.sh
# Or an installed local PostgreSQL's tools, creating a new private Unix-socket cluster:
BACKUP_TEST_LOCAL_PG_BIN=/usr/lib/postgresql/18/bin bash scripts/backup/tests/postgres-roundtrip.sh
```

The unit tests use fake DB/GitHub command adapters and local release folders, but real tar and age. The Linux shell test also puts fake dump/gh commands on PATH, exercises the actual config wrapper/worker/cron/restore entrypoints and tiny encrypted splits, checks no secret or PGDMP marker appears in release bytes, compares restored files and verifies checksums. Retention tests cover daily/monthly/unrelated/current tags. Mutation testing breaks monthly retention in a temporary copy and proves the tests fail; the real source is unchanged. HTTP tests exercise server role denial even with all permissions, traversal/tampering, 202, 409, attachment/no-store headers and audit. Storage tests exercise paging, nested keys, path rejection and size limits.

CI runs the backup job before automatic merge/deploy. It installs age/ShellCheck, runs tests/lint and both round trips. CI has not been run for these uncommitted changes. The application DB is never contacted by the test fixture. No production secrets are loaded in test entrypoints.

### Local verification results — 8 November 2026

```text
Linux core/storage/retention tests: 23 passed, 0 failed, 0 skipped
HTTP role/queue/download/audit test: 1 passed, 0 failed
Playwright backup navbar/dialog/download tests: 4 passed
Retention mutation: deliberately broken monthly rule caught; original source unchanged
Cron/worker shell round trip: PASS (synthetic database/GitHub, real age)
Real PostgreSQL 18 local-cluster restore: PASS (original row verified)
SHA256SUMS: README.txt, config.tar, coverage.json, database.dump, uploads.tar OK
bash -n: PASS for all backup/restore/test shell scripts
shellcheck -S warning (0.11.0): PASS
Backend TypeScript build: PASS
Frontend TypeScript + Vite production build: PASS (bundle-size warning remains)
```

The real database drill created and removed a new PostgreSQL 18 cluster on a private local Unix socket in Ubuntu/WSL. It did not connect to the app database. Linux queue tests include six simultaneous reservations after a vanished job, so the recovery/claim lock is exercised across separate control processes. Windows additionally passed the portable tests; its Linux-specific OS-lock test is skipped there and passed on Linux. The phone test caught an off-screen dropdown; the fix and the full four-test UI suite passed afterward.

**Not verified on production:** live engine/major, legacy Firebase contents, actual Supabase Storage coverage/restore compatibility, private repo/token permissions, Docker image build, configured cron/heartbeat, and a restore of real customer data. No accounts, server settings or production data were changed. No commit, push, or deployment was performed for this backup task. Separate concurrent login/UI changes in the workspace are outside this task.

### Command cheat sheet and glossary

| Command | Meaning |
| --- | --- |
| `pm2 logs attendoschool-backups --lines 30` | Read dedicated worker logs |
| `BACKUP_CONFIG_FILE=/PRIVATE/PATH bash scripts/backup.sh` | Queue/wait for an encrypted nightly-style backup |
| `gh release list --repo OWNER/PRIVATE-BACKUPS` | See off-server copies |
| `bash scripts/restore.sh OWNER/PRIVATE-BACKUPS KEY [TAG]` | Download/decrypt/verify without modifying a DB |
| `bash scripts/restore.sh --file FILE.tar.age KEY` | Verify a downloaded manual backup |
| `pg_restore --list database.dump` | Inspect a custom dump without loading a DB |
| `sha256sum -c SHA256SUMS` | Detect changed payload files |
| `age-keygen -y KEY` | Derive the public recipient from your offline identity |

**RPO:** how much recent data you could lose. **RTO:** how long recovery takes; measure it in a drill, do not promise 15 minutes. **PITR:** restore to a point between snapshots using database logs. **Recipient:** public age encryption key. **Identity:** private age decryption key. **Dump:** a logical database export. **Retention:** which older copies remain. **Side database:** a separate restore target used to avoid overwriting live data.

# AttendoSchool data backup: work completed, remaining work and future updates

Last reviewed: **8 November 2026**. This is a handover and status record, not evidence that an actual customer-data backup exists.

## Current position

**Encrypted off-server backup protection is PAUSED.** The implementation, private repository, server tools, worker, cron and monitoring workflow have been prepared and deployed. The owner explicitly deferred both the offline age identity/public recipient setup and the repository-scoped upload token. Neither deferred step has been silently completed.

There is also a separate data-coverage blocker: production has Supabase PostgreSQL 17, but its configured application driver is `firebase` and Firebase credentials are present. We have not established whether unique live data exists in Firestore or Firebase Storage. The current exporter deliberately refuses unsupported Firebase/dual-store configurations. Adding the recipient and token alone will not establish complete protection.

No production customer-data archive, encrypted GitHub release, or customer-data restore has been verified by this work. A successful deployment or a green paused monitor is **not** a successful backup.

| Area | Status | Meaning |
| --- | --- | --- |
| Backup implementation and owner UI | Implemented and deployed | Real queued jobs replace fabricated backup results. |
| Private destination repository | Created and verified private | Release attachments are the intended destination; no customer dump was uploaded. |
| VPS tools, private state and worker | Prepared; worker observed online | Infrastructure is ready for further setup, not proof of a completed job. |
| Daily cron and Actions monitor | Installed; explicitly paused | Missing credentials cause no upload. |
| age recipient / offline identity | Deferred by owner | No private age identity was created on the VPS. |
| Fine-grained backup repository token | Deferred by owner | No broad CLI token was copied to the server. |
| Firebase and external file coverage | Unresolved | Must be investigated before claiming a complete backup. |
| First real encrypted backup and restore drill | Not completed | Required before accepting the system as operational. |

## Scope and source of truth

The requested feature was free encrypted daily backups plus owner-controlled “Take backup” and download actions, independent queue/status storage, retention, safe restore assistance, tests and operational documentation. No new paid backup service was enabled. Provider limits, storage quotas and future pricing still need review; “free” is not an unlimited-capacity guarantee.

The detailed operating manual is [`docs/backup.md`](docs/backup.md). For the version corresponding to the verified deployment, use the [manual pinned to deployed commit dd425d9](https://github.com/Mrinmoypatratint/attendoschool/blob/dd425d9856e4f620d966554142ced5e1608a671f/docs/backup.md).

**Checkout warning:** the workspace root was on `feature/ui-reskin` during this review and did not yet contain the final deployed state-path fix. The isolated checkout at `backups/deploy-state-fix` contains that fix. Older local instructions mentioning `/home/attendoschool/.attendoschool-backup-state` must not be reused for this production deployment. The correct production path is `backend/.backup-state` under the app root. Check the deployed commit and current remote branch before making another change; do not reset or overwrite unrelated local work to synchronize this document.

This file records backup work. Earlier branding work, including logo commit `996b9b2`, is separate from backup readiness.

## What was discovered about the live system

| Item | Evidence / conclusion | Remaining uncertainty |
| --- | --- | --- |
| Hosting | Hostinger VPS, GitHub Actions SSH deployment, PM2 | Alternative Compose files do not establish that production runs Docker. |
| Application root | `/home/attendoschool/htdocs/attendoschool.online` | Recheck if hosting changes. |
| Database | Supabase PostgreSQL major **17**, reachable | Full production restore compatibility has not been tested. |
| Attachments in SQL | `attachment_blobs` table exists | Table existence alone does not prove all attachments are stored there. |
| Application driver | `DB_DRIVER=firebase` | Unique Firestore data and actual route usage need investigation. |
| Firebase credentials | Configured | Credentials alone neither prove nor disprove live Firebase data. |
| External object storage | No explicit Firebase bucket or Supabase Storage configuration detected by the read-only probe | Absence of explicit configuration is not proof that external files do not exist. |
| Customer data access | Metadata/configuration checks were performed | No complete live data inventory/export was performed. |

No production customer records were changed, deleted or exported as part of this backup setup. Server configuration and tools were changed to prepare the service.

## Work completed

### Backup engine and archive format

- Implemented PostgreSQL custom-format dumps using `pg_dump -Fc`, with dump signature and `pg_restore --list` checks. Client major must match the server major. Database passwords are supplied through the environment rather than command-line arguments.
- Added checks for disk capacity and unsupported database connection modes. Transaction-pooler port `6543` is rejected; a direct/session endpoint must be verified before use.
- Added private temporary directories and streaming `tar | age` encryption. Plaintext is never uploaded to the backup repository.
- Added `config.tar`, optional `uploads.tar`, restore instructions, `coverage.json` and `SHA256SUMS` alongside the PostgreSQL dump inside the archive.
- Allowlisted application/deployment configuration. Runtime application settings are reconstructed only for encrypted archives; backup tokens, private backup configuration and unrelated runtime variables are excluded.
- Added paginated, recursive Supabase Storage object export and bucket metadata export. This has fixture coverage; a live production storage export has not been exercised.
- Added an optional dedicated local upload directory, with rejection of symlinks, special files and recursive inclusion of backups.
- Added private GitHub Release publication, repository privacy checks and rejection of the application repository as a backup destination.
- Added release retention, local archive cleanup, durable publication evidence and an optional success heartbeat.

| Default | Implemented behavior |
| --- | --- |
| Upload cap | Combined local/remote files capped at **1,500,000,000 bytes**. Above the cap, files are skipped with explicit warnings/coverage information. Such a result is not a complete file backup. |
| Free disk | Minimum **1 GiB**, plus capacity estimate of roughly **3 × database size + 2 × upload limit**. |
| Release names | UTC `backup-YYYY-MM-DD-HHMM`; a same-minute collision fails safely. |
| Publication | Draft release → encrypted attachment upload → publish. Interrupted drafts may remain for review. |
| Large encrypted archives | Split above **1,900,000,000 bytes** per asset; maximum 1,000 assets. |
| Remote retention | Last 14 days, plus backups made on day 1 within a 12-month calendar window. Preserve the current release and unrelated tags. |
| Local retention | Newest three ready archives; failed records pruned after seven days. |
| Last successful publication | Stored separately in `last-published.json`, independent of local archive retention. |

### Queue, worker and status records

- Implemented a dedicated filesystem backup queue, separate from email/SMS/notification jobs.
- Added atomic JSON status records outside the database being backed up: queued, running, ready or failed, with actor, timestamps, size, checksum, encryption state, warnings and errors.
- Added Linux `flock` coordination across clustered web processes and a singleton worker. Jobs run sequentially, with timeout and stale-job recovery safeguards.
- Added recipient fingerprint checking so the web process and worker cannot silently use different encryption recipients.
- Added a durable private `audit.jsonl`; completion also makes a best-effort entry in the existing database audit system.
- Added `load-env.cjs` for exact decoding of generated runtime configuration, including quotes/newlines/backslashes. Its generated `runtime.env` is not a shell script to source or a generic dotenv replacement.

### Owner UI and HTTP API

- Added shared backup controls to the Super Admin navbar and backup-management screens: take a backup, download the latest available archive and view all jobs.
- Added running/idle polling, completion/download notifications, real server errors, encryption warnings and an accessible job-history dialog.
- Replaced fake success results, fabricated job rows and fabricated checksums with real queue state.
- Enforced `SUPER_ADMIN` on the server, independently of broad/wildcard permissions. Lower-role users cannot obtain access merely by showing the UI.
- Added strict archive identifiers, exact filenames, symlink rejection and ready/size/checksum checks before download. Responses use attachment disposition and `no-store`.
- Kept destructive restore/cleanup operations out of the HTTP API.

| API surface | Behavior |
| --- | --- |
| `/api/backups` and `/api/backups-v21` | Mounted backup interfaces. |
| `GET /jobs` or `GET /` | Returns encryption state and actual jobs. |
| `POST /create` or `POST /trigger` | Queues a job with HTTP 202; conflicting work returns 409. |
| `GET /:id/download` | Streams the validated ready archive after authorization. |

The server streams downloads, but the current browser code uses a Blob. Large downloads can therefore consume substantial browser memory. Production owner-session interaction was not tested with a real signed-in owner during setup; UI tests used mocked API responses.

### Restore helper

- Added `scripts/restore.sh` and its Node helper for a private repository release or a locally downloaded `.tar.age` file.
- Added strict split-part ordering, age decryption into a new private directory, rejection of unsafe/duplicate/link archive members and checksum validation.
- The helper **does not connect to or overwrite a database**. It prints commands for a separate recovery database and file/config restoration.
- Production Supabase schemas, roles, extensions, RLS, authentication and object-storage compatibility still require a real recovery drill. A PostgreSQL dump does not include cluster-global role passwords or automatically recover provider account access.

### Deployment and operational integration

- Created and verified the separate private repository: [attendoschool-private-backups](https://github.com/Mrinmoypatratint/attendoschool-private-backups).
- Installed server-local tools without `sudo`, system package installation or a database upgrade. Installation downloads authenticated apt packages and extracts them into private user-owned directories.
- Verified server tools: **age 1.1.1**, **gh 2.45.0**, **pg_dump / pg_restore 17.11**.
- Added provisioning, inspection, paused scheduling and missed-run monitoring scripts. Empty incoming settings do not erase existing configured values.
- Added PM2 process `attendoschool-backups`, observed online with one fork instance, alongside the clustered backend.
- Added idempotent cron installation and the Actions `backup-operations.yml` workflow, using existing VPS Actions SSH credentials.
- Added backup CI checks, shell LF rules, private-state exclusions in Git/Docker and alternative Docker/Compose worker wiring.
- Resolved private-state ownership/path problems by using writable private state under the deployed backend. A later isolated backup fix avoided mixing unrelated mobile/login changes into that push.

No laptop or USB authentication is required to execute scheduled jobs. The VPS uses the public encryption recipient and scoped upload credentials; Actions uses the existing VPS SSH credentials. The offline private age identity is needed to decrypt/recover archives later. Its setup remains deferred at the owner's request.

## Production paths and schedules

All paths below are relative to `/home/attendoschool/htdocs/attendoschool.online` unless absolute.

| Path / process | Purpose |
| --- | --- |
| `backend/.backup-state/` | Private backup service state; excluded from Git and Docker context. |
| `backend/.backup-state/backup.env` | Trusted server configuration, mode `600`. Never put its contents in this document. |
| `backend/.backup-state/private/` | Archives, queue, locks, job records and audit state; directory mode `700`. |
| `backend/.backup-state/tools/prefix/` | Extracted private tools. |
| `backend/.backup-state/tools/runtime.env` | Tool runtime environment. |
| `backend/.backup-state/setup-report.json` | Provisioning report; readiness must be interpreted truthfully. |
| `backend/.backup-state/cron.log` | Managed scheduled-job log. |
| `attendoschool-backups` | Dedicated singleton PM2 worker. |
| Managed cron | Daily **02:17 in the VPS cron timezone**, marker `# attendoschool-backup-managed`. The timezone was not independently verified. |
| Actions schedule | Daily **03:47 UTC**; checks the host schedule and publication status. |

Actions operations are `inspect`, `prepare`, `monitor` and `daily`. If managed host cron is absent, `daily` can queue the job through SSH. Monitoring checks independent evidence of a complete encrypted publication within **36 hours**. A missing recipient/token produces an explicit paused result and no upload. A paused monitor may exit successfully; that is a configuration state, not healthy backup protection.

The verified setup report included:

```json
{
  "postgresMajor": 17,
  "state": "paused_waiting_for_public_recipient_and_scoped_repo_token",
  "privateKeyCreatedOnServer": false,
  "cronInstalled": true,
  "schedule": "Daily user cron; GitHub Actions checks missed runs"
}
```

The verified monitor reported:

```json
{
  "state": "paused",
  "message": "Encrypted off-server backups are waiting for the public recipient and scoped repo token; this is not active protection"
}
```

## Main implementation files

Paths refer to the deployed revision; root-checkout versions may lag as described above.

| Files | Responsibility |
| --- | --- |
| `scripts/backup/core.cjs` | Dump, storage export, archive, encryption, publication and retention. |
| `scripts/backup/control.cjs` | Cross-process queue/control locking. |
| `scripts/backup/worker.cjs`, `worker.sh`, `runner.cjs` | Single worker, job execution, timeout/recovery and daily runner. |
| `scripts/backup.sh`, `scripts/backup/scheduled.sh` | Trusted server entry points and paused scheduling guard. |
| `scripts/backup/provision.cjs`, `install-tools.sh` | Safe metadata inspection, private configuration, tools, cron and monitor. |
| `scripts/restore.sh`, `scripts/backup/restore.cjs`, `load-env.cjs` | Decrypt/validate recovery and exact runtime-environment loading. |
| `backend/src/services/backupService.ts`, `backend/src/routes/backups.ts` | Authorized HTTP adapter and validated downloads. |
| `frontend/src/components/BackupControls.tsx`, accompanying CSS and layout/page integrations | Shared owner UI. |
| `ecosystem.config.cjs` | PM2 worker and private config path. |
| `.github/workflows/backup-operations.yml`, `ci.yml`, `deploy.yml` | Operations, verification and deployment integration. |
| Backup Dockerfile, backend Dockerfile and Compose files | Alternative container deployment. |
| `docs/backup.md` | Full setup, recovery, failure handling and operating procedures. |

## Verification completed and its limits

| Verification | Result / scope |
| --- | --- |
| Core/provisioning tests | Linux fixture tests covered storage traversal, archive validation, encryption, retention, queue control, provisioning and private-state regression cases. |
| HTTP tests | Composite test covered lower roles, broad permissions, queue/conflict behavior, invalid downloads, headers and audit behavior. |
| Browser tests | Four mocked-API cases covered owner controls, errors, lower-role visibility and 360px mobile layout. |
| Encryption/archive round trip | Real age/tar/checksum execution with fixtures; split publication tested with fake release storage. |
| Retention mutation check | A deliberate temporary defect was detected by tests; source restored/unchanged. |
| Database recovery tests | Disposable PostgreSQL 18 in local WSL and PostgreSQL 16 in CI; known fixture rows restored. These were not production databases. |
| Shell/tool checks | Shell syntax, warning-level ShellCheck, paused scheduling, environment round trips and rootless installer checks passed. |
| App builds | Backend TypeScript and frontend TypeScript/Vite checks passed. |
| Container verification | CI exercised a disposable PostgreSQL container. A complete local application Docker build was not verified. Alternative Compose defaults use PG16; production Supabase needs matching PG17 tools. |
| Production availability | Frontend `/` and `/api/health` returned 200 after deployment. |
| Production access guard | Unauthenticated `/api/backups/jobs` returned 401. |
| Private state exposure | A HEAD request to `/backend/.backup-state/backup.env` returned 404. No private response body was downloaded. |
| Actual backup/recovery/alerts | Not verified with production customer data, an actual encrypted release, a real owner session or delivered failure notifications. |

Verified deployed revision: **`dd425d9856e4f620d966554142ced5e1608a671f`**.

- [Deployment run 42477167401 — succeeded](https://github.com/Mrinmoypatratint/attendoschool/actions/runs/42477167401).
- [CI run 42477223943 — succeeded](https://github.com/Mrinmoypatratint/attendoschool/actions/runs/42477223943).
- [Monitor run 42477872706 — succeeded with explicitly paused state](https://github.com/Mrinmoypatratint/attendoschool/actions/runs/42477872706).

Historical backup milestones include `2f0e086` (implementation/paused setup), `53a5812` (disposable PostgreSQL readiness), `7b25190` (rootless tools), `edc848f` (private-state ownership handling) and `dd425d9` (final writable backend state path). Deployment safeguards also incorporated work from a separate concurrent UI/deployment session; not every surrounding commit was backup work.

## Remaining work: required before calling backups operational

The following steps are **not complete**. The owner chose to defer steps 2 and 3; do not generate a private identity or token on their behalf, or repeatedly request them while deferred.

### 1. Establish complete live-data coverage

Identify the actual source of truth for students, users, schools, attendance, billing, files and settings. Map routes/services to SQL, Firestore, external storage and any memory fallback. Determine whether Firestore contains unique documents, nested subcollections or values that the legacy JSON exporter cannot preserve.

Choose either a verified migration to supported stores, or a complete Firebase export/recovery implementation with type/subcollection tests. Migration or destructive data changes need their own explicit authorization. Do not simply change `DB_DRIVER` or set `BACKUP_FIREBASE_CONFIRMED_UNUSED=true` to suppress the blocker.

Check provider plan and quotas before a full inventory/export: Firestore document reads can be billable, and managed export can require a billed plan. Do not silently enable paid features. No Firestore document export has been performed by this work.

Acceptance: a written store-by-store inventory, explicit coverage decisions and a tested recovery path for every unique live dataset and file store.

### 2. Owner creates and safeguards the offline encryption identity — DEFERRED

Generate an age identity in an owner-controlled recovery environment later. Keep redundant protected private copies away from the VPS. Put only the **public recipient** in the application repository's Actions secret `BACKUP_AGE_RECIPIENT`. Never paste the private identity into chat, a commit, a GitHub secret or server configuration.

Acceptance: the owner can decrypt a test archive using a safely retained identity; only the matching public recipient is installed for the service. Losing every private copy makes old encrypted archives unrecoverable.

### 3. Owner creates a narrowly scoped upload token — DEFERRED

Create a fine-grained token for **only** `Mrinmoypatratint/attendoschool-private-backups`, with Contents read/write and a deliberate expiry/reminder. Store it as `BACKUP_GH_TOKEN` in the application repository's Actions secrets. These tools cannot mint a personal token. Do not substitute a broadly scoped local GitHub login token.

Useful links: [fine-grained tokens](https://github.com/settings/personal-access-tokens), [application Actions secrets](https://github.com/Mrinmoypatratint/attendoschool/settings/secrets/actions).

Acceptance: scoped access can publish to the private backup repository, privacy is rechecked and token rotation/expiry has an owner.

### 4. Apply and inspect the final configuration

After coverage and deferred prerequisites are resolved, run the [Backup operations workflow](https://github.com/Mrinmoypatratint/attendoschool/actions/workflows/backup-operations.yml) with `prepare`. Inspect its report and PM2 state. Verify matching web/worker recipient fingerprints, tool major 17, database endpoint, disk capacity, file-store settings and private permissions.

Acceptance: no unsupported-store bypasses, no private age key on the VPS, no secret exposure and no paused/missing-configuration state. Credentials present still does not prove a usable backup.

### 5. Run the first complete production backup and recovery drill

Run a real queued job and verify the private published release, encrypted header, all split parts, checksums, coverage and warnings. Test both owner download and release download. Decrypt in a controlled recovery environment and restore into a **separate compatible database and file location**, never over the live database for a drill.

Check representative rows, tenant boundaries, owner/admin roles, password-based sign-in, attendance, billing relationships, attachments, storage objects, sequences, functions, extensions and required provider-specific schemas. Record exact commands, destination versions, archive/release identifier, duration and results without secrets.

Acceptance: complete data/file coverage and a demonstrated usable recovery. Any skipped uploads or unsupported datasets prevent a “full backup” claim.

### 6. Prove unattended operation and alert delivery

Observe the next unattended host-cron backup, then verify independent publication evidence. Test missed/failed-run behavior safely, confirm the 36-hour threshold and ensure an accountable owner actually receives notifications. Workflow success in paused state does not satisfy this step.

Acceptance: a complete unattended encrypted release, a tested failure alert, documented host timezone and a recurring restore-review schedule. Measure recovery time; do not promise an RTO before measuring it.

## Future updates — proposed, not implemented

| Priority | Update | Reason / completion evidence |
| --- | --- | --- |
| P1 | Show readiness/coverage in the owner UI | Distinguish paused, missing settings, unsupported store, partial files, running, ready and overdue. A ready archive must not imply complete protection. |
| P1 | Stream large browser downloads to disk; support resume/integrity checks | Avoid Blob memory pressure; test realistic large archives and interrupted transfers. |
| P1 | Add PG17 recovery CI alongside PG16 and provider-specific drills | Production uses PG17; generic fixture restores do not prove Supabase recovery. |
| P1 | Improve large-file backup strategy | Explicit partial/full labels, tested manifests, chunking/incremental storage and capacity review before raising the cap. |
| P1 | Independent worker health and alert verification | Detect a stopped worker, expired token and stuck jobs before the next missing-release deadline. |
| P1 | Audit/log rotation and safe crash-temp cleanup | Bound disk use; only remove stale private files after proving no related job is alive. |
| P1 | Expand failure/recovery tests | Exercise ownership restrictions, installer failures, cron absence, process crashes, stale jobs and credential/recipient mismatch. |
| P1 | Retire legacy exports and memory fallbacks after replacement is proven | Prevent false assurance and plaintext exports. Review existing schedules/files before changing or deleting them. |
| P1 | Document database/file consistency boundaries | SQL and external object exports do not form one atomic snapshot. Use a planned write pause where strict consistency is needed. |
| P2 | Key rotation and token expiry procedures | Test old-archive recovery, recipient changes, redundant offline identities and replacement-token rollout. |
| P2 | Capacity and retention review as data grows | GitHub/provider limits and usage change; evaluate costs before selecting alternatives. Never enable paid services automatically. |
| P2 | Provider-independent recovery package | Record account recovery, DNS, TLS, process settings and external integrations beyond application archives. |
| P2 | Regular documented restore exercises | Monthly initially and after schema/storage changes; assign an owner and record measured recovery results. |
| P2 | Evaluate additional encrypted offline copies or point-in-time recovery | Improve resilience where justified; verify availability/cost and obtain authorization before paid provisioning. |

## Boundaries and operational cautions

- A SQL dump cannot recover unsynced attendance sitting only in a browser, records held only in memory, external file bytes not exported, or lost provider account ownership.
- Redis cache can rebuild; in-flight notification jobs may be lost. Review persistent records before resending to avoid duplicates.
- Known config files are included, but external nginx/system configuration, cron, TLS private files and credential files outside the runtime environment are not automatically discovered. Keep separate recovery instructions.
- An encrypted archive does not remove the need to protect the private identity. Keep backup-repository access and decryption capability separately recoverable.
- Manual unencrypted fallback archives, where allowed, omit runtime secrets but can still contain personal data and database-stored secrets. They must remain private and must never be uploaded as plaintext GitHub backups.
- A skipped file export, failed retention step, incomplete release or unsupported store must remain visible. Do not convert failures to fabricated success.
- Daily scheduling offers no guaranteed recovery point until jobs succeed consistently. The current system is paused; no new RPO/RTO guarantee is established.
- A snapshot does not implement legal deletion governance for retained historical copies. Review retention and access requirements before expanding distribution.

## Next maintainer checklist

1. Read this status record and the manual at the verified deployed revision; inspect current main/deployed SHA before changing anything.
2. Preserve unrelated workspace/UI changes. Do not use a forced push or reset to make the checkout match this handover.
3. Reconfirm production metadata and repository privacy without printing credentials or exporting customer data unnecessarily.
4. Keep the owner's key and token deferrals in effect until they explicitly resume those steps.
5. Resolve Firebase and file-store coverage before enabling a “full backup” promise.
6. Complete the ordered activation and recovery acceptance checks above; update this file with dated evidence.
7. Record future actual releases and drills by identifier, timestamp, scope and outcome. Never record secret values or raw customer rows here.

**Definition of done:** a complete encrypted off-server archive, proven compatible recovery, a successful unattended run, delivered failure alerts, protected recovery keys and documented coverage of every live store. As of this review, that definition has **not** been met. This documentation update itself does not activate backups or change production.

# AttendoSchool — Production Deployment Log

All production deployments are recorded in GitHub Actions run history.

**View all deployments:** [GitHub Actions → CD — Production Deployment](https://github.com/Mrinmoypatratint/attendoschool/actions/workflows/deploy.yml)

---

## Deployment Record Format

Each deployment run generates a Step Summary containing:

```text
Deployment #<run_number>

Version:        v0.11.0-YYYYMMDD-HHMM-<commit_sha>
Commit:         <full_sha>
Branch:         main
Triggered By:   <github_actor>
Started:        <timestamp>

Build:          PASS / FAIL
Frontend Deploy: PASS / FAIL
Backend Deploy:  PASS / FAIL
Frontend Health: PASS / FAIL
Backend Health:  PASS / FAIL
Result:         SUCCESS / REVIEW NEEDED
```

---

## How to Find a Deployment

1. Go to [GitHub Actions](https://github.com/Mrinmoypatratint/attendoschool/actions)
2. Filter by workflow: **CD — Production Deployment**
3. Click any run to see the full deployment record
4. Check the **Summary** tab for the deployment record table

## How to Rollback

1. Go to [GitHub Actions → CD — Production Deployment](https://github.com/Mrinmoypatratint/attendoschool/actions/workflows/deploy.yml)
2. Click **Run workflow**
3. Enter the **Run ID** of the deployment you want to restore
4. Click **Run workflow**

---

## Deployment History

> Deployment history is automatically tracked in GitHub Actions.
> Each run's Step Summary contains the complete deployment record.
> Build artifacts are retained for 30 days for rollback capability.

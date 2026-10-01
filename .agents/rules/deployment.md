# Automated Deployment Rule

1. **Zero Manual Steps**: Never ask the user to manually upload, extract, or move files in Hostinger, hPanel, File Manager, or cPanel.
2. **100% Automated CI/CD**: All deployments must happen automatically via GitHub Actions CI/CD (`.github/workflows/ci-cd.yml`).
3. **Automatic Push & Verify**: When code changes are made and tested, push to `main` branch directly, monitor the GitHub Actions CI/CD pipeline, and verify the live deployment endpoints automatically.

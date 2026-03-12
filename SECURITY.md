# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | ✅        |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security issues privately:

1. **Email:** kin0.k423@gmail.com  
2. **Subject:** `[SECURITY] <repo-name> — <brief description>`
3. Include: steps to reproduce, impact assessment, suggested fix (if any)

You will receive acknowledgement within **48 hours** and a resolution timeline within **7 days**.

## Security Practices in This Repo

- Secrets and API keys are **never committed** — use `.env` files (git-ignored)
- Pre-commit hooks with [gitleaks](https://github.com/gitleaks/gitleaks) scan for secrets on every commit
- Dependencies are reviewed before merging
- Branch protection rules require PR review before merging to `main`

## Known Security Tooling

- `gitleaks` pre-commit hook — blocks secrets from being committed
- `.gitignore` patterns — excludes `mcp.config.json`, `.env*`, wallet files

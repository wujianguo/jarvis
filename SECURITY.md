# Security Policy

## Supported Versions

This project does not currently publish versioned releases. Security fixes are applied to the default branch.

## Reporting a Vulnerability

If you discover a security vulnerability, please do **not** open a public issue.

Instead, report it privately:

- Preferred: use GitHub "Report a vulnerability" (Security Advisories) if enabled for this repository.
- Otherwise: contact the repository owner via GitHub.

Please include:

- A clear description of the issue
- Steps to reproduce (proof-of-concept if possible)
- Impact assessment
- Any suggested remediation

## Sensitive Data

Never commit secrets to this repository, including but not limited to:

- Feishu (Lark) app secrets/tokens
- KV service API tokens
- Any personal access tokens

If a secret is accidentally committed:

1. Rotate/revoke it immediately.
2. Remove it from git history if needed.
3. Document the incident and prevention steps.

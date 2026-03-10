# Processor Inventory

| Provider | Purpose | Data Types | Region / Notes |
| --- | --- | --- | --- |
| Vercel | application hosting, serverless functions, Blob storage | application data, backups, logs | verify DPA and EU/US routing before production |
| Neon | Postgres hosting | user profiles, submissions, audit logs, privacy requests | maintain staging and production branches separately |
| Google OAuth | optional authentication provider | account profile data used during sign-in | disable if DPA review is incomplete |
| Sentry | error monitoring | scrubbed application errors and request metadata | DSN must use PII scrubbing |
| GitHub | source control and CI | code, workflow logs, deployment metadata | enforce 2FA and branch protection |

## Required Pre-Launch Checks
- Signed DPA or equivalent terms review for Vercel, Neon, Google, and Sentry
- SCC review where cross-border transfer protection is required
- Access review for GitHub, Vercel, Neon, and Sentry admins

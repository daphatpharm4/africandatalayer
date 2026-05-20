# Team Credential Vault — Free Options

Goal: shared online password vault for the African Data Layer dev team. Must be **free**, **encrypted client-side**, **browser + mobile + CLI clients**, and **KeePass-compatible** (so vault can be exported and stored as `.kdbx` if we ever leave).

Bitwarden Teams is $4/user/mo — not free. Below: 3 truly free paths. **Recommended: Vaultwarden** (self-hosted, Bitwarden-protocol-compatible).

---

## Option 1 — Vaultwarden (Recommended)

**What**: Rust re-implementation of the Bitwarden Server, fully compatible with all official Bitwarden clients (web vault, browser extension, iOS/Android, CLI). Source: <https://github.com/dani-garcia/vaultwarden>. AGPLv3. Single binary, ~50 MB RAM.

**Why this one**: Free forever. Use the official Bitwarden apps your team already knows. Unlimited users, organizations, collections, sends, attachments. Argon2id password hashing, 2FA, emergency access — all included with no paid tier.

**Free hosting paths** (pick one):

| Host | Free quota | Effort | Notes |
|------|-----------|--------|-------|
| **Oracle Cloud Free Tier** (Recommended) | 2 ARM VMs (4 cores, 24 GB RAM) forever | ~30 min | Best free compute. Use `docker compose` + Caddy. |
| Fly.io | 3 shared-cpu-1x VMs, 256 MB RAM, 3 GB volume | ~20 min | Easiest deploy. `fly launch` from `vaultwarden/server` image. |
| Hetzner CX11 | Not free (~€4/mo) | ~30 min | Cheapest reliable EU VPS. List as fallback. |
| Self-host on existing infra | $0 if you have a box | varies | Docker container. |

### Deploy on Fly.io (fastest)

```bash
# install flyctl, then:
mkdir vaultwarden && cd vaultwarden
cat > fly.toml <<'EOF'
app = "adl-vault"
primary_region = "cdg"   # Paris — closest to Cameroon

[build]
image = "vaultwarden/server:latest"

[env]
DOMAIN = "https://adl-vault.fly.dev"
SIGNUPS_ALLOWED = "false"     # invite-only after first admin
SHOW_PASSWORD_HINT = "false"
ADMIN_TOKEN = "REPLACE_WITH_LONG_RANDOM"   # generate: openssl rand -base64 48
WEBSOCKET_ENABLED = "true"

[[mounts]]
source = "vw_data"
destination = "/data"

[http_service]
internal_port = 80
force_https = true
auto_stop_machines = false
auto_start_machines = true
min_machines_running = 1
EOF

fly apps create adl-vault
fly volumes create vw_data --region cdg --size 3
fly secrets set ADMIN_TOKEN="$(openssl rand -base64 48)"
fly deploy
```

Vault UI: `https://adl-vault.fly.dev`
Admin UI: `https://adl-vault.fly.dev/admin` (use the `ADMIN_TOKEN`)

### Deploy on Oracle Cloud Free (most generous)

```bash
# On the ARM VM (Ubuntu 22.04):
sudo apt update && sudo apt install -y docker.io docker-compose-v2 caddy
mkdir -p /opt/vaultwarden/data && cd /opt/vaultwarden
cat > docker-compose.yml <<'EOF'
services:
  vaultwarden:
    image: vaultwarden/server:latest
    container_name: vaultwarden
    restart: always
    environment:
      DOMAIN: "https://vault.yourdomain.com"
      SIGNUPS_ALLOWED: "false"
      ADMIN_TOKEN: "REPLACE_ME"
      WEBSOCKET_ENABLED: "true"
    volumes:
      - ./data:/data
    ports:
      - "127.0.0.1:8080:80"
      - "127.0.0.1:3012:3012"
EOF
sudo docker compose up -d
# Configure Caddy at /etc/caddy/Caddyfile for HTTPS termination
```

### Day-one checklist

1. First sign-up at the UI becomes the **owner account** — register, then set `SIGNUPS_ALLOWED=false`.
2. Create an **Organization**: "African Data Layer".
3. Create **Collections**: `infra/`, `vercel/`, `supabase/`, `sentry/`, `oauth/`, `email-sms/`, `secrets-rotated/`.
4. Enable **2FA** on all accounts (TOTP via Authenticator app, or WebAuthn for hardware keys).
5. Invite team via email from the org page. Use **Manager** role for tech leads, **User** for everyone else.
6. Install clients: browser extension, iOS app, Android app, CLI (`brew install bitwarden-cli`). All point to your Vaultwarden URL.
7. Run weekly `docker compose pull && docker compose up -d` for image updates.

### Backups

`/data` contains SQLite DB, attachments, sends, icons. Cron a daily `tar.gz` to S3-compatible storage (Backblaze B2 free 10 GB, Cloudflare R2 free 10 GB).

```bash
# /etc/cron.daily/vw-backup
docker exec vaultwarden sqlite3 /data/db.sqlite3 ".backup /data/db.bak"
tar -czf /opt/backups/vw-$(date +%F).tar.gz -C /opt/vaultwarden data
rclone copy /opt/backups r2:adl-vault-backups
find /opt/backups -mtime +30 -delete
```

### Migration / exit door

Export at any time from web vault → Settings → My Vault → Export → **`.json`** or **`.csv`**. Import target: KeePassXC, 1Password, Bitwarden Cloud, anything that ingests Bitwarden JSON.

---

## Option 2 — Passbolt Community Edition (alternative self-host)

**What**: Open-source team password manager, built specifically for teams (not single-user retrofit). PHP + MariaDB. AGPLv3. <https://www.passbolt.com/ce>

**Pros**: Granular per-resource sharing, built-in audit log, OpenPGP-based encryption (no master password reuse), better RBAC than Vaultwarden's Bitwarden-derived model.

**Cons**: Heavier stack (PHP-FPM + MariaDB + nginx). No native mobile parity yet — web extension + iOS/Android apps exist but less polished. No KeePass-compatible export (CSV only).

Pick this if you want **team-centric design from the ground up** and don't mind a heavier deploy.

```bash
# One-command Docker install on any VPS
curl -sL https://download.passbolt.com/ce/installer/passbolt-repo-setup.ce.sh -o passbolt-setup.sh
sudo bash passbolt-setup.sh
```

---

## Option 3 — KeePassXC + synced `.kdbx` (offline-first, no server)

**What**: Native desktop app (mac/win/linux). Vault is a single encrypted `.kdbx` file. Team shares the file via any sync provider. <https://keepassxc.org>

**Pros**: True KeePass format. Zero server cost. Audit-grade encryption (AES-256 / ChaCha20 + Argon2). Works offline.

**Cons**: No web UI. Concurrent edits = merge conflicts. Sync via:
- **Nextcloud / OwnCloud** (self-host on Oracle Cloud Free — free)
- **Syncthing** (peer-to-peer, no central server — free)
- **Cloud drive** (iCloud / Drive / Dropbox — free tiers fine for a `.kdbx` < 10 MB)
- **Private Git repo** — possible but discouraged (binary diffs).

Mobile: **KeePassDX** (Android, FOSS) / **Strongbox** (iOS, free tier).

Pick this if the team is small (<5), comfortable with desktop apps, and wants **no infra to maintain**.

---

## Comparison

| Capability                    | Vaultwarden | Passbolt CE | KeePassXC+sync |
|-------------------------------|:-----------:|:-----------:|:--------------:|
| Cost (any team size)          | Free        | Free        | Free           |
| Web UI                        | ✅          | ✅          | ❌             |
| Native iOS/Android apps       | ✅ (Bitwarden) | ⚠️ basic | ⚠️ via 3rd party |
| CLI                           | ✅ (`bw`)   | ✅          | ✅             |
| Browser autofill              | ✅          | ✅          | ✅ (via plugin)|
| Per-item sharing / collections| ✅          | ✅ (best)   | ❌ (file-level)|
| 2FA / WebAuthn / hardware keys| ✅          | ✅          | ✅ (key file)  |
| Audit log                     | ⚠️ admin only | ✅       | ❌             |
| KeePass `.kdbx` import/export | Import only | ❌          | ✅ native      |
| Concurrent edits              | ✅          | ✅          | ⚠️ conflict-prone |
| Server maintenance            | low (1 container) | medium | none           |
| Mobile parity for field agents| ✅          | ⚠️          | ⚠️             |

---

## Recommendation for ADL

**Deploy Vaultwarden on Fly.io free tier.** 20-minute setup, Bitwarden clients work out of the box, free indefinitely, exit door = Bitwarden JSON export. Use Oracle Cloud Free instead if you want the headroom (24 GB RAM is overkill but free is free).

Keep an **encrypted `.kdbx` export** in private S3-compatible storage as cold backup. Rotate every 30 days.

---

## Credentials to seed into the vault (collections)

Match to repo's `.env.example` — 39 env vars. Suggested layout:

- `vercel/` — Vercel API tokens, project IDs, edge config token, blob token
- `supabase/` — `DATABASE_URL`, service-role key, anon key
- `auth/` — Auth.js secret, Google OAuth client id/secret
- `sentry/` — DSN (browser + node), org token
- `ai/` — Gemini API key
- `email-sms/` — Resend key, SMS provider key, Svix webhook secret
- `infra/` — domain registrar, DNS provider, GitHub PAT (for CI)
- `oncall/` — pager rotation contacts, escalation list
- `recovery/` — root account recovery codes, emergency-access PINs

Each item: `name`, `username`, `password`, `URL`, `notes` (include rotation cadence + owner). Tag with vertical: `prod`, `staging`, `dev`.

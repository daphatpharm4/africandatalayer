# Beads (bd) — Project Issue Tracker Guide

> Persistent issue tracker for African Data Layer. Replaces `TodoWrite`, markdown TODO files, and ad-hoc notes. Survives context compaction, sessions, and machine switches via Dolt sync.

**Project prefix**: `africandatalayer-` (issues look like `africandatalayer-001`)
**Binary**: `/Users/charlesvictormahouve/.local/bin/bd` — version 1.0.3
**Database**: `.beads/embeddeddolt/` (versioned), `.beads/interactions.jsonl` (memory log)

---

## 1. Why Beads

| Problem | Beads Solution |
|---------|----------------|
| `TodoWrite` lost on `/clear` or compaction | Persisted in `.beads/` |
| Markdown TODO files drift, no status | Structured: status, deps, priority |
| Memory fragments across machines | Dolt push/pull syncs across sessions |
| No dependency awareness | `bd ready` only shows unblocked work |
| Lost context after compaction | `bd prime` restores it |

**Rule**: Use `bd` for ALL task tracking. Do NOT use `TodoWrite`, `TaskCreate`, or markdown checklists for work-tracking on this repo.

---

## 2. Session Start — Always Run First

```bash
bd prime          # Restore project context (auto-runs in Claude Code via hook)
bd ready          # Show unblocked, ready-to-work issues
bd list --status=in_progress   # Show what was mid-flight
```

If `bd prime` did not auto-run after `/clear` or compaction → run it manually.

---

## 3. Core Workflow

### 3a. Before writing code

Create issue first. Code without an issue = orphan work.

```bash
bd create \
  --title="Fix EXIF fraud check false-positive on iPhone 15" \
  --description="iPhone 15 Pro returns rotated EXIF orientation that current parser flags as tampered. Repro: upload photo from iPhone 15 → fraud score >0.8." \
  --type=bug \
  --priority=1 \
  --acceptance="iPhone 15 photos pass fraud check; existing fraud cases still flagged." \
  --validate
```

Field cheat sheet:

| Flag | Values | Notes |
|------|--------|-------|
| `--type` | `bug` / `feature` / `task` / `epic` / `chore` | Required |
| `--priority` | `0`–`4` or `P0`–`P4` | 0=critical, 2=medium, 4=backlog. NOT "high"/"medium"/"low" |
| `--description` | free text | The "why" — required for `--validate` |
| `--acceptance` | free text | Measurable done criteria |
| `--design` | free text | Architecture/approach decisions |
| `--notes` | free text | Supplementary context |
| `--validate` | flag | Reject if required sections missing |
| `--assignee` | username | Optional |

### 3b. Claim and start

```bash
bd update africandatalayer-007 --claim       # Assign to self + status=in_progress
bd show africandatalayer-007                  # Read full context
```

### 3c. Update mid-flight

```bash
bd update africandatalayer-007 --notes="Found root cause in lib/server/submissionFraud.ts:142 — orientation tag 6 mishandled."
bd update africandatalayer-007 --design="Decision: normalize orientation BEFORE hashing, not after."
```

### 3d. Close on completion

```bash
bd close africandatalayer-007                                # Single
bd close africandatalayer-007 africandatalayer-008           # Batch (preferred)
bd close africandatalayer-007 --reason="Superseded by africandatalayer-012, scope changed."
bd close africandatalayer-007 --suggest-next                  # Show newly unblocked work
```

---

## 4. Finding Work

```bash
bd ready                          # Unblocked, ready-to-claim
bd list --status=open              # Everything open
bd list --status=in_progress       # Active
bd list --priority=0               # Criticals
bd blocked                         # Stuck issues + what blocks them
bd search "fraud"                  # Keyword search across all issues
bd show africandatalayer-007       # Full detail
```

---

## 5. Dependencies

Beads enforces dependency-aware queues. `bd ready` hides blocked work.

```bash
# africandatalayer-009 depends on africandatalayer-008 finishing first
bd dep add africandatalayer-009 africandatalayer-008

# View graph for an issue
bd show africandatalayer-009    # Shows blockers + blockees
```

**ADL pattern**: parent epic → feature children → task grandchildren.

```bash
bd create --title="Image-similarity fraud (Stages A-D)" --type=epic --priority=1
# returns africandatalayer-020

bd create --title="Stage A: pHash baseline" --type=feature --priority=1
bd create --title="Stage B: ORB descriptor match" --type=feature --priority=2
bd create --title="Stage C: model service" --type=feature --priority=2

bd dep add africandatalayer-021 africandatalayer-020   # Stage A child of epic
bd dep add africandatalayer-022 africandatalayer-021   # Stage B blocked by A
bd dep add africandatalayer-023 africandatalayer-022   # Stage C blocked by B
```

> **Tip**: For many issues at once, dispatch parallel subagents — each runs one `bd create` — far faster than serial.

---

## 6. Memory (`bd remember`) — Persistent Knowledge

Replaces `MEMORY.md`, scratch notes, "todo: remember to…" lines.

```bash
bd remember "Fraud threshold env vars live in lib/server/submissionFraud.ts:24-38. Default FRAUD_GPS_VELOCITY_MAX=140 km/h."

bd memories fraud                     # Search by keyword
bd memories --recent 20                # Last 20 memories
```

**When to remember**:
- Hidden constraints ("X is gated by Y env var")
- Past incidents ("we burned an afternoon on Z; root cause was W")
- Non-obvious decisions ("we picked pg over Drizzle because…")
- Cross-cutting facts that don't belong in code comments

**When NOT to remember**: anything findable via `git log`, `grep`, or reading code.

---

## 7. Health, Hygiene, Lifecycle

```bash
bd stats                              # Open/closed/blocked counts
bd doctor                             # Sync issues, missing hooks
bd doctor --check=conventions          # Lint, stale, orphan checks
bd lint                               # Issues missing required sections
bd stale                              # No activity recently
bd orphans                            # Broken dep chains
bd preflight                          # Pre-PR audit (lint + stale + orphans)
bd defer africandatalayer-019 --until="2026-06-01"
bd supersede africandatalayer-013 --with=africandatalayer-027
bd human africandatalayer-013          # Flag for human decision
```

---

## 8. Sync (Dolt) — Cross-Session, Cross-Machine

The `.beads/embeddeddolt/` is a Dolt database committed alongside source. Auto-commits on most `bd` writes.

```bash
bd dolt push           # Push beads DB to remote (run before normal git push)
bd dolt pull           # Pull remote beads changes
```

**Session close ordering** (mandatory per CLAUDE.md):

```bash
git pull --rebase
bd dolt push
git push
git status             # Must show "up to date with origin"
```

If you `git push` without `bd dolt push`, teammates and future-you will see stale issues.

---

## 9. Anti-Patterns

| Don't | Do instead |
|-------|------------|
| `TodoWrite` for work | `bd create` |
| `MEMORY.md` for facts | `bd remember` |
| `bd edit <id>` | `bd update <id> --notes/--design/--description=…` (`edit` opens vim, blocks the agent) |
| `--priority=high` | `--priority=1` (numeric only) |
| `git add -A` after `bd` writes | Add specific paths; `.beads/embeddeddolt/` auto-commits |
| Skipping `bd dolt push` | Always push beads BEFORE `git push` |
| Closing an issue with no diff | Either commit the work or close `--reason=` to explain |
| One mega-issue with 12 tasks | Epic + child features + task grandchildren |

---

## 10. Common ADL Workflows

### Start a feature

```bash
bd create --title="Vertical: census proxy capture" --type=feature --priority=2 \
  --description="Add 8th vertical for census proxy points. Field schema below." \
  --acceptance="Agent can capture+sync census proxy. Admin queue shows them. Risk scoring runs." \
  --design="Schema in shared/verticals.ts; API in api/submissions; UI step in ContributionFlow.tsx."
bd update africandatalayer-XXX --claim
```

### Triage a bug from production

```bash
bd create --title="Submission upload 500 on iOS 17 Safari" --type=bug --priority=0 \
  --description="Sentry: TypeError: …  Repro on iPhone 12 / iOS 17.4."
bd update africandatalayer-XXX --claim
```

### Review pause — handing off mid-flight

```bash
bd update africandatalayer-XXX --notes="Stopped at lib/server/submissionRisk.ts:88. Next: wire trustTier into score, add test."
# Don't close — leave status=in_progress so next session resumes via bd ready
git add . && git commit -m "wip: africandatalayer-XXX in progress" && bd dolt push && git push
```

### End of session

```bash
bd preflight                          # Audit
bd close $(bd list --status=in_progress --done)  # If actually done
bd dolt push
git add -p && git commit -m "…"
git push
```

---

## 11. Reference Card

```bash
bd prime                  # Restore context (run after compact/clear)
bd ready                  # What's next
bd list --status=…        # Filter by status
bd show <id>              # Detail
bd create …               # New issue (use --validate)
bd update <id> --claim    # Take it
bd update <id> --notes=…  # Annotate
bd close <id> [<id>…]     # Done
bd dep add A B            # A blocked by B
bd remember "fact"        # Persistent memory
bd memories <q>           # Recall
bd stats / doctor / preflight
bd dolt push / pull       # Sync
```

---

## 12. Rules of Thumb (ADL-specific)

1. **Issue first, code second**. If there's no `africandatalayer-NNN`, the work is invisible.
2. **Priority 0 = drop everything**. Reserve for prod outages, security, data loss.
3. **Workspace-relative paths in descriptions**: `api/submissions/index.ts:816` — never leading `/`. (Per CLAUDE.md.)
4. **One issue per concern**. Don't pile fraud + UI + DB migration into one issue.
5. **Close with evidence**. Either commit SHA, PR link, or `--reason=` line.
6. **Memories are durable**. Don't memorize today's commit hash; do memorize "we picked X because Y."
7. **`bd dolt push` before `git push`**. Always. Issue state is part of the codebase now.

---

## 13. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `bd: command not found` | `which rtk` collision check; PATH must include `~/.local/bin` |
| `bd ready` empty but work exists | All blocked — run `bd blocked` |
| Can't create issue, "validation failed" | Add `--description` + `--acceptance`, or drop `--validate` |
| Beads state diverges from teammate | `bd dolt pull` then resolve in Dolt |
| `bd edit` hangs | Kill it. Use `bd update <id> --notes=…` instead — never `edit` |
| Lost issues after `/clear` | `bd prime` then `bd list --status=open` |

---

**Bottom line**: `bd ready` at start, `bd create` before code, `bd close` after, `bd dolt push` before `git push`. That's the loop.

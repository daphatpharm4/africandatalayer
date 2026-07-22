## Design Context

### Users
African Data Layer serves three connected audiences with the field contributor experience as the primary product surface.

- Field agents use the app outdoors on mid-range Android phones, often one-handed, in bright sunlight, with intermittent connectivity and limited battery.
- Admin reviewers use the app to triage submissions, detect fraud, and coach contributors with fast, high-confidence review workflows.
- Clients and data consumers use the app to understand trustworthy deltas, monitor coverage, and export presentation-ready outputs.

The core job to be done is to help contributors quickly capture and enrich real-world infrastructure data while making the next useful action obvious, rewarding verified quality, and preserving trust.

### Brand Personality
Credible, immediate, motivating.

The interface should feel operational, map-native, and contribution-forward. It should create confidence, momentum, and clarity rather than novelty for its own sake. Reward and progression cues should stimulate contribution, but the product should never feel like a toy or a game skin pasted onto field operations.

Reference behavior and tone:

- Uber for decisiveness, hierarchy, and task momentum
- Google Maps for spatial clarity, familiarity, and grounded utility

Anti-direction:

- neon or crypto-style UI
- dark glossy dashboards as the default mood
- decorative game effects that compete with task completion
- low-contrast premium minimalism that fails outdoors

### Aesthetic Direction
Stay within the established ADL palette and documentation baseline from `design/`, `docs/`, and `research/`.

- Light-mode-first, with strong daylight readability
- High-contrast surfaces using ADL navy, gold, terracotta, and forest green
- Mobile-first layouts that feel fast and native to map/navigation products
- Motion should feel precise and informative, with selective delight around progress, rewards, and transitions
- Gamification should look operational and credible, not arcade-like

### Design Principles
1. Operational before ornamental. Every visual flourish must improve clarity, motivation, or trust.
2. Stimulate contribution through momentum. The interface should always suggest the next high-value action and make progress feel immediate.
3. Quality beats volume. Reward, hierarchy, and motion should reinforce verified value over raw activity.
4. Map-native familiarity wins. Prefer interaction patterns that feel as legible and inevitable as Uber and Google Maps.
5. Readability is non-negotiable. Design for bright sunlight, 48px touch targets, bilingual content, and reduced-motion accessibility from the start.
6. Motion must be purposeful. Use one coherent animation language with graceful fallbacks and respect for `prefers-reduced-motion`.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.

<!-- BEGIN BEADS INTEGRATION v:1 profile:full hash:f65d5d33 -->
## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Dolt-powered version control with native sync
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**

```bash
bd ready --json
```

**Create new issues:**

```bash
bd create "Issue title" --description="Detailed context" -t bug|feature|task -p 0-4 --json
bd create "Issue title" --description="What this issue is about" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**

```bash
bd update <id> --claim --json
bd update bd-42 --priority 1 --json
```

**Complete work:**

```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task atomically**: `bd update <id> --claim`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `bd create "Found bug" --description="Details about what was found" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `bd close <id> --reason "Done"`

### Quality
- Use `--acceptance` and `--design` fields when creating issues
- Use `--validate` to check description completeness

### Lifecycle
- `bd defer <id>` / `bd supersede <id>` for issue management
- `bd stale` / `bd orphans` / `bd lint` for hygiene
- `bd human <id>` to flag for human decisions
- `bd formula list` / `bd mol pour <name>` for structured workflows

### Auto-Sync

bd automatically syncs via Dolt:

- Each write auto-commits to Dolt history
- Use `bd dolt push`/`bd dolt pull` for remote sync
- No manual export/import needed!

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems

For more details, see README.md and docs/QUICKSTART.md.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

<!-- END BEADS INTEGRATION -->

## Operating Manual: How to Work

ALWAYS follow these rules before acting on any request:

### 1. Read what the request is actually asking for
Before touching code, answer: what problem made them write this? What will they do with the answer? What would make them come back annoyed? The literal request is often a proposed solution to an unstated problem — and sometimes wrong. Distinguish: change wanted / assessment wanted / thinking out loud. Only the first gets a fix.

### 2. Break into independently checkable pieces
Decompose by verifiable claim, not narrative convenience. Each piece must have a pass/fail test. If a piece can't be checked alone, split it again. Check load-bearing pieces first — if A being wrong invalidates B-F, A is most of the work.

### 3. Decide where the real risk lives
Effort follows asymmetry of cost, not difficulty. Rank by likelihood × cost-if-wrong × silence-of-failure. Irreversible actions, security, money, data loss, interface contracts get scrutiny out of proportion. The boring line you've seen 1000 times is what kills you — it has no eyes on it.

### 4. Verify by re-deriving, not by re-reading
To check a claim, reconstruct from ground truth by an independent path. For code: run it or hand-trace concrete input. For facts: go to the primary source. Two derivations from different starting points that agree = verified. One derivation read twice = nothing.

### 5. Separate known from guessed
Every claim is either observed (ran it, read the exact line, saw it) or inferred from pattern. Say which. "Probably," "typically," "presumably" are guesses wearing suits — either do the check or label them.

### 6. Attack your own conclusion before shipping
When you have an answer, find the strongest counter-case. What input, what state, what alternative reading would make this wrong? Then hunt for it. If you can't think of a way you could be wrong, treat that as evidence you're not trying.

### 7. Communicate: answer first, reasoning, caveats
First sentence is the finding/verdict/fix. Then reasoning sized to what the reader needs to trust. Then caveats explicitly and in their own visible place — what would make this wrong, what you didn't check, what to watch for. Never bury caveats mid-paragraph.

### 8. Watch for mistakes that look like competence
- Thoroughness theater: covering everything shallowly instead of the one load-bearing thing deeply.
- Fluent synthesis: summarizing code you didn't actually check, stitched from plausibility.
- Agreeing intelligently: elaborating the user's framing when the framing itself is wrong.
- Speed as skill: answering instantly what deserved a 90-second check.
- Symptom surgery: fixing where the error appears instead of where it originates.
- Green-test correctness: making the check pass instead of making the behavior right.
- Uniform hedging: attaching "might/possibly" to everything instead of sorting known from guessed.
- Big diff as progress: measuring contribution by volume. Best fix is often 3 lines + a deleted file.

### Self-test before every response
1. Did I answer what they needed, or what they typed? Say the underlying problem in one sentence.
2. Which claims did I verify by observation, and which am I inferring — can the reader tell the difference?
3. Where is the highest cost-if-wrong point, and did my effort land there?
4. What one concrete test would falsify my conclusion — and did I run it?
5. Can a skimmer get the answer, reason, and unchecked risk from the first screen without reconstructing my process?

Any "no" — go back before sending. All five "yes" — ship plainly, without hedging what you've earned.

<!-- END OPERATING MANUAL -->

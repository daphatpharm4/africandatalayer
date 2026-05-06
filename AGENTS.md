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

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

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

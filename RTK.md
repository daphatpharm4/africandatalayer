# Repository Task Kit

This file defines the default operating rules for agents working in this repository.

## First Principles

- Preserve user work. Do not revert, overwrite, or clean unrelated local changes unless explicitly asked.
- Keep changes scoped to the active request and the smallest reasonable set of files.
- Prefer existing project patterns over new abstractions.
- For UI work, follow the ADL design context in `AGENTS.md`: light-mode-first, map-native, contribution-forward, daylight-readable, and operational before ornamental.

## Exploration Order

1. Use the code-review graph before text search when exploring code.
2. Use `semantic_search_nodes`, `query_graph`, `get_impact_radius`, or `detect_changes` for structural context.
3. Fall back to `rg` and targeted file reads only when the graph does not cover the needed files, static assets, or docs.
4. Avoid broad scans when a graph query or narrow `rg` pattern will answer the question.

## Issue Tracking

- Use `bd` for task tracking.
- Check ready work with `bd ready --json` when starting from an open-ended request.
- Create or claim a bead for implementation work.
- Close the bead with a concrete reason after verification.
- Do not add markdown TODO lists as a substitute for `bd`.

## Implementation

- Use `apply_patch` for manual file edits.
- Keep generated/build artifacts out of commits unless the repository explicitly tracks and requires them.
- Do not stage unrelated files. In this repo, common unrelated noise includes `.DS_Store` and duplicate files ending in ` 2`.
- If a command fails because of sandbox, network, or permission restrictions and it is required for the task, rerun it with the appropriate escalation request.

## Verification

- Run the smallest useful quality gate for the change.
- For frontend or shared startup changes, prefer `npm run build` at minimum.
- Use code-review graph impact or change detection before finalizing code changes.
- Report any known test gaps clearly.

## Completion

- Commit scoped changes on the intended branch.
- Before pushing, run `git pull --rebase --autostash` when unrelated local changes would otherwise block the pull.
- Run `bd dolt push`; if no Dolt remote is configured, record that it skipped.
- Push git changes to the configured remote.
- Finish only after `git status --short --branch` confirms the branch is up to date with origin, allowing for explicitly unrelated local changes.

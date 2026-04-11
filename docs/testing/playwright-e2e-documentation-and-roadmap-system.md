# Playwright E2E, Documentation Capture, And Role Roadmap System

**Status:** documented for implementation and repository rollout  
**Owner lens:** `document-generator` + `senior-project-manager`  
**Primary goal:** use one Playwright system to test ADL, generate screenshots for product documentation, record walkthrough evidence, and produce role-specific journey assets that can be reused in internal QA, onboarding, sales, and client reporting.

## 1. Why This Exists

ADL now has three distinct product audiences:

- field agents on mobile, often outdoors and bandwidth-constrained
- admin reviewers working through triage and fraud-sensitive queue operations
- clients consuming dashboards, maps, exports, and spatial intelligence

Those surfaces need more than unit tests.

They need:

- regression coverage for critical user-visible behavior
- deterministic screenshots for documentation
- replayable walkthrough artifacts for reviews and demos
- role-based storyboards that explain the product clearly to buyers, operators, and internal teams

Playwright is the right system because it combines:

- browser automation
- network mocking
- screenshots
- video
- trace capture
- multi-project execution for different browsers, devices, and roles

This is not only a testing upgrade. It is an operating system for evidence.

## 2. Business Outcome

The target output is not just "tests pass."

The target output is a reusable evidence pipeline that can produce:

- engineering smoke checks before shipping
- release screenshots for documentation
- role walkthroughs for onboarding
- feature proof for investor and buyer conversations
- visual QA bundles for bug triage
- client-facing storyboards showing exactly how ADL works

For ADL, that matters because the product is visual, operational, and role-dependent. A static spec is weaker than a tested, captured, replayable product flow.

## 3. Why Playwright Fits ADL Specifically

ADL is not a simple route-per-page CRUD web app.

Current repo realities:

- role branching happens in client state inside `App.tsx`
- navigation differs by `agent` vs `client`
- admin-only views are gated by role
- map surfaces rely on Leaflet and spatial context
- dashboard flows depend on multiple API calls
- sign-up alone does not create every role needed for testing

That means browser automation needs to be:

- role-aware
- data-aware
- deterministic
- resilient to changing backend state

Playwright supports this well because the official docs recommend:

- testing user-visible behavior
- using resilient locators
- isolating tests
- reusing setup where appropriate
- mocking data you do not control

Reference docs:

- `https://playwright.dev/docs/intro`
- `https://playwright.dev/docs/best-practices`
- `https://playwright.dev/docs/codegen`
- `https://playwright.dev/docs/test-projects`
- `https://playwright.dev/docs/auth`
- `https://playwright.dev/docs/screenshots`
- `https://playwright.dev/docs/videos`
- `https://playwright.dev/docs/trace-viewer-intro`

## 4. Product Constraints This System Must Respect

### Operational constraints

- agent flows must be validated in a mobile profile
- map-centric screens must be testable without depending on live third-party tile behavior
- admin flows must remain stable even when queue data changes elsewhere
- client dashboard screenshots must look presentation-ready and deterministic

### Design constraints

- mobile-first for primary field flows
- high-contrast daylight-readable output
- role-aware documentation, not generic app screenshots
- documentation images should reflect the real ADL visual language

### Engineering constraints

- the repo currently has no Playwright scaffold
- the app is Vite-based
- the app fetches data through `fetch` wrappers in `lib/client/api.ts`
- existing backend and auth state are not reliable enough for repeatable visual capture

That last point is critical.

This implementation should not depend on mutable staging data or on manually maintained role credentials.

## 5. Core Strategy

We will implement Playwright as four layers.

### Layer A: stable browser test harness

Purpose:

- start the app locally
- run browser tests against a consistent base URL
- separate mobile and desktop execution
- collect screenshots, traces, and videos

### Layer B: role-aware deterministic fixtures

Purpose:

- model `agent`, `admin`, and `client` sessions without fragile manual login
- mock `/api/**` responses with controlled fixture data
- guarantee that screenshots and assertions are reproducible

### Layer C: journey tests

Purpose:

- validate the highest-value flows by audience
- confirm that the next useful action remains obvious
- verify map, queue, dashboard, and export surfaces in a user-visible way

### Layer D: documentation and roadmap capture

Purpose:

- turn test runs into reusable PNG, video, and trace artifacts
- capture screenshots at named milestones
- produce repeatable role-based storyboards

## 6. What Will Be Implemented

### Testing outputs

- smoke tests for core role journeys
- visual capture tests for documentation
- reusable route-mocking helpers
- common role fixtures

### Documentation outputs

- explicit `@docs` Playwright suite
- named screenshot outputs per role and milestone
- repository documentation that explains how to run and reuse artifacts

### Walkthrough outputs

- recorded journey traces
- optional video capture
- role-based screenshot series that can be inserted into product docs and presentations

## 7. Why Fixture-Driven Testing Is The Right Choice Here

There are two ways to test this app with Playwright:

1. fully against a real backend with real credentials
2. against deterministic mocked responses

For ADL, the second model should be the default.

Reasons:

- `client` is not a normal self-serve sign-up role
- admin queue data changes over time
- leaderboard and analytics fluctuate
- map and dashboard visuals become non-deterministic when API data shifts
- documentation screenshots should not drift between runs

Playwright best practices also explicitly support mocking what you do not control. In this repo, the correct interpretation is broader than "third-party APIs." It includes any backend state that is too unstable for repeatable docs and visual regression.

Real-backend testing can still exist later as a separate environment-specific suite, but the baseline system should be deterministic first.

## 8. Testing Model By Role

### Agent roadmap

Primary objective:

- verify that a contributor can orient, inspect nearby points, move toward contribution, and manage pending work

Primary sequence:

1. load splash or skip if marked seen
2. land on home map in mobile mode
3. verify point loading and spatial context
4. open a point detail
5. move into contribution flow or queue
6. verify profile / analytics access remains coherent

Documentation milestones:

- `01-agent-home-list.png`
- `02-agent-point-detail.png`
- `03-agent-contribution-entry.png`
- `04-agent-leaderboard.png`

### Admin roadmap

Primary objective:

- verify that reviewers can triage queue items, inspect evidence, and understand assignment context quickly

Primary sequence:

1. enter admin state
2. open analytics access path
3. load admin queue
4. verify review queue list and selected detail panel
5. verify assignment and automation context blocks

Documentation milestones:

- `01-admin-analytics-entry.png`
- `02-admin-review-queue.png`
- `03-admin-assignments.png`
- `04-admin-automation.png`

### Client roadmap

Primary objective:

- verify that a client can open the delta dashboard, inspect spatial intelligence, focus a top cell, and understand the map-backed narrative

Primary sequence:

1. enter client state
2. land on delta dashboard
3. verify KPI and trend sections
4. verify spatial intelligence panel
5. focus a top cell
6. verify map overlay and selected-cell detail
7. verify export affordance exists

Documentation milestones:

- `01-client-dashboard-overview.png`
- `02-client-pharmacy-story.png`
- `03-client-top-cell-map.png`
- `04-client-export-surface.png`

## 9. What Counts As A Passing Test

Tests should assert user-visible behavior, not implementation internals.

Good assertions:

- navigation labels are visible
- key screen titles or summaries appear
- the expected role-specific action is available
- the selected cell summary appears after focus
- the review queue is populated
- the dashboard narrative renders

Weak assertions:

- arbitrary CSS class names
- brittle DOM depth
- implementation-specific component names
- assumptions about third-party tile rendering

## 10. Map Testing Policy

Map testing deserves explicit rules.

### We should assert

- map container is present
- ADL-owned overlays render
- selected cell summaries and labels update
- spatial panel and map stay in sync
- key narrative strings appear

### We should avoid asserting

- pixel-perfect third-party map tiles
- network timing for external tile servers
- exact screenshot baselines for remote tiles

For stable docs screenshots:

- capture the composed ADL UI
- prefer overlay-focused screenshots and dashboard regions
- keep full-map screenshots as curated evidence, not brittle visual regression assertions

## 11. Artifact Model

Each Playwright run can produce four classes of output.

### A. Test results

- pass/fail output
- HTML report
- terminal summary

### B. Debug evidence

- traces
- videos
- failure screenshots

### C. Documentation assets

- named PNG files for each roadmap step

### D. Presentation-ready capture

- curated desktop and mobile images suitable for proposals, reports, and walkthrough decks

## 12. Output Directory Convention

The system should separate debug artifacts from reusable docs assets.

Recommended convention:

- `playwright-report/`
- `test-results/`
- `artifacts/playwright/docs/agent/`
- `artifacts/playwright/docs/admin/`
- `artifacts/playwright/docs/client/`

This keeps:

- machine-generated reports in Playwright defaults
- documentation assets in a stable human-usable location

## 13. File Plan

The implementation should create and maintain the following baseline structure.

```text
playwright.config.ts
e2e/
  fixtures/
    auth.ts
    mockApi.ts
    roles.ts
    screenshots.ts
  mocks/
    agent.ts
    admin.ts
    client.ts
  smoke/
    agent.smoke.spec.ts
    admin.smoke.spec.ts
    client.smoke.spec.ts
  docs/
    agent-roadmap.spec.ts
    admin-roadmap.spec.ts
    client-roadmap.spec.ts
```

Optional later additions:

- `e2e/page-objects/`
- `e2e/visual/`
- `e2e/a11y/`

## 14. Config Design

The config should do the following:

- run against the Vite app using Playwright `webServer`
- define `baseURL`
- capture traces on retry
- enable screenshot and video support
- separate desktop and mobile projects
- keep retries stricter in CI

Recommended project model:

- `agent-mobile`
- `admin-desktop`
- `client-desktop`

This is more useful than a generic browser-only matrix for the first implementation because ADL’s risk is role behavior first, browser variation second.

Cross-browser projects can be added once the role suite is stable.

## 15. Mocking Design

The mocking layer should:

- intercept `/api/auth/session`
- return a role-specific session object
- intercept the role’s required API endpoints
- provide stable JSON payloads from local mock modules

Examples:

- `agent` should mock `/api/submissions`, `/api/user?view=assignments`, and `/api/leaderboard` when needed
- `admin` should mock review queue, assignment context, and automation leads
- `client` should mock dashboard snapshots, anomalies, trends, deltas, and spatial intelligence

This keeps tests:

- fast
- deterministic
- offline-friendly
- presentation-ready

## 16. Authentication Design

We will not depend on manual credentials for the baseline suite.

Instead, the Playwright fixture will do two things:

1. seed the browser with local storage values that simplify startup
2. fulfill `/api/auth/session` with the role-specific authenticated session

This matches the app’s actual session-loading behavior while staying deterministic.

Local storage keys already used by the app include:

- `adl_splash_seen`
- `adl_has_authenticated`
- `adl_language`

Those should be seeded consistently per test before app initialization.

## 17. Screenshot Design

Documentation screenshots should not be random captures from arbitrary steps.

Each capture should have:

- a stable filename
- a stable viewport
- a stable language
- a stable role
- a stable mocked data set

Naming convention:

- `01-agent-home-map.png`
- `02-agent-point-detail.png`
- `03-agent-contribution-entry.png`

Capture rules:

- use full-page only when the whole surface matters
- use locator screenshots for focused panels and cards
- keep naming human-readable and ordered
- do not overwrite unrelated role artifacts

## 18. Walkthrough And Roadmap Design

Each roadmap is a curated role journey.

It is not only a test file.

It is a reusable narrative asset that answers:

- where does the user start
- what is the first meaningful action
- what does ADL show as proof of value
- what is the next obvious action
- what should a reviewer, buyer, or teammate understand from this sequence

This means roadmap tests should capture milestone states, not only final assertions.

## 19. Relationship To Sales And Monetization

This system directly supports monetization.

Because once it exists, ADL can repeatedly generate:

- client-specific walkthrough packs
- role-based training packets
- investor/product proof screenshots
- before/after release evidence
- visual appendices for neighborhood intelligence reports

Example monetizable use:

- client requests a Bonamoussadi intelligence brief
- ADL exports dashboard and spatial intelligence images
- ADL adds curated screenshots of top-cell drilldown
- ADL includes those in a PDF or PPTX generated through the document pipeline

That is materially stronger than a text-only report.

## 20. Relationship To Documentation

The role roadmap suite should feed:

- internal runbooks
- onboarding docs
- release notes
- proposals and pitch materials

This is why the documentation capture tests should be tagged and runnable independently from smoke tests.

Recommended command split:

- `test:e2e`
- `test:e2e:ui`
- `test:e2e:docs`
- `test:e2e:headed`
- `test:e2e:update`

## 21. Initial Acceptance Criteria

Phase 1 should be considered complete when all of the following are true.

- Playwright is installed and runnable in the repo
- one command starts the app and runs the browser suite
- role-aware fixtures exist for `agent`, `admin`, and `client`
- smoke tests exist for each role
- roadmap capture tests exist for each role
- documentation screenshots are written to a stable artifact directory
- traces and videos are available for debugging
- at least one test run completes locally and produces artifacts

## 22. Non-Goals For Phase 1

Do not overbuild the first version.

Phase 1 does not require:

- full cross-browser matrix
- exhaustive visual snapshot baselines across every screen
- live backend credential orchestration
- PDF generation from Playwright artifacts
- Storybook integration
- Percy or third-party visual testing services

Those can come later.

The first implementation should prioritize:

- deterministic role journeys
- useful screenshots
- useful traces
- useful smoke coverage

## 23. Implementation Sequence

### Step 1

Add Playwright packages, config, scripts, and folder structure.

### Step 2

Create role and API mock fixtures.

### Step 3

Add smoke tests for the main role journeys.

### Step 4

Add `@docs` roadmap capture tests.

### Step 5

Run locally and verify:

- tests pass
- screenshots are saved
- reports open
- traces are useful

### Step 6

Refine selectors where the app needs stronger accessibility or test contracts.

## 24. Selector Policy

Prefer, in order:

1. roles
2. visible text
3. labels
4. explicit `data-testid`

If major surfaces are hard to target reliably, we should add minimal `data-testid` attributes to the app for:

- role shell roots
- screen-level containers
- primary dashboard sections
- spatial intelligence section
- review queue region

That is acceptable because those are stable product contracts, not styling details.

## 25. Risks And Mitigations

### Risk: flaky screenshots because of remote tiles

Mitigation:

- avoid strict visual assertions on remote map tiles
- focus assertions on ADL overlays and surrounding panels

### Risk: role flows drift because backend data changes

Mitigation:

- use local Playwright route mocks as the default suite

### Risk: screenshots are generated but not reusable

Mitigation:

- define naming convention and artifact directory up front

### Risk: tests become too implementation-specific

Mitigation:

- enforce user-visible locator policy
- add a few strategic `data-testid` attributes only where needed

## 26. Final Standard

The system is successful if a developer, PM, designer, or seller can do all of the following without special setup:

- run browser smoke tests
- capture the current agent journey
- capture the current admin workflow
- capture the current client dashboard and spatial drilldown
- inspect a failure using traces
- reuse the generated screenshots in docs or presentations

That is the standard this implementation should meet.

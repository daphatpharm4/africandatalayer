export type DocsAudience = 'public' | 'client' | 'agent' | 'admin';
export type DocsTone = 'navy' | 'forest' | 'terra' | 'gold';
export type DocsVisualCoverage = 'captured' | 'text-only';

export interface DocsMetric {
  label: string;
  value: string;
  tone: DocsTone;
}

export interface DocsWorkflow {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  screenIds: string[];
}

export interface DocsRunbookGroup {
  title: string;
  items: string[];
}

export interface DocsScreenshot {
  src: string;
  alt: string;
  caption: string;
}

export interface DocsScreen {
  id: string;
  title: string;
  surface: string;
  audiences: DocsAudience[];
  entryPoint: string;
  summary: string;
  whyItMatters: string;
  primaryActions: string[];
  keySignals: string[];
  screenshots: DocsScreenshot[];
}

export interface DocsSection {
  slug: DocsAudience;
  title: string;
  navLabel: string;
  subtitle: string;
  intro: string;
  highlights: string[];
  metrics: DocsMetric[];
  workflows: DocsWorkflow[];
  screenIds: string[];
  evidenceScreenIds: string[];
  runbook: DocsRunbookGroup[];
}

export interface DocsSearchResult {
  id: string;
  kind: 'screen' | 'workflow' | 'highlight';
  audience: DocsAudience;
  audienceTitle: string;
  title: string;
  description: string;
  path: string;
}

const docsImage = (role: string, fileName: string, caption: string): DocsScreenshot => ({
  src: `/docs-media/${role}/${fileName}`,
  alt: caption,
  caption,
});

const SCREEN_LIBRARY: Record<string, DocsScreen> = {
  'splash-onboarding': {
    id: 'splash-onboarding',
    title: 'Splash and role onboarding',
    surface: 'Shared entry',
    audiences: ['public', 'client', 'agent', 'admin'],
    entryPoint: 'App launch before first authenticated session',
    summary: 'Introduces the contribution mission and routes each audience into the right operating surface.',
    whyItMatters: 'Sets task momentum early and avoids dumping field users into a dense map without context.',
    primaryActions: [
      'Choose the right starting path for field, client, or review work.',
      'Set the expectation that ADL is map-native and trust-driven.',
      'Hand off to authentication or the default home surface.',
    ],
    keySignals: [
      'Role framing',
      'Mission explanation',
      'Fast transition to the first useful screen',
    ],
    screenshots: [],
  },
  'auth-sign-in': {
    id: 'auth-sign-in',
    title: 'Authentication',
    surface: 'Shared account access',
    audiences: ['public', 'client', 'agent', 'admin'],
    entryPoint: 'Bottom navigation or protected action such as Contribute',
    summary: 'Handles sign-in and sign-up before protected capture, profile, or client surfaces become available.',
    whyItMatters: 'The app needs account trust before it can score contributors, assign work, or unlock exports.',
    primaryActions: [
      'Create an account or return to an existing session.',
      'Resume the screen the user intended to access.',
      'Persist role-aware navigation after authentication succeeds.',
    ],
    keySignals: [
      'Existing vs new session mode',
      'Fast completion callback',
      'Return-to-screen behavior',
    ],
    screenshots: [],
  },
  'home-explorer': {
    id: 'home-explorer',
    title: 'Home explorer list',
    surface: 'Shared map explorer',
    audiences: ['agent', 'client', 'admin'],
    entryPoint: 'Bottom navigation -> Explore or Map',
    summary: 'Shows filtered nearby points, mission cards, and the next best capture task when users are in the field.',
    whyItMatters: 'This is the default operating surface for discovery, prioritization, and one-handed field work.',
    primaryActions: [
      'Switch categories such as pharmacy, fuel, and mobile money.',
      'Open an existing point for detail or enrichment.',
      'Launch a new contribution or batch capture from the floating action.',
    ],
    keySignals: [
      'Map scope and geofence state',
      'Points in view and enrichment opportunities',
      'Mission card prompts and assignment context',
    ],
    screenshots: [
      docsImage('agent', '01-agent-home-list.png', 'Agent list explorer with field-ready mission prompts.'),
    ],
  },
  'home-map': {
    id: 'home-map',
    title: 'Home explorer map',
    surface: 'Shared map explorer',
    audiences: ['agent', 'client', 'admin'],
    entryPoint: 'Home explorer -> Map toggle',
    summary: 'Displays clustered points, heatmap overlays, and scope-aware geofencing on top of Leaflet.',
    whyItMatters: 'This is the visual bridge between raw points and spatial story telling, especially for top-cell analysis.',
    primaryActions: [
      'Pan and zoom through Bonamoussadi or larger unlocked scopes.',
      'Inspect cluster density and switch the heatmap on or off.',
      'Tap a map point to move into detail or reporting flows.',
    ],
    keySignals: [
      'Cluster count and density',
      'Heatmap activation',
      'Geofence messaging such as Bonamoussadi lock vs full access',
    ],
    screenshots: [
      docsImage('agent', '02-agent-home-map.png', 'Agent map explorer with clusters and field overlays.'),
      docsImage('client', '05-client-map-explorer.png', 'Client map explorer for spatial context outside the dashboard.'),
    ],
  },
  'point-detail': {
    id: 'point-detail',
    title: 'Point detail',
    surface: 'Shared point inspection',
    audiences: ['agent', 'client', 'admin'],
    entryPoint: 'Tap a point from the explorer list or map',
    summary: 'Presents a point record with trust score, freshness, category-specific fields, and enrich actions.',
    whyItMatters: 'Users need a fast explanation of why a point is trustworthy before they decide to update or report it.',
    primaryActions: [
      'Review trust, availability, and category-specific attributes.',
      'Trigger enrichment on an existing point.',
      'Jump into a fresh contribution if the current point is not enough.',
    ],
    keySignals: [
      'Trust score',
      'Last updated timestamp',
      'Coverage gaps and field-specific details',
    ],
    screenshots: [
      docsImage('agent', '03-agent-point-detail.png', 'Point detail page used to inspect and enrich a field record.'),
    ],
  },
  'contribution-flow': {
    id: 'contribution-flow',
    title: 'Contribution flow',
    surface: 'Agent capture workflow',
    audiences: ['agent'],
    entryPoint: 'Home explorer -> Contribute or Point detail -> Enrich',
    summary: 'Runs the offline-first create and enrich workflow with camera capture, data quality preview, and queue-safe submission.',
    whyItMatters: 'It is the revenue-generating operational core because every verified point starts here.',
    primaryActions: [
      'Capture structured evidence, photos, and contextual details.',
      'Preview quality and reward impact before submission.',
      'Queue work safely when connectivity is weak.',
    ],
    keySignals: [
      'Photo guidance and EXIF handling',
      'Reward breakdown and quality preview',
      'Online vs queued submission state',
    ],
    screenshots: [
      docsImage('agent', '04-agent-contribution-entry.png', 'Contribution flow with field capture, quality preview, and offline safeguards.'),
    ],
  },
  'submission-queue': {
    id: 'submission-queue',
    title: 'Submission queue',
    surface: 'Agent offline operations',
    audiences: ['agent'],
    entryPoint: 'Profile dashboard or sync status bar',
    summary: 'Tracks pending, failed, synced, and rejected uploads so field agents can recover from connectivity gaps.',
    whyItMatters: 'Queue health is what protects data collection sessions in low-connectivity conditions.',
    primaryActions: [
      'Retry or delete failed queue items.',
      'Force an upload sweep when the device comes back online.',
      'Open a queued draft for editing before resubmission.',
    ],
    keySignals: [
      'Pending, failed, and synced counters',
      'Storage footprint',
      'Online vs offline status',
    ],
    screenshots: [
      docsImage('agent', '05-agent-submission-queue.png', 'Pending upload queue with retry, edit, and storage controls.'),
    ],
  },
  'profile-dashboard': {
    id: 'profile-dashboard',
    title: 'Profile dashboard',
    surface: 'Shared user dashboard',
    audiences: ['agent', 'client', 'admin'],
    entryPoint: 'Bottom navigation -> Profile or Account',
    summary: 'Aggregates user identity, recent activity, assignments, streaks, and contribution health.',
    whyItMatters: 'It is the trust and progress surface that keeps contributors motivated and gives clients a persistent account anchor.',
    primaryActions: [
      'Inspect assignments, progress, badges, and history.',
      'Switch avatar preset and review weekly activity.',
      'Jump into rewards, settings, or the upload queue.',
    ],
    keySignals: [
      'Assignment state',
      'Weekly progress and XP',
      'Contribution history and sync issues',
    ],
    screenshots: [
      docsImage('agent', '06-agent-profile-dashboard.png', 'Agent profile dashboard with assignments, progress, and contribution history.'),
      docsImage('client', '08-client-profile-dashboard.png', 'Client account dashboard that anchors reporting access and account context.'),
    ],
  },
  'settings-profile': {
    id: 'settings-profile',
    title: 'Settings and profile controls',
    surface: 'Shared preferences',
    audiences: ['agent', 'client', 'admin'],
    entryPoint: 'Profile dashboard -> Settings icon',
    summary: 'Handles language, high-contrast mode, planned device controls, and logout.',
    whyItMatters: 'Field readability and bilingual operation must be adjustable without sending users into a desktop-style settings maze.',
    primaryActions: [
      'Switch between English and French.',
      'Enable high-contrast daylight mode.',
      'Log out or review upcoming privacy and notification controls.',
    ],
    keySignals: [
      'Current language',
      'High-contrast preference',
      'Availability of future device controls',
    ],
    screenshots: [
      docsImage('agent', '08-agent-settings-profile.png', 'Agent settings surface for language, contrast, and session controls.'),
      docsImage('client', '09-client-settings-profile.png', 'Client settings surface with the same readability and account controls.'),
    ],
  },
  'rewards-catalog': {
    id: 'rewards-catalog',
    title: 'Rewards catalog',
    surface: 'Agent motivation surface',
    audiences: ['agent'],
    entryPoint: 'Profile dashboard -> Convert to Rewards',
    summary: 'Shows redeemable rewards and wallet state tied to verified contribution performance.',
    whyItMatters: 'Rewards reinforce verified value instead of raw volume and help keep contributors engaged.',
    primaryActions: [
      'Inspect redeemable offers and wallet eligibility.',
      'See how field effort turns into concrete rewards.',
      'Reinforce why data quality unlocks better value.',
    ],
    keySignals: [
      'Reward availability',
      'Wallet state',
      'Eligibility thresholds',
    ],
    screenshots: [
      docsImage('agent', '07-agent-rewards-catalog.png', 'Rewards catalog used to convert trusted contribution output into value.'),
    ],
  },
  'quality-trust': {
    id: 'quality-trust',
    title: 'Data quality and trust',
    surface: 'Agent trust education',
    audiences: ['agent'],
    entryPoint: 'Quality education surface',
    summary: 'Explains the verification model, trust signals, and why accurate enrichment matters.',
    whyItMatters: 'The product depends on disciplined contributor behavior, so the trust model has to be visible and teachable.',
    primaryActions: [
      'Review how trust and verification are scored.',
      'Understand why evidence quality matters for payouts and visibility.',
      'Align field behavior with anti-fraud expectations.',
    ],
    keySignals: [
      'Verification expectations',
      'Trust ladder messaging',
      'Fraud deterrence framing',
    ],
    screenshots: [],
  },
  'leaderboard-analytics': {
    id: 'leaderboard-analytics',
    title: 'Leaderboard and activity analytics',
    surface: 'Agent activity analytics',
    audiences: ['agent'],
    entryPoint: 'Bottom navigation -> Leaderboard',
    summary: 'Shows contributor ranking, XP distribution, category activity, and nearby top performers for field contributors.',
    whyItMatters: 'It reinforces trusted field effort and makes ranking logic visible to agents who are trying to improve verified output.',
    primaryActions: [
      'Inspect the top contributor board and ranking formula.',
      'Review category distribution and activity heatmap.',
      'Compare recent contribution quality with peers.',
    ],
    keySignals: [
      'Leaderboard ranking score',
      'Contributor activity heatmap',
      'Category mix and completion rate',
    ],
    screenshots: [
      docsImage('agent', '09-agent-leaderboard.png', 'Agent leaderboard with rank, XP, and contribution-quality context.'),
    ],
  },
  'impact-analytics': {
    id: 'impact-analytics',
    title: 'Impact analytics',
    surface: 'Admin and client analytics hub',
    audiences: ['admin', 'client'],
    entryPoint: 'Bottom navigation -> Insights',
    summary: 'Acts as the routing hub that points admins and clients toward the right next reporting layer such as delta intelligence, investor reporting, and team performance.',
    whyItMatters: 'Keeps high-level insight routing simple before users move into heavier reporting surfaces, while making the client path feel distinct from the field leaderboard.',
    primaryActions: [
      'Review top-line completion and contributor activity.',
      'Open Delta Dashboard, Investor Dashboard, or Agent Performance.',
      'Use the analytics screen as a narrative bridge in demos.',
    ],
    keySignals: [
      'Completion rate',
      'Active contributors',
      'Deep-link cards for next dashboards',
    ],
    screenshots: [
      docsImage('admin', '01-admin-analytics-entry.png', 'Analytics hub used by admins to branch into deeper operating views.'),
      docsImage('client', '06-client-insights.png', 'Client insights hub used to pivot from overview to deeper reporting.'),
    ],
  },
  'admin-review-queue': {
    id: 'admin-review-queue',
    title: 'Admin review queue',
    surface: 'Admin review operations',
    audiences: ['admin'],
    entryPoint: 'Impact analytics -> Admin',
    summary: 'Presents grouped submissions with fraud, EXIF, trust tier, and evidence context for rapid triage.',
    whyItMatters: 'This is where ADL protects dataset trust before bad field evidence reaches clients.',
    primaryActions: [
      'Approve, reject, or flag submissions.',
      'Inspect grouped evidence, location, and photo metadata.',
      'Triage fraud indicators before publishing field changes.',
    ],
    keySignals: [
      'Risk filters and review stats',
      'Trust tier labels',
      'EXIF, device, and fraud metadata',
    ],
    screenshots: [
      docsImage('admin', '02-admin-review-queue.png', 'Admin review queue with grouped submissions and fraud-oriented triage context.'),
    ],
  },
  'admin-assignments': {
    id: 'admin-assignments',
    title: 'Assignment planner',
    surface: 'Admin field orchestration',
    audiences: ['admin'],
    entryPoint: 'Admin review queue -> Assignments tab',
    summary: 'Creates and manages field assignments by zone, status, priority, and due date.',
    whyItMatters: 'Transforms review findings and automation leads into concrete field work with deadlines.',
    primaryActions: [
      'Review assignment statuses such as pending and in progress.',
      'Inspect zone-level workload and due dates.',
      'Coordinate the next field action after review.',
    ],
    keySignals: [
      'Assignment status',
      'Zone label and due date',
      'Points expected and completion pace',
    ],
    screenshots: [
      docsImage('admin', '03-admin-assignments.png', 'Assignment planning surface used to coordinate field work by zone.'),
    ],
  },
  'admin-automation': {
    id: 'admin-automation',
    title: 'Automation leads',
    surface: 'Admin automation intake',
    audiences: ['admin'],
    entryPoint: 'Admin review queue -> Automation tab',
    summary: 'Surfaces lead candidates, match states, and assignment-ready automation outputs before they enter the field pipeline.',
    whyItMatters: 'This is the operational bridge between machine-detected opportunities and human-reviewed field action.',
    primaryActions: [
      'Review lead candidates and current automation status.',
      'Promote a lead to field verification or assignment.',
      'Reject out-of-zone or low-quality automation output.',
    ],
    keySignals: [
      'Lead status',
      'Priority tier',
      'Match quality against existing records',
    ],
    screenshots: [
      docsImage('admin', '04-admin-automation.png', 'Automation intake view showing machine-originated leads before assignment.'),
    ],
  },
  'agent-performance': {
    id: 'agent-performance',
    title: 'Agent performance',
    surface: 'Admin performance review',
    audiences: ['admin'],
    entryPoint: 'Impact analytics -> Agent Performance',
    summary: 'Ranks agents by output, quality, and submission mix for coaching and staffing decisions.',
    whyItMatters: 'Helps ops leads understand who is producing reliable coverage and where field coaching is needed.',
    primaryActions: [
      'Compare agents on average quality and submission totals.',
      'Use performance data for staffing or coaching decisions.',
      'Translate field output into operational reviews.',
    ],
    keySignals: [
      'Average quality score',
      'Submission totals',
      'Relative agent ranking',
    ],
    screenshots: [
      docsImage('admin', '05-admin-agent-performance.png', 'Agent performance report used for coaching, staffing, and trust reviews.'),
    ],
  },
  'delta-dashboard': {
    id: 'delta-dashboard',
    title: 'Delta dashboard',
    surface: 'Client spatial intelligence',
    audiences: ['client', 'admin'],
    entryPoint: 'Client default landing page or Insights -> Delta Dashboard',
    summary: 'Turns raw changes into a client-ready narrative around coverage, change, anomalies, and exportable insight.',
    whyItMatters: 'This is the monetizable reporting surface for weekly change intelligence and geospatial sales storytelling.',
    primaryActions: [
      'Compare verticals such as pharmacy or fuel across time.',
      'Read change signals, anomalies, and completion rate together.',
      'Open export options for reporting packs.',
    ],
    keySignals: [
      'Total points, completion, and week-over-week change',
      'Recent delta feed',
      'Spatial intelligence ranking',
    ],
    screenshots: [
      docsImage('client', '01-client-dashboard-overview.png', 'Client delta dashboard overview with KPI and change narrative.'),
      docsImage('admin', '06-admin-delta-dashboard.png', 'Admin-facing view of the same delta reporting surface.'),
    ],
  },
  'spatial-intelligence-focus': {
    id: 'spatial-intelligence-focus',
    title: 'Spatial intelligence focus map',
    surface: 'Client top-cell drilldown',
    audiences: ['client', 'admin'],
    entryPoint: 'Delta dashboard -> Spatial Intelligence -> Select a cell such as s0wzm8',
    summary: 'Decodes the highest-opportunity cell into a focused map rectangle so users can explain why a cluster sits where it does.',
    whyItMatters: 'This is the answer to "where exactly is this cluster located in Bonamoussadi and why does it rank high?"',
    primaryActions: [
      'Select a top-ranked cell such as s0wzm8.',
      'Inspect the focused map bounds and ranking explanation.',
      'Translate cell scores into a client-ready narrative.',
    ],
    keySignals: [
      'Focused cell identifier',
      'Coverage gap, change signal, and opportunity score',
      'Map rectangle over the Bonamoussadi area of interest',
    ],
    screenshots: [
      docsImage('client', '02-client-pharmacy-story.png', 'Client category drilldown before selecting the highest-opportunity cell.'),
      docsImage('client', '03-client-top-cell-map.png', 'Focused map for cell s0wzm8 inside Bonamoussadi.'),
    ],
  },
  'export-panel': {
    id: 'export-panel',
    title: 'Export panel',
    surface: 'Client reporting output',
    audiences: ['client', 'admin'],
    entryPoint: 'Delta dashboard -> Export current view',
    summary: 'Packages the active reporting state into CSV, GeoJSON, or PDF-friendly outputs.',
    whyItMatters: 'Turns interactive spatial intelligence into a deliverable that can be sold, shared, or inserted into client decks.',
    primaryActions: [
      'Export the current filtered dashboard state.',
      'Choose a delivery format aligned with downstream reporting.',
      'Capture evidence for weekly client deliverables.',
    ],
    keySignals: [
      'Current filter context',
      'Selected export format',
      'Download-ready reporting payload',
    ],
    screenshots: [
      docsImage('client', '04-client-export-surface.png', 'Export controls for turning the current dashboard state into a deliverable.'),
    ],
  },
  'investor-dashboard': {
    id: 'investor-dashboard',
    title: 'Investor dashboard',
    surface: 'Executive reporting',
    audiences: ['client', 'admin'],
    entryPoint: 'Insights -> Investor Dashboard',
    summary: 'Packages verification, fraud, coverage growth, and contributor activity into a board-ready summary.',
    whyItMatters: 'It reframes operational capture into executive confidence metrics for clients, buyers, and partners.',
    primaryActions: [
      'Review executive KPIs across trust, fraud, and activity.',
      'Use trend visuals for higher-level reporting discussions.',
      'Support quarterly or investor-grade narrative packaging.',
    ],
    keySignals: [
      'Verification and trust KPIs',
      'Fraud checks and median record age',
      'Weekly active contributors and enrichment depth',
    ],
    screenshots: [
      docsImage('admin', '07-admin-investor-dashboard.png', 'Investor-style executive dashboard used for client and leadership readouts.'),
      docsImage('client', '07-client-investor-dashboard.png', 'Client investor dashboard with executive KPIs and reporting-ready trends.'),
    ],
  },
};

const countScreens = (audience: DocsAudience) =>
  Object.values(SCREEN_LIBRARY).filter((screen) => screen.audiences.includes(audience)).length;

const countScreenshots = (audience: DocsAudience) =>
  Object.values(SCREEN_LIBRARY)
    .filter((screen) => screen.audiences.includes(audience))
    .reduce((total, screen) => total + screen.screenshots.length, 0);

export const DOCS_SECTIONS: Record<DocsAudience, DocsSection> = {
  public: {
    slug: 'public',
    title: 'Platform overview',
    navLabel: 'Overview',
    subtitle: 'Role-based product documentation for field ops, review ops, and client reporting.',
    intro:
      'This help center documents the full African Data Layer operating system: the field capture surfaces, the admin review workflow, the client reporting dashboards, and the Playwright-based evidence pipeline that turns product behavior into sellable documentation.',
    highlights: [
      'Every major surface is documented with purpose, entry point, primary actions, and trust signals.',
      'Client-facing reporting surfaces explain not just what changed, but where the change sits on the map and why it matters.',
      'Playwright roadmap captures produce a reusable screenshot library for demos, decks, walkthroughs, and onboarding.',
    ],
    metrics: [
      { label: 'Documented surfaces', value: String(Object.keys(SCREEN_LIBRARY).length), tone: 'navy' },
      { label: 'Agent surfaces', value: String(countScreens('agent')), tone: 'forest' },
      { label: 'Client surfaces', value: String(countScreens('client')), tone: 'gold' },
      { label: 'Visual captures', value: String(countScreenshots('public') + countScreenshots('agent') + countScreenshots('client') + countScreenshots('admin')), tone: 'terra' },
    ],
    workflows: [
      {
        id: 'public-contributor-loop',
        title: 'Contributor activation to verified field record',
        summary: 'Start on the explorer, inspect an existing point, and push a queued-safe create or enrich event.',
        steps: [
          'Launch into the map explorer and identify the next useful point.',
          'Open point detail to validate freshness, trust score, and missing fields.',
          'Enter the contribution flow to capture structured evidence and queue the event if connectivity is weak.',
          'Monitor queue health and contributor progress from the profile dashboard.',
        ],
        screenIds: ['home-explorer', 'point-detail', 'contribution-flow', 'submission-queue', 'profile-dashboard'],
      },
      {
        id: 'public-review-loop',
        title: 'Review to assignment to automation loop',
        summary: 'Use the admin surfaces to triage risky submissions, create assignments, and manage machine-originated leads.',
        steps: [
          'Open the analytics hub and branch into the admin review queue.',
          'Approve, reject, or flag grouped submissions using fraud and EXIF context.',
          'Move into Assignments to coordinate the next field action by zone and due date.',
          'Review Automation to promote lead candidates or reject weak machine output.',
        ],
        screenIds: ['impact-analytics', 'admin-review-queue', 'admin-assignments', 'admin-automation'],
      },
      {
        id: 'public-client-loop',
        title: 'Client intelligence and export loop',
        summary: 'Use Delta Dashboard to frame the story, drill into a top cell like s0wzm8, and export the active view.',
        steps: [
          'Open the Delta Dashboard for KPI, anomaly, and vertical-level change context.',
          'Select a category and inspect the Spatial Intelligence module.',
          'Focus a top-ranked cell to see exactly where the opportunity sits on the Bonamoussadi map.',
          'Package the current view into an exportable deliverable or move into the Investor Dashboard for executive reporting.',
        ],
        screenIds: ['delta-dashboard', 'spatial-intelligence-focus', 'export-panel', 'investor-dashboard'],
      },
      {
        id: 'public-docs-pipeline',
        title: 'Documentation and screenshot evidence pipeline',
        summary: 'Run Playwright to validate behavior and refresh the screenshot library that powers the docs pages.',
        steps: [
          'Run smoke coverage to verify agent, admin, and client flows still work.',
          'Run the roadmap capture specs to regenerate narrative screenshots.',
          'Sync the generated screenshots into public docs media.',
          'Use the refreshed docs pages for onboarding, walkthroughs, and client-facing collateral.',
        ],
        screenIds: ['home-explorer', 'admin-review-queue', 'delta-dashboard'],
      },
    ],
    screenIds: Object.keys(SCREEN_LIBRARY),
    evidenceScreenIds: [
      'home-explorer',
      'home-map',
      'point-detail',
      'contribution-flow',
      'admin-review-queue',
      'admin-assignments',
      'delta-dashboard',
      'spatial-intelligence-focus',
      'investor-dashboard',
    ],
    runbook: [
      {
        title: 'Core commands',
        items: [
          '`npm run test:e2e` validates the main role journeys.',
          '`npm run test:e2e:docs` regenerates the roadmap screenshots and syncs them into `/public/docs-media`.',
          '`npm run test:ci` runs lint, typecheck, unit tests, and the production build.',
        ],
      },
      {
        title: 'Deliverables this system supports',
        items: [
          'Client help center pages that explain every major surface.',
          'Screenshot-backed product walkthroughs for onboarding and sales demos.',
          'Weekly or monthly spatial intelligence packs assembled from Delta Dashboard exports and focused top-cell visuals.',
        ],
      },
      {
        title: 'What to sell',
        items: [
          'Category-specific change reports built from Delta Dashboard vertical filters.',
          'Neighborhood opportunity briefings anchored on top cells like s0wzm8 and related anomaly signals.',
          'Executive readouts that combine Investor Dashboard KPIs with evidence screenshots and exported tables.',
        ],
      },
    ],
  },
  client: {
    slug: 'client',
    title: 'Client docs',
    navLabel: 'Client',
    subtitle: 'How buyers, analysts, and decision makers consume trusted spatial deltas.',
    intro:
      'Client users land on the reporting side of ADL. The goal is to understand what changed, where the strongest signals sit on the map, and how to turn those signals into a shareable output.',
    highlights: [
      'Delta Dashboard is the default reporting surface and the main monetizable screen.',
      'Top-cell drilldown answers the exact location question for clusters inside Bonamoussadi.',
      'Exports and investor views repackage field operations into presentation-ready outputs.',
    ],
    metrics: [
      { label: 'Client-facing surfaces', value: String(countScreens('client')), tone: 'navy' },
      { label: 'Captured visuals', value: String(countScreenshots('client')), tone: 'gold' },
      { label: 'Top-cell map support', value: 'Yes', tone: 'forest' },
      { label: 'Export formats', value: 'CSV / GeoJSON / PDF', tone: 'terra' },
    ],
    workflows: [
      {
        id: 'client-overview',
        title: 'Open the weekly reporting narrative',
        summary: 'Start on the Delta Dashboard and read high-level change before diving into a category.',
        steps: [
          'Review the KPI cards and week-over-week change.',
          'Pick a vertical such as Pharmacy to narrow the story.',
          'Read the anomaly and recent delta narrative before drilling deeper.',
        ],
        screenIds: ['delta-dashboard'],
      },
      {
        id: 'client-top-cell',
        title: 'Explain exactly where a cluster sits',
        summary: 'Use Spatial Intelligence to select a cell like s0wzm8 and reveal the focused map bounds.',
        steps: [
          'Open Spatial Intelligence inside the Delta Dashboard.',
          'Sort by opportunity, coverage gap, or change signal.',
          'Select a top cell and review its focused map rectangle in Bonamoussadi.',
        ],
        screenIds: ['spatial-intelligence-focus', 'home-map'],
      },
      {
        id: 'client-export',
        title: 'Turn the current view into a deliverable',
        summary: 'Export the active reporting context and move into the executive dashboard when the audience needs a board-level summary.',
        steps: [
          'Open the Export current view control.',
          'Choose the output format that matches the client workflow.',
          'Use Investor Dashboard for a higher-level executive readout when the conversation shifts from local map evidence to trust and growth KPIs.',
        ],
        screenIds: ['export-panel', 'investor-dashboard'],
      },
      {
        id: 'client-insights-handoff',
        title: 'Use the insights hub as the routing layer',
        summary: 'Open Insights to decide whether the next conversation should stay map-first or switch to executive reporting.',
        steps: [
          'Open the Insights tab after reviewing the Delta Dashboard.',
          'Use Delta Intelligence when the client needs exact neighborhood, cluster, and top-cell context.',
          'Use Investor Dashboard when the discussion needs verification, fraud, and board-ready trend framing.',
        ],
        screenIds: ['impact-analytics', 'investor-dashboard'],
      },
    ],
    screenIds: [
      'home-explorer',
      'home-map',
      'point-detail',
      'profile-dashboard',
      'settings-profile',
      'impact-analytics',
      'delta-dashboard',
      'spatial-intelligence-focus',
      'export-panel',
      'investor-dashboard',
    ],
    evidenceScreenIds: [
      'delta-dashboard',
      'spatial-intelligence-focus',
      'export-panel',
      'home-map',
      'impact-analytics',
      'profile-dashboard',
      'settings-profile',
      'investor-dashboard',
    ],
    runbook: [
      {
        title: 'Questions clients can answer here',
        items: [
          'Which category is changing fastest right now in Bonamoussadi?',
          'Where exactly is the highest-opportunity cell and what made it rank high?',
          'Can this filtered view be exported and inserted into a client-ready report?',
        ],
      },
      {
        title: 'Demo path',
        items: [
          'Start on Delta Dashboard for KPI context.',
          'Switch to a vertical such as Pharmacy, then open the focused cell map.',
          'Finish with Export current view or Investor Dashboard depending on the audience.',
        ],
      },
    ],
  },
  agent: {
    slug: 'agent',
    title: 'Agent docs',
    navLabel: 'Agent',
    subtitle: 'The field contributor operating manual for capture, queue health, trust, and rewards.',
    intro:
      'Agent documentation focuses on the field job: find the next useful point, capture trustworthy evidence quickly, survive weak connectivity, and keep progress visible.',
    highlights: [
      'Explorer, detail, and contribution flow form the main capture loop.',
      'Submission Queue protects the session when the network is unstable.',
      'Profile, rewards, and leaderboard create momentum without sacrificing operational credibility.',
    ],
    metrics: [
      { label: 'Agent surfaces', value: String(countScreens('agent')), tone: 'forest' },
      { label: 'Captured visuals', value: String(countScreenshots('agent')), tone: 'navy' },
      { label: 'Offline-safe capture', value: 'Enabled', tone: 'terra' },
      { label: 'Rewards surface', value: 'Available', tone: 'gold' },
    ],
    workflows: [
      {
        id: 'agent-discover',
        title: 'Discover and prioritize a point',
        summary: 'Use list or map mode to find the next useful record and open point detail.',
        steps: [
          'Filter the explorer by category.',
          'Use the mission cards and point freshness to choose a target.',
          'Open detail to inspect trust score and missing fields.',
        ],
        screenIds: ['home-explorer', 'home-map', 'point-detail'],
      },
      {
        id: 'agent-capture',
        title: 'Create or enrich with resilient field capture',
        summary: 'Launch the contribution flow, capture evidence, and queue safely when offline.',
        steps: [
          'Open Contribute or Enrich from the explorer or point detail.',
          'Capture structured details and photos with the built-in guidance.',
          'Submit immediately or let the queue protect the event until connectivity returns.',
        ],
        screenIds: ['contribution-flow', 'submission-queue'],
      },
      {
        id: 'agent-progress',
        title: 'Track trust, progress, and rewards',
        summary: 'Use the profile, leaderboard, and rewards surfaces to understand personal performance.',
        steps: [
          'Inspect assignments, daily progress, and history in Profile.',
          'Compare ranking and activity patterns in the leaderboard.',
          'Convert verified contribution output into rewards when eligible.',
        ],
        screenIds: ['profile-dashboard', 'leaderboard-analytics', 'rewards-catalog'],
      },
    ],
    screenIds: [
      'splash-onboarding',
      'auth-sign-in',
      'home-explorer',
      'home-map',
      'point-detail',
      'contribution-flow',
      'submission-queue',
      'profile-dashboard',
      'settings-profile',
      'rewards-catalog',
      'quality-trust',
      'leaderboard-analytics',
    ],
    evidenceScreenIds: [
      'home-explorer',
      'home-map',
      'point-detail',
      'contribution-flow',
      'submission-queue',
      'profile-dashboard',
      'rewards-catalog',
      'settings-profile',
      'leaderboard-analytics',
    ],
    runbook: [
      {
        title: 'Field checklist',
        items: [
          'Stay inside the mission context visible on the explorer before starting a new capture.',
          'Use point detail to verify whether a record needs enrichment before adding a duplicate.',
          'Check Submission Queue before ending the shift so pending work is not forgotten.',
        ],
      },
      {
        title: 'What quality looks like',
        items: [
          'Clear photos with visible storefront or asset context.',
          'Structured fields that close real coverage gaps rather than filling placeholders.',
          'Consistent sync follow-through so queued work becomes published evidence.',
        ],
      },
    ],
  },
  admin: {
    slug: 'admin',
    title: 'Admin docs',
    navLabel: 'Admin',
    subtitle: 'Review, assignment, automation, and performance operations for dataset trust.',
    intro:
      'Admin documentation covers the trust layer of ADL: reviewing field evidence, planning assignments, handling automation leads, and using performance surfaces for staffing and coaching.',
    highlights: [
      'The review queue is the quality gate before records become publishable.',
      'Assignments translate review findings into the next field action.',
      'Automation and performance surfaces help ops leads scale without losing trust.',
    ],
    metrics: [
      { label: 'Admin surfaces', value: String(countScreens('admin')), tone: 'navy' },
      { label: 'Captured visuals', value: String(countScreenshots('admin')), tone: 'terra' },
      { label: 'Review modes', value: 'Review / Assignments / Automation', tone: 'forest' },
      { label: 'Executive dashboards', value: 'Delta + Investor', tone: 'gold' },
    ],
    workflows: [
      {
        id: 'admin-review',
        title: 'Triage submissions with trust context',
        summary: 'Open the review queue and use fraud, device, and EXIF context to make a decision.',
        steps: [
          'Enter the Admin surface from Impact analytics.',
          'Filter or sort the review queue by risk.',
          'Approve, reject, or flag submissions based on evidence confidence.',
        ],
        screenIds: ['impact-analytics', 'admin-review-queue'],
      },
      {
        id: 'admin-assign',
        title: 'Turn review findings into field work',
        summary: 'Plan work by zone, due date, and expected point coverage.',
        steps: [
          'Switch into Assignments.',
          'Review workload, status, and due dates.',
          'Use the planner to define the next field move.',
        ],
        screenIds: ['admin-assignments'],
      },
      {
        id: 'admin-automation-flow',
        title: 'Control the machine-to-field handoff',
        summary: 'Promote or reject automation leads before they become field assignments.',
        steps: [
          'Open the Automation tab.',
          'Inspect status, priority, and match quality.',
          'Promote assignment-ready leads or reject low-confidence candidates.',
        ],
        screenIds: ['admin-automation'],
      },
      {
        id: 'admin-performance-and-reporting',
        title: 'Coach agents and support client reporting',
        summary: 'Use Agent Performance for coaching, then pivot into Delta or Investor Dashboard for reporting support.',
        steps: [
          'Open Agent Performance to understand output and quality by contributor.',
          'Use Delta Dashboard for client-facing operational stories.',
          'Use Investor Dashboard for executive or board-style readouts.',
        ],
        screenIds: ['agent-performance', 'delta-dashboard', 'investor-dashboard'],
      },
    ],
    screenIds: [
      'impact-analytics',
      'admin-review-queue',
      'admin-assignments',
      'admin-automation',
      'agent-performance',
      'delta-dashboard',
      'spatial-intelligence-focus',
      'export-panel',
      'investor-dashboard',
      'profile-dashboard',
      'settings-profile',
    ],
    evidenceScreenIds: [
      'impact-analytics',
      'admin-review-queue',
      'admin-assignments',
      'admin-automation',
      'agent-performance',
      'delta-dashboard',
      'investor-dashboard',
    ],
    runbook: [
      {
        title: 'Daily ops loop',
        items: [
          'Start in Impact analytics to understand the current operating picture.',
          'Clear the review queue first so publishable changes do not stall.',
          'Update assignments and automation leads before the next field window begins.',
        ],
      },
      {
        title: 'What to show in internal reviews',
        items: [
          'Review queue health and trust-tier distribution.',
          'Assignment completion pace by zone.',
          'Agent performance trends tied back to client-facing change dashboards.',
        ],
      },
    ],
  },
};

export function docsPathForAudience(audience: DocsAudience): string {
  return audience === 'public' ? '/docs' : `/docs/${audience}`;
}

export function audienceFromDocsPath(pathname: string): DocsAudience {
  if (pathname.startsWith('/docs/client')) return 'client';
  if (pathname.startsWith('/docs/agent')) return 'agent';
  if (pathname.startsWith('/docs/admin')) return 'admin';
  return 'public';
}

export function getSectionScreens(section: DocsSection): DocsScreen[] {
  return section.screenIds.map((screenId) => SCREEN_LIBRARY[screenId]).filter(Boolean);
}

export function getSectionEvidence(section: DocsSection): DocsScreen[] {
  return section.evidenceScreenIds.map((screenId) => SCREEN_LIBRARY[screenId]).filter(Boolean);
}

export function getVisualCoverage(screen: DocsScreen): DocsVisualCoverage {
  return screen.screenshots.length > 0 ? 'captured' : 'text-only';
}

export function searchDocs(query: string, audience?: DocsAudience): DocsSearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  const sections = audience ? [DOCS_SECTIONS[audience]] : Object.values(DOCS_SECTIONS);
  const results: DocsSearchResult[] = [];

  for (const section of sections) {
    for (const highlight of section.highlights) {
      if (!highlight.toLowerCase().includes(normalized)) continue;
      results.push({
        id: `${section.slug}-highlight-${highlight}`,
        kind: 'highlight',
        audience: section.slug,
        audienceTitle: section.title,
        title: `${section.title} highlight`,
        description: highlight,
        path: docsPathForAudience(section.slug),
      });
    }

    for (const workflow of section.workflows) {
      const workflowText = [workflow.title, workflow.summary, ...workflow.steps].join(' ').toLowerCase();
      if (!workflowText.includes(normalized)) continue;
      results.push({
        id: `${section.slug}-workflow-${workflow.id}`,
        kind: 'workflow',
        audience: section.slug,
        audienceTitle: section.title,
        title: workflow.title,
        description: workflow.summary,
        path: docsPathForAudience(section.slug),
      });
    }

    for (const screen of getSectionScreens(section)) {
      const screenText = [
        screen.title,
        screen.surface,
        screen.entryPoint,
        screen.summary,
        screen.whyItMatters,
        ...screen.primaryActions,
        ...screen.keySignals,
      ]
        .join(' ')
        .toLowerCase();
      if (!screenText.includes(normalized)) continue;
      results.push({
        id: `${section.slug}-screen-${screen.id}`,
        kind: 'screen',
        audience: section.slug,
        audienceTitle: section.title,
        title: screen.title,
        description: screen.summary,
        path: docsPathForAudience(section.slug),
      });
    }
  }

  return results.slice(0, 24);
}

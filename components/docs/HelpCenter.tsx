import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Compass,
  ExternalLink,
  Image as ImageIcon,
  LayoutDashboard,
  Search,
} from 'lucide-react';
import BrandLogo from '../BrandLogo';
import {
  DOCS_SECTIONS,
  audienceFromDocsPath,
  docsPathForAudience,
  getSectionEvidence,
  getSectionScreens,
  getVisualCoverage,
  searchDocs,
  type DocsAudience,
  type DocsRunbookGroup,
  type DocsScreen,
  type DocsSection,
  type DocsTone,
  type DocsWorkflow,
} from '../../lib/docs/helpCenter';

interface HelpCenterProps {
  pathname: string;
  onNavigate: (path: string) => void;
}

const toneClass: Record<DocsTone, string> = {
  navy: 'border-navy/10 bg-navy text-white',
  forest: 'border-forest/10 bg-forest text-white',
  terra: 'border-terra/10 bg-terra text-white',
  gold: 'border-gold/30 bg-gold text-navy',
};

const surfaceToneClass: Record<string, string> = {
  'Shared entry': 'bg-gray-100 text-gray-700',
  'Shared account access': 'bg-gray-100 text-gray-700',
  'Shared map explorer': 'bg-navy-wash text-navy',
  'Shared point inspection': 'bg-navy-wash text-navy',
  'Shared user dashboard': 'bg-navy-wash text-navy',
  'Shared preferences': 'bg-navy-wash text-navy',
  'Admin and client analytics hub': 'bg-gold-wash text-amber-900',
  'Client spatial intelligence': 'bg-gold-wash text-amber-900',
  'Client top-cell drilldown': 'bg-gold-wash text-amber-900',
  'Client reporting output': 'bg-gold-wash text-amber-900',
  'Executive reporting': 'bg-gold-wash text-amber-900',
  'Agent capture workflow': 'bg-forest-wash text-forest',
  'Agent offline operations': 'bg-forest-wash text-forest',
  'Agent motivation surface': 'bg-forest-wash text-forest',
  'Agent trust education': 'bg-forest-wash text-forest',
  'Shared activity analytics': 'bg-forest-wash text-forest',
  'Admin review operations': 'bg-terra/10 text-terra-dark',
  'Admin field orchestration': 'bg-terra/10 text-terra-dark',
  'Admin automation intake': 'bg-terra/10 text-terra-dark',
  'Admin performance review': 'bg-terra/10 text-terra-dark',
};

function sectionIcon(section: DocsAudience) {
  if (section === 'client') return LayoutDashboard;
  if (section === 'agent') return Compass;
  if (section === 'admin') return BookOpen;
  return CircleDot;
}

function ResultKindLabel({ kind }: { kind: 'screen' | 'workflow' | 'highlight' }) {
  const label = kind === 'screen' ? 'Screen' : kind === 'workflow' ? 'Workflow' : 'Highlight';
  return (
    <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
      {label}
    </span>
  );
}

function SidebarSectionLink({
  section,
  current,
  onNavigate,
}: {
  section: DocsSection;
  current: boolean;
  onNavigate: (path: string) => void;
}) {
  const Icon = sectionIcon(section.slug);
  return (
    <button
      type="button"
      onClick={() => onNavigate(docsPathForAudience(section.slug))}
      className={`motion-pressable flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-colors ${
        current
          ? 'border-navy bg-white shadow-sm'
          : 'border-transparent bg-white/70 hover:border-gray-200 hover:bg-white'
      }`}
    >
      <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl ${current ? 'bg-navy text-white' : 'bg-page text-navy'}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-ink">{section.navLabel}</div>
        <div className="mt-1 text-xs leading-5 text-gray-500">{section.subtitle}</div>
      </div>
    </button>
  );
}

function WorkflowCard({ workflow, screens }: { workflow: DocsWorkflow; screens: DocsScreen[] }) {
  return (
    <article className="card space-y-5 p-5">
      <div className="space-y-2">
        <div className="micro-label text-gray-400">Workflow</div>
        <h3 className="text-lg font-bold text-ink">{workflow.title}</h3>
        <p className="text-sm leading-6 text-gray-600">{workflow.summary}</p>
      </div>
      <ol className="space-y-3">
        {workflow.steps.map((step, index) => (
          <li key={step} className="flex gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
              {index + 1}
            </div>
            <p className="text-sm leading-6 text-gray-700">{step}</p>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        {screens.map((screen) => (
          <span key={screen.id} className="rounded-full bg-page px-3 py-1.5 text-xs font-semibold text-gray-600">
            {screen.title}
          </span>
        ))}
      </div>
    </article>
  );
}

function ScreenCard({ screen }: { screen: DocsScreen }) {
  const visualCoverage = getVisualCoverage(screen);
  const surfaceClass = surfaceToneClass[screen.surface] ?? 'bg-gray-100 text-gray-700';

  return (
    <article id={`screen-${screen.id}`} className="card space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${surfaceClass}`}>
              {screen.surface}
            </span>
            <span
              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                visualCoverage === 'captured'
                  ? 'bg-forest-wash text-forest'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {visualCoverage === 'captured' ? 'Visual capture' : 'Text reference'}
            </span>
          </div>
          <h3 className="text-xl font-bold text-ink">{screen.title}</h3>
          <p className="text-sm leading-6 text-gray-600">{screen.summary}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-page px-4 py-3 text-sm text-gray-600">
          <div className="micro-label text-gray-400">Entry point</div>
          <div className="mt-2 max-w-xs leading-6 text-ink">{screen.entryPoint}</div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
        <div className="space-y-3 rounded-3xl bg-page p-4">
          <div className="micro-label text-gray-400">Why it matters</div>
          <p className="text-sm leading-6 text-gray-700">{screen.whyItMatters}</p>
        </div>
        <div className="space-y-3 rounded-3xl bg-page p-4">
          <div className="micro-label text-gray-400">Primary actions</div>
          <div className="space-y-2">
            {screen.primaryActions.map((action) => (
              <div key={action} className="flex gap-2 text-sm leading-6 text-gray-700">
                <CheckCircle2 size={16} className="mt-1 shrink-0 text-forest" />
                <span>{action}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="micro-label text-gray-400">Key signals</div>
        <div className="flex flex-wrap gap-2">
          {screen.keySignals.map((signal) => (
            <span key={signal} className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600">
              {signal}
            </span>
          ))}
        </div>
      </div>

      {screen.screenshots.length > 0 && (
        <div className="space-y-3">
          <div className="micro-label text-gray-400">Visual evidence</div>
          <div className="grid gap-4 lg:grid-cols-2">
            {screen.screenshots.map((screenshot) => (
              <figure key={screenshot.src} className="overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-sm">
                <img src={screenshot.src} alt={screenshot.alt} className="block h-56 w-full object-cover object-top" loading="lazy" />
                <figcaption className="border-t border-gray-100 px-4 py-3 text-sm leading-6 text-gray-600">
                  {screenshot.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function RunbookCard({ group }: { group: DocsRunbookGroup }) {
  return (
    <article className="card p-5">
      <div className="micro-label text-gray-400">{group.title}</div>
      <div className="mt-4 space-y-3">
        {group.items.map((item) => (
          <div key={item} className="flex gap-3 text-sm leading-6 text-gray-700">
            <ChevronRight size={16} className="mt-1 shrink-0 text-navy" />
            <span dangerouslySetInnerHTML={{ __html: item.replace(/`([^`]+)`/g, '<code class="rounded bg-page px-1.5 py-0.5 text-[0.85em]">$1</code>') }} />
          </div>
        ))}
      </div>
    </article>
  );
}

const HelpCenter: React.FC<HelpCenterProps> = ({ pathname, onNavigate }) => {
  const [query, setQuery] = useState('');
  const currentAudience = audienceFromDocsPath(pathname);
  const currentSection = DOCS_SECTIONS[currentAudience];

  const currentScreens = useMemo(() => getSectionScreens(currentSection), [currentSection]);
  const evidenceScreens = useMemo(() => getSectionEvidence(currentSection), [currentSection]);
  const searchResults = useMemo(() => searchDocs(query), [query]);

  const capturedScreenCount = currentScreens.filter((screen) => getVisualCoverage(screen) === 'captured').length;
  const textOnlyCount = currentScreens.length - capturedScreenCount;
  const totalEvidenceCount = evidenceScreens.reduce((count, screen) => count + screen.screenshots.length, 0);

  const evidenceGallery = useMemo(
    () =>
      evidenceScreens.flatMap((screen) =>
        screen.screenshots.map((screenshot) => ({
          ...screenshot,
          screenTitle: screen.title,
        })),
      ),
    [evidenceScreens],
  );

  return (
    <div className="h-full overflow-hidden bg-page text-ink">
      <div className="flex h-full flex-col">
        <header className="border-b border-gray-200 bg-white/95 backdrop-blur-sm">
          <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-page">
                <BrandLogo size={28} />
              </div>
              <div className="min-w-0">
                <div className="micro-label text-gray-400">African Data Layer</div>
                <div className="truncate text-base font-bold text-ink">Help center and product walkthroughs</div>
              </div>
            </div>

            <nav className="flex max-w-full items-center gap-2 overflow-x-auto no-scrollbar" aria-label="Help center audiences">
              {Object.values(DOCS_SECTIONS).map((section) => (
                <button
                  key={section.slug}
                  type="button"
                  onClick={() => onNavigate(docsPathForAudience(section.slug))}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    section.slug === currentAudience
                      ? 'bg-navy text-white'
                      : 'bg-page text-gray-600 hover:bg-gray-100 hover:text-ink'
                  }`}
                >
                  {section.navLabel}
                </button>
              ))}
            </nav>

            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="motion-pressable hidden items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-navy shadow-sm sm:flex"
            >
              <span>Open product</span>
              <ExternalLink size={16} />
            </button>
          </div>
        </header>

        <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 overflow-hidden">
          <aside className="hidden w-[320px] shrink-0 overflow-y-auto border-r border-gray-200 bg-white xl:block">
            <div className="space-y-6 p-6">
              <div className="space-y-3">
                <div className="micro-label text-gray-400">Browse docs</div>
                {Object.values(DOCS_SECTIONS).map((section) => (
                  <SidebarSectionLink
                    key={section.slug}
                    section={section}
                    current={section.slug === currentAudience}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>

              <div className="rounded-[32px] border border-gray-100 bg-page p-5">
                <div className="micro-label text-gray-400">Coverage for this page</div>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl bg-white p-4">
                    <div className="text-2xl font-bold text-navy">{currentScreens.length}</div>
                    <div className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Documented surfaces</div>
                  </div>
                  <div className="rounded-2xl bg-white p-4">
                    <div className="text-2xl font-bold text-forest">{capturedScreenCount}</div>
                    <div className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Captured surfaces</div>
                  </div>
                  <div className="rounded-2xl bg-white p-4">
                    <div className="text-2xl font-bold text-terra">{textOnlyCount}</div>
                    <div className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Text-only references</div>
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border border-gray-100 bg-page p-5">
                <div className="micro-label text-gray-400">Page sections</div>
                <div className="mt-4 space-y-2 text-sm font-semibold text-gray-600">
                  <a href="#overview" className="block rounded-2xl bg-white px-4 py-3 hover:text-ink">Overview</a>
                  <a href="#workflows" className="block rounded-2xl bg-white px-4 py-3 hover:text-ink">Workflows</a>
                  <a href="#screens" className="block rounded-2xl bg-white px-4 py-3 hover:text-ink">Screen inventory</a>
                  <a href="#evidence" className="block rounded-2xl bg-white px-4 py-3 hover:text-ink">Visual walkthrough</a>
                  <a href="#runbook" className="block rounded-2xl bg-white px-4 py-3 hover:text-ink">Runbook</a>
                </div>
              </div>
            </div>
          </aside>

          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-10 px-4 py-6 sm:px-6 lg:px-8">
              <section id="overview" className="space-y-6">
                <div className="rounded-[36px] border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
                  <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                    <div className="max-w-4xl space-y-4">
                      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                        <span className="font-semibold text-gray-400">Docs</span>
                        <ChevronRight size={15} />
                        <span className="font-semibold text-navy">{currentSection.title}</span>
                      </div>
                      <div className="space-y-3">
                        <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{currentSection.title}</h1>
                        <p className="max-w-3xl text-base leading-7 text-gray-600">{currentSection.subtitle}</p>
                        <p className="max-w-4xl text-sm leading-7 text-gray-600">{currentSection.intro}</p>
                      </div>
                    </div>

                    <div className="w-full max-w-xl">
                      <label className="sr-only" htmlFor="docs-search">
                        Search docs
                      </label>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                          id="docs-search"
                          type="search"
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder="Search screens, workflows, exports, or cells like s0wzm8"
                          className="h-14 w-full rounded-2xl border border-gray-200 bg-page pl-12 pr-4 text-sm text-ink outline-none transition-colors placeholder:text-gray-400 focus:border-navy focus:bg-white"
                        />
                      </div>
                      <div className="mt-3 text-xs text-gray-500">
                        Search across all docs pages, not just the current role.
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 grid gap-4 lg:grid-cols-4">
                    {currentSection.metrics.map((metric) => (
                      <div key={metric.label} className={`rounded-[28px] border p-5 ${toneClass[metric.tone]}`}>
                        <div className="text-3xl font-extrabold tracking-tight">{metric.value}</div>
                        <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] opacity-80">{metric.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 grid gap-3 lg:grid-cols-3">
                    {currentSection.highlights.map((highlight) => (
                      <div key={highlight} className="rounded-[28px] bg-page p-4">
                        <div className="flex gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-navy shadow-sm">
                            <CheckCircle2 size={18} />
                          </div>
                          <p className="text-sm leading-6 text-gray-700">{highlight}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {query.trim().length > 0 && (
                  <div className="card space-y-4 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="micro-label text-gray-400">Search results</div>
                        <h2 className="mt-2 text-xl font-bold text-ink">
                          {searchResults.length > 0 ? `${searchResults.length} result(s)` : 'No matches yet'}
                        </h2>
                      </div>
                      {searchResults.length > 0 && (
                        <div className="rounded-full bg-page px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                          Cross-role search
                        </div>
                      )}
                    </div>

                    {searchResults.length > 0 ? (
                      <div className="grid gap-3 lg:grid-cols-2">
                        {searchResults.map((result) => (
                          <button
                            key={result.id}
                            type="button"
                            onClick={() => onNavigate(result.path)}
                            className="motion-pressable flex items-start justify-between gap-4 rounded-[28px] border border-gray-100 bg-page p-4 text-left"
                          >
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <ResultKindLabel kind={result.kind} />
                                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                                  {result.audienceTitle}
                                </span>
                              </div>
                              <div className="text-base font-bold text-ink">{result.title}</div>
                              <p className="text-sm leading-6 text-gray-600">{result.description}</p>
                            </div>
                            <ArrowRight size={18} className="mt-1 shrink-0 text-navy" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-[28px] bg-page p-5 text-sm leading-6 text-gray-600">
                        Try searching by screen name, workflow, export, leaderboard, or a top-cell identifier such as <span className="rounded bg-white px-1.5 py-0.5 font-semibold text-ink">s0wzm8</span>.
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section id="workflows" className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="micro-label text-gray-400">Workflows</div>
                    <h2 className="mt-2 text-2xl font-bold text-ink">How this role actually works in ADL</h2>
                  </div>
                  <div className="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 shadow-sm">
                    {currentSection.workflows.length} documented flows
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  {currentSection.workflows.map((workflow) => (
                    <WorkflowCard
                      key={workflow.id}
                      workflow={workflow}
                      screens={workflow.screenIds.map((screenId) => currentScreens.find((screen) => screen.id === screenId)).filter(Boolean) as DocsScreen[]}
                    />
                  ))}
                </div>
              </section>

              <section id="screens" className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="micro-label text-gray-400">Screen inventory</div>
                    <h2 className="mt-2 text-2xl font-bold text-ink">Every documented surface for this audience</h2>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
                    <span className="rounded-full bg-forest-wash px-3 py-2 text-forest">{capturedScreenCount} visual</span>
                    <span className="rounded-full bg-gray-100 px-3 py-2 text-gray-500">{textOnlyCount} text-only</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {currentScreens.map((screen) => (
                    <ScreenCard key={screen.id} screen={screen} />
                  ))}
                </div>
              </section>

              <section id="evidence" className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="micro-label text-gray-400">Visual walkthrough</div>
                    <h2 className="mt-2 text-2xl font-bold text-ink">Captured screenshots for demos and documentation</h2>
                  </div>
                  <div className="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 shadow-sm">
                    {totalEvidenceCount} screenshots
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {evidenceGallery.map((item) => (
                    <figure key={`${item.screenTitle}-${item.src}`} className="overflow-hidden rounded-[28px] border border-gray-100 bg-white shadow-sm">
                      <div className="relative">
                        <img src={item.src} alt={item.alt} className="block h-64 w-full object-cover object-top" loading="lazy" />
                        <div className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500 shadow-sm">
                          {item.screenTitle}
                        </div>
                      </div>
                      <figcaption className="space-y-2 border-t border-gray-100 px-4 py-4">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">
                          <ImageIcon size={14} />
                          Evidence capture
                        </div>
                        <p className="text-sm leading-6 text-gray-600">{item.caption}</p>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </section>

              <section id="runbook" className="space-y-5 pb-10">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="micro-label text-gray-400">Runbook</div>
                    <h2 className="mt-2 text-2xl font-bold text-ink">Operational notes, commands, and delivery guidance</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('/')}
                    className="motion-pressable inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-navy shadow-sm"
                  >
                    <span>Return to product</span>
                    <ArrowRight size={16} />
                  </button>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  {currentSection.runbook.map((group) => (
                    <RunbookCard key={group.title} group={group} />
                  ))}
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default HelpCenter;

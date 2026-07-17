import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import ConsoleShell from '../components/Console/ConsoleShell';

test('console shell exposes responsive navigation and a visible sign-out action', () => {
  const html = renderToStaticMarkup(
    <ConsoleShell
      organization={{
        id: 'org-1',
        name: 'Meridian',
        slug: 'meridian',
        logoUrl: null,
        accentColor: '#c86b4a',
        createdAt: '2026-07-17T00:00:00.000Z',
        role: 'owner',
      }}
      organizations={[]}
      onSelectOrganization={() => {}}
      route={{ screen: 'PROJECTS' }}
      onNavigate={() => {}}
      language="en"
      onToggleLanguage={() => {}}
      onSignOut={() => {}}
      signOutPending={false}
      signOutError={null}
    >
      <p>Console content</p>
    </ConsoleShell>,
  );

  assert.match(html, /flex-col bg-page text-ink lg:flex-row/);
  assert.match(html, /aria-label="Console sections"/);
  assert.match(html, /overflow-x-auto/);
  assert.match(html, /min-h-12/);
  assert.match(html, />Sign out<\/button>/);
});

test('console shell announces sign-out failures', () => {
  const html = renderToStaticMarkup(
    <ConsoleShell
      organization={null}
      organizations={[]}
      onSelectOrganization={() => {}}
      route={{ screen: 'PROJECTS' }}
      onNavigate={() => {}}
      language="fr"
      onToggleLanguage={() => {}}
      onSignOut={() => {}}
      signOutPending={false}
      signOutError="Impossible de se déconnecter"
    >
      <p>Contenu</p>
    </ConsoleShell>,
  );

  assert.match(html, /role="alert"/);
  assert.match(html, /Impossible de se déconnecter/);
  assert.match(html, />Se déconnecter<\/button>/);
});

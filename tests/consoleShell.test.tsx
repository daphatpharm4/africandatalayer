import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import ConsoleShell from '../components/Console/ConsoleShell';
import RoleWorkspaceScreen from '../components/Console/RoleWorkspaceScreen';

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
      isAdlAdmin
    >
      <p>Console content</p>
    </ConsoleShell>,
  );

  assert.match(html, /flex-col bg-page text-ink lg:flex-row/);
  assert.match(html, /aria-label="Console sections"/);
  assert.match(html, /overflow-x-auto/);
  assert.match(html, /min-h-12/);
  assert.match(html, />Sign out<\/button>/);
  assert.match(html, />Create company<\/button>/);
});

test('console shell navigation follows the selected company role', () => {
  const renderFor = (role: 'viewer' | 'reviewer' | 'manager' | 'owner') => renderToStaticMarkup(
    <ConsoleShell
      organization={{ id: 'org-1', name: 'Meridian', slug: 'meridian', logoUrl: null, accentColor: null, createdAt: '', role }}
      organizations={[]}
      onSelectOrganization={() => {}}
      route={{ screen: 'OVERVIEW' }}
      onNavigate={() => {}}
      language="en"
      onToggleLanguage={() => {}}
      onSignOut={() => {}}
      signOutPending={false}
      signOutError={null}
    ><p>Content</p></ConsoleShell>,
  );
  const viewer = renderFor('viewer');
  assert.match(viewer, />Workspace<\/button>/);
  assert.match(viewer, />Projects<\/button>/);
  assert.doesNotMatch(viewer, />Review queue<\/button>/);
  assert.doesNotMatch(viewer, />Members<\/button>/);

  const reviewer = renderFor('reviewer');
  assert.match(reviewer, />Review queue<\/button>/);
  assert.doesNotMatch(reviewer, />Members<\/button>/);

  const manager = renderFor('manager');
  assert.match(manager, />Members<\/button>/);
  assert.doesNotMatch(manager, />Settings<\/button>/);

  const owner = renderFor('owner');
  assert.match(owner, />Settings<\/button>/);
  assert.doesNotMatch(owner, />Create company<\/button>/);
});

test('each company role receives a dedicated work landing', () => {
  const organization = { id: 'org-1', name: 'Meridian', slug: 'meridian', logoUrl: null, accentColor: null, createdAt: '' };
  const renderFor = (role: 'viewer' | 'reviewer' | 'manager' | 'owner') => renderToStaticMarkup(
    <RoleWorkspaceScreen organization={{ ...organization, role }} language="en" onNavigate={() => {}} />,
  );
  assert.match(renderFor('viewer'), /Data viewer workspace/);
  assert.match(renderFor('reviewer'), /Review workspace/);
  assert.match(renderFor('manager'), /Operations workspace/);
  assert.match(renderFor('owner'), /Company administration/);
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

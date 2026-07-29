import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DecisionBar from '../components/shared/DecisionBar.js';
import StatusBadge from '../components/shared/StatusBadge.js';

test('status badge uses text, icon, and optional live announcement', () => {
  const html = renderToStaticMarkup(<StatusBadge status="offline" label="Offline" live />);
  assert.match(html, /role="status"/);
  assert.match(html, /Offline/);
  assert.match(html, /aria-hidden="true"/);
});

test('decision bar distinguishes success and destructive actions', () => {
  const html = renderToStaticMarkup(<DecisionBar status="flagged" statusLabel="Needs review" actions={[
    { id: 'reject', label: 'Reject', intent: 'danger', onSelect: () => undefined },
    { id: 'approve', label: 'Approve', intent: 'success', onSelect: () => undefined },
  ]} />);
  assert.match(html, /bg-danger/);
  assert.match(html, /bg-forest/);
  assert.match(html, /min-h-12/);
});

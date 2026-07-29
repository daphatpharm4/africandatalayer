import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import AnalyticsScreen from '../components/Console/AnalyticsScreen';

test('owner analytics exposes the complete tenant intelligence workspace', () => {
  const html = renderToStaticMarkup(
    <AnalyticsScreen
      organizationId="5a2f8f18-0000-4000-8000-000000000001"
      role="owner"
      language="en"
    />,
  );

  assert.match(html, /Owner intelligence/);
  assert.match(html, />Delta dashboard<\/button>/);
  assert.match(html, />Investor dashboard<\/button>/);
  assert.match(html, />Categories<\/button>/);
  assert.match(html, />Agent performance<\/button>/);
  assert.match(html, />Assistant<\/button>/);
  assert.match(html, /Every dashboard and answer is calculated only from the selected company/);
});

test('non-owner analytics does not expose owner investor or assistant views', () => {
  const html = renderToStaticMarkup(
    <AnalyticsScreen
      organizationId="5a2f8f18-0000-4000-8000-000000000001"
      role="collector"
      language="en"
    />,
  );

  assert.match(html, />Categories<\/button>/);
  assert.match(html, />Agent performance<\/button>/);
  assert.doesNotMatch(html, />Investor dashboard<\/button>/);
  assert.doesNotMatch(html, />Assistant<\/button>/);
});

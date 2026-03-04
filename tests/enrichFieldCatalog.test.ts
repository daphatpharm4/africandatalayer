import test from 'node:test';
import assert from 'node:assert/strict';
import { ENRICH_FIELD_CATALOG } from '../shared/enrichFieldCatalog.js';
import { VERTICALS } from '../shared/verticals.js';

test('enrich field catalog covers all configured enrichable fields', () => {
  const missing: string[] = [];
  for (const vertical of Object.values(VERTICALS)) {
    for (const field of vertical.enrichableFields) {
      if (!ENRICH_FIELD_CATALOG[field]) {
        missing.push(`${vertical.id}:${field}`);
      }
    }
  }
  assert.deepEqual(missing, [], `Missing enrich field definitions: ${missing.join(', ')}`);
});

test('enrich field catalog only uses supported input kinds', () => {
  const allowedKinds = new Set(['boolean', 'text', 'number', 'single_select', 'multi_select', 'map_value']);
  for (const [field, config] of Object.entries(ENRICH_FIELD_CATALOG)) {
    assert.ok(allowedKinds.has(config.kind), `Unsupported kind for ${field}: ${config.kind}`);
  }
});

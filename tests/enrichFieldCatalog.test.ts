import test from 'node:test';
import assert from 'node:assert/strict';
import { ENRICH_FIELD_CATALOG } from '../shared/enrichFieldCatalog.js';
import { VERTICALS } from '../shared/verticals.js';

const OPERATOR_FIELD_LABELS = {
  hasEssentialMedicinesAvailable: {
    labelEn: 'Essential medicines available',
    labelFr: 'Médicaments essentiels disponibles',
  },
  hasMin50000XafAvailable: {
    labelEn: 'At least 50,000 XAF cash available',
    labelFr: 'Au moins 50 000 XAF disponibles en espèces',
  },
  isQueueBusy: { labelEn: 'Long queue', labelFr: 'File d’attente longue' },
  isFoodAvailableNow: {
    labelEn: 'Food currently available',
    labelFr: 'Nourriture disponible actuellement',
  },
  isSeatingAvailableNow: {
    labelEn: 'Seating currently available',
    labelFr: 'Places assises disponibles actuellement',
  },
  isOperational: {
    labelEn: 'Operational / undamaged',
    labelFr: 'Opérationnel / intact',
  },
  isFlooded: { labelEn: 'Flooded', labelFr: 'Inondée' },
  hasWorkingStreetLight: {
    labelEn: 'Street lighting working',
    labelFr: 'Éclairage public fonctionnel',
  },
  hasWater: { labelEn: 'Water available', labelFr: 'Eau disponible' },
} as const;

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

test('new operator fields use the approved bilingual boolean metadata', () => {
  for (const [field, labels] of Object.entries(OPERATOR_FIELD_LABELS)) {
    assert.deepEqual(ENRICH_FIELD_CATALOG[field], { ...labels, kind: 'boolean' });
  }
});

test('enrich field catalog only uses supported input kinds', () => {
  const allowedKinds = new Set(['boolean', 'text', 'number', 'single_select', 'multi_select', 'map_value']);
  for (const [field, config] of Object.entries(ENRICH_FIELD_CATALOG)) {
    assert.ok(allowedKinds.has(config.kind), `Unsupported kind for ${field}: ${config.kind}`);
  }
});

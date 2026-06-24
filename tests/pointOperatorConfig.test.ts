import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPointOperatorControl,
  getPointOperatorControls,
  resolvePointOperatorExpiry,
} from '../lib/server/pointOperatorConfig.js';
import type { SubmissionCategory } from '../shared/types.js';
import { getVertical } from '../shared/verticals.js';

const EXPECTED_CONTROLS = {
  pharmacy: [
    {
      field: 'isOpenNow',
      labelEn: 'Open now',
      labelFr: 'Ouvert maintenant',
      expiryHours: 6,
    },
    {
      field: 'isOnDuty',
      labelEn: 'On guard',
      labelFr: 'De garde',
      expiryHours: 12,
    },
    {
      field: 'hasEssentialMedicinesAvailable',
      labelEn: 'Essential medicines available',
      labelFr: 'Médicaments essentiels disponibles',
      expiryHours: 24,
    },
  ],
  mobile_money: [
    {
      field: 'isOpenNow',
      labelEn: 'Open now',
      labelFr: 'Ouvert maintenant',
      expiryHours: 6,
    },
    {
      field: 'hasMin50000XafAvailable',
      labelEn: 'At least 50,000 XAF cash available',
      labelFr: 'Au moins 50 000 XAF disponibles en espèces',
      expiryHours: 4,
    },
    {
      field: 'hasFloat',
      labelEn: 'Electronic float available',
      labelFr: 'Liquidité électronique disponible',
      expiryHours: 4,
    },
  ],
  fuel_station: [
    {
      field: 'isOpenNow',
      labelEn: 'Open now',
      labelFr: 'Ouvert maintenant',
      expiryHours: 6,
    },
    {
      field: 'hasFuelAvailable',
      labelEn: 'Fuel available',
      labelFr: 'Carburant disponible',
      expiryHours: 6,
    },
    {
      field: 'isQueueBusy',
      labelEn: 'Long queue',
      labelFr: 'File d’attente longue',
      expiryHours: 2,
    },
  ],
  alcohol_outlet: [
    {
      field: 'isOpenNow',
      labelEn: 'Open now',
      labelFr: 'Ouvert maintenant',
      expiryHours: 6,
    },
    {
      field: 'isFoodAvailableNow',
      labelEn: 'Food currently available',
      labelFr: 'Nourriture disponible actuellement',
      expiryHours: 6,
    },
    {
      field: 'isSeatingAvailableNow',
      labelEn: 'Seating currently available',
      labelFr: 'Places assises disponibles actuellement',
      expiryHours: 6,
    },
  ],
  billboard: [
    {
      field: 'isOccupied',
      labelEn: 'Currently occupied',
      labelFr: 'Actuellement occupé',
      expiryHours: 168,
    },
    {
      field: 'isLit',
      labelEn: 'Lit at night',
      labelFr: 'Éclairé la nuit',
      expiryHours: 720,
    },
    {
      field: 'isOperational',
      labelEn: 'Operational / undamaged',
      labelFr: 'Opérationnel / intact',
      expiryHours: 168,
    },
  ],
  transport_road: [
    {
      field: 'isBlocked',
      labelEn: 'Blocked',
      labelFr: 'Bloquée',
      expiryHours: 4,
    },
    {
      field: 'isFlooded',
      labelEn: 'Flooded',
      labelFr: 'Inondée',
      expiryHours: 4,
    },
    {
      field: 'hasWorkingStreetLight',
      labelEn: 'Street lighting working',
      labelFr: 'Éclairage public fonctionnel',
      expiryHours: 168,
    },
  ],
  census_proxy: [
    {
      field: 'hasElectricity',
      labelEn: 'Electricity available',
      labelFr: 'Électricité disponible',
      expiryHours: 720,
    },
    {
      field: 'hasWater',
      labelEn: 'Water available',
      labelFr: 'Eau disponible',
      expiryHours: 720,
    },
    {
      field: 'hasCommercialGround',
      labelEn: 'Commercial ground floor active',
      labelFr: 'Rez-de-chaussée commercial actif',
      expiryHours: 720,
    },
  ],
} as const satisfies Record<
  SubmissionCategory,
  readonly {
    field: string;
    labelEn: string;
    labelFr: string;
    expiryHours: number;
  }[]
>;

test('every vertical exposes the exact approved operator-control matrix', () => {
  for (const [category, expected] of Object.entries(EXPECTED_CONTROLS) as Array<
    [SubmissionCategory, (typeof EXPECTED_CONTROLS)[SubmissionCategory]]
  >) {
    const controls = getPointOperatorControls(category);
    assert.ok(controls.length >= 1);
    assert.ok(controls.length <= 3);
    assert.equal(
      new Set(controls.map((control) => control.field)).size,
      controls.length,
    );
    assert.deepEqual(controls, expected);
  }
});

test('every operator field is enrichable and normalized as a boolean', () => {
  for (const [category, controls] of Object.entries(EXPECTED_CONTROLS) as Array<
    [SubmissionCategory, (typeof EXPECTED_CONTROLS)[SubmissionCategory]]
  >) {
    const vertical = getVertical(category);
    const raw = Object.fromEntries(
      controls.map((control) => [control.field, 'yes']),
    );
    const normalized = vertical.normalizeDetails(raw);

    for (const control of controls) {
      assert.ok(
        vertical.enrichableFields.includes(control.field),
        `${category}:${control.field} must be enrichable`,
      );
      assert.equal(
        normalized[control.field],
        true,
        `${category}:${control.field} must normalize to boolean`,
      );
    }
  }
});

test('pharmacy open-now expires exactly six hours after report time', () => {
  const expiry = resolvePointOperatorExpiry(
    'pharmacy',
    'isOpenNow',
    new Date('2026-06-24T08:00:00.000Z'),
  );
  assert.equal(expiry.toISOString(), '2026-06-24T14:00:00.000Z');
});

test('operator-control lookup fails closed for unsupported fields', () => {
  assert.equal(getPointOperatorControl('pharmacy', 'hasFuelAvailable'), null);
  assert.throws(
    () =>
      resolvePointOperatorExpiry('pharmacy', 'hasFuelAvailable', new Date()),
    /not allowed/,
  );
});

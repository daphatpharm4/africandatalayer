import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {
  PHASH_THRESHOLD,
  DHASH_THRESHOLD,
  computePhash,
  computeDhash,
  hammingDistanceHex,
  encodeSegments,
  scoreCandidate,
} from '../lib/server/imageSimilarity.js';

async function makeSolidPng(r: number, g: number, b: number): Promise<Buffer> {
  return await sharp({
    create: { width: 64, height: 64, channels: 3, background: { r, g, b } },
  })
    .png()
    .toBuffer();
}

async function makeCheckerPng(tile: number): Promise<Buffer> {
  const size = 64;
  const channels = 3;
  const raw = Buffer.alloc(size * size * channels);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const on = (Math.floor(x / tile) + Math.floor(y / tile)) % 2 === 0;
      const v = on ? 255 : 0;
      const i = (y * size + x) * channels;
      raw[i] = v;
      raw[i + 1] = v;
      raw[i + 2] = v;
    }
  }
  return await sharp(raw, { raw: { width: size, height: size, channels } }).png().toBuffer();
}

test('computePhash is deterministic and 16-char hex', async () => {
  const buf = await makeCheckerPng(8);
  const a = await computePhash(buf);
  const b = await computePhash(buf);
  assert.ok(a, 'phash should not be null');
  assert.equal(a, b);
  assert.equal(a!.length, 16);
  assert.match(a!, /^[0-9a-f]+$/);
});

test('computeDhash is deterministic and 16-char hex', async () => {
  const buf = await makeCheckerPng(8);
  const a = await computeDhash(buf);
  const b = await computeDhash(buf);
  assert.ok(a, 'dhash should not be null');
  assert.equal(a, b);
  assert.equal(a!.length, 16);
  assert.match(a!, /^[0-9a-f]+$/);
});

test('phash distinguishes visually different images', async () => {
  const red = await makeSolidPng(255, 0, 0);
  const checker = await makeCheckerPng(8);
  const hRed = await computePhash(red);
  const hChecker = await computePhash(checker);
  assert.ok(hRed && hChecker);
  assert.notEqual(hRed, hChecker);
  // Distant in hash space — well above the AND-rule threshold.
  assert.ok(hammingDistanceHex(hRed!, hChecker!) > PHASH_THRESHOLD);
});

test('phash treats re-encoded copy of the same image as near-duplicate', async () => {
  const checker = await makeCheckerPng(8);
  // Re-encode the same pixels through JPEG quality 60 → different bytes, same content.
  const reencoded = await sharp(checker).jpeg({ quality: 60 }).toBuffer();
  const a = await computePhash(checker);
  const b = await computePhash(reencoded);
  assert.ok(a && b);
  assert.ok(hammingDistanceHex(a!, b!) <= PHASH_THRESHOLD,
    `expected re-encoded copy within pHash threshold, got distance=${hammingDistanceHex(a!, b!)}`);
});

test('encodeSegments splits 64-bit hex into 4 signed int16 values', () => {
  // 0x0001_7fff_8000_ffff → segs = [1, 32767, -32768, -1]
  const segs = encodeSegments('00017fff8000ffff');
  assert.deepEqual(segs, [1, 32767, -32768, -1]);
});

test('encodeSegments returns null for invalid length or non-hex input', () => {
  assert.equal(encodeSegments('abc'), null);
  assert.equal(encodeSegments('zzzzzzzzzzzzzzzz'), null);
});

test('hammingDistanceHex: 0 for identical, 64 for inverse', () => {
  assert.equal(hammingDistanceHex('0000000000000000', '0000000000000000'), 0);
  assert.equal(hammingDistanceHex('0000000000000000', 'ffffffffffffffff'), 64);
  assert.equal(hammingDistanceHex('00000000000000ff', '0000000000000000'), 8);
});

test('scoreCandidate AND-rule fires only when both thresholds met', () => {
  const inputPhash = '0000000000000000';
  const inputDhash = '0000000000000000';
  // Within both thresholds → passes
  const close = scoreCandidate(
    {
      eventId: 'e1',
      pointId: 'p1',
      userId: 'u1',
      phash: '0000000000000003', // distance 2
      dhash: '0000000000000003', // distance 2
    },
    inputPhash,
    inputDhash,
  );
  assert.equal(close.passesAndRule, true);
  assert.equal(close.phashDistance, 2);
  assert.equal(close.dhashDistance, 2);

  // pHash within threshold, dHash beyond → fails
  const dhashFar = scoreCandidate(
    {
      eventId: 'e2',
      pointId: 'p1',
      userId: 'u1',
      phash: '0000000000000003',
      dhash: 'ffffffffffffffff', // distance 64
    },
    inputPhash,
    inputDhash,
  );
  assert.equal(dhashFar.passesAndRule, false);

  // pHash beyond threshold → fails regardless of dHash
  const phashFar = scoreCandidate(
    {
      eventId: 'e3',
      pointId: 'p1',
      userId: 'u1',
      phash: 'ffffffffffffffff',
      dhash: '0000000000000000',
    },
    inputPhash,
    inputDhash,
  );
  assert.equal(phashFar.passesAndRule, false);

  // dHash missing on candidate → AND-rule cannot fire
  const noDhash = scoreCandidate(
    {
      eventId: 'e4',
      pointId: 'p1',
      userId: 'u1',
      phash: '0000000000000000',
      dhash: null,
    },
    inputPhash,
    inputDhash,
  );
  assert.equal(noDhash.passesAndRule, false);
  assert.equal(noDhash.dhashDistance, null);
});

void DHASH_THRESHOLD;

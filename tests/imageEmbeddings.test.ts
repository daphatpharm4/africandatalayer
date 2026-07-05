import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMBEDDING_DIM,
  EMBEDDING_MODEL_VERSION,
  EMBEDDING_HARD_DUP_SIM,
  EMBEDDING_SOFT_DUP_SIM,
  EmbeddingProviderError,
  getEmbeddingProvider,
  setEmbeddingProviderForTesting,
  type EmbeddingProvider,
} from '../lib/server/imageEmbeddings.js';

test('getEmbeddingProvider returns null when IMAGE_EMBEDDING_ENABLED is unset', () => {
  const prev = process.env.IMAGE_EMBEDDING_ENABLED;
  delete process.env.IMAGE_EMBEDDING_ENABLED;
  setEmbeddingProviderForTesting(null);
  try {
    assert.equal(getEmbeddingProvider(), null);
  } finally {
    if (prev !== undefined) process.env.IMAGE_EMBEDDING_ENABLED = prev;
  }
});

test('getEmbeddingProvider returns a provider when enabled', () => {
  const prev = process.env.IMAGE_EMBEDDING_ENABLED;
  process.env.IMAGE_EMBEDDING_ENABLED = 'true';
  setEmbeddingProviderForTesting(null);
  try {
    const provider = getEmbeddingProvider();
    assert.ok(provider);
    assert.equal(provider!.modelVersion, EMBEDDING_MODEL_VERSION);
  } finally {
    if (prev === undefined) delete process.env.IMAGE_EMBEDDING_ENABLED;
    else process.env.IMAGE_EMBEDDING_ENABLED = prev;
    setEmbeddingProviderForTesting(null);
  }
});

test('test seam can inject a fake provider', async () => {
  const fake: EmbeddingProvider = {
    modelVersion: 'fake-v1',
    embedImage: async () => new Array(EMBEDDING_DIM).fill(0).map((_, i) => i / EMBEDDING_DIM),
  };
  const prev = process.env.IMAGE_EMBEDDING_ENABLED;
  process.env.IMAGE_EMBEDDING_ENABLED = 'true';
  setEmbeddingProviderForTesting(fake);
  try {
    const provider = getEmbeddingProvider();
    assert.equal(provider, fake);
    const vec = await provider!.embedImage(Buffer.from(''));
    assert.equal(vec.length, EMBEDDING_DIM);
  } finally {
    setEmbeddingProviderForTesting(null);
    if (prev === undefined) delete process.env.IMAGE_EMBEDDING_ENABLED;
    else process.env.IMAGE_EMBEDDING_ENABLED = prev;
  }
});

test('thresholds are ordered: hard <= soft', () => {
  // The hard threshold (used in the AND-rule with Stage A) is lower than the
  // soft "Stage B alone" threshold — Stage B alone needs stronger evidence.
  assert.ok(EMBEDDING_HARD_DUP_SIM <= EMBEDDING_SOFT_DUP_SIM);
  assert.ok(EMBEDDING_HARD_DUP_SIM > 0 && EMBEDDING_HARD_DUP_SIM < 1);
});

test('EmbeddingProviderError preserves cause', () => {
  const cause = new Error('boom');
  const err = new EmbeddingProviderError('wrap', cause);
  assert.equal(err.name, 'EmbeddingProviderError');
  assert.equal((err as Error & { cause?: unknown }).cause, cause);
});

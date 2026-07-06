import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { EMBEDDING_DIM, setEmbeddingProviderForTesting, setEmbeddingQueryForTesting, type EmbeddingProvider } from "../lib/server/imageEmbeddings.js";
import { runEmbeddingDrain, setImageSimilarityCronQueryForTesting } from "../lib/server/imageSimilarityCron.js";

function result<T>(rows: T[], rowCount = rows.length): { rows: T[]; rowCount: number } {
  return { rows, rowCount };
}

async function makePng(): Promise<Buffer> {
  return await sharp({
    create: { width: 16, height: 16, channels: 3, background: { r: 20, g: 80, b: 140 } },
  })
    .png()
    .toBuffer();
}

function setFetchImage(bytes: Buffer): () => void {
  const previous = globalThis.fetch;
  globalThis.fetch = (async () => new Response(bytes, { status: 200 })) as typeof fetch;
  return () => {
    globalThis.fetch = previous;
  };
}

afterEach(() => {
  delete process.env.IMAGE_EMBEDDING_ENABLED;
  delete process.env.IMAGE_EMBEDDING_REVIEW_UPGRADE_ENABLED;
  setEmbeddingProviderForTesting(null);
  setEmbeddingQueryForTesting(null);
  setImageSimilarityCronQueryForTesting(null);
});

test("runEmbeddingDrain is a clean no-op when embedding provider is disabled", async () => {
  delete process.env.IMAGE_EMBEDDING_ENABLED;
  setEmbeddingProviderForTesting(null);
  const output = await runEmbeddingDrain(Date.now() + 1000);
  assert.deepEqual(output, {
    scanned: 0,
    embedded: 0,
    failed: 0,
    skippedNoProvider: true,
    statusUpgrades: 0,
    outOfBudget: false,
  });
});

test("runEmbeddingDrain records high-similarity evidence without upgrading unless gated on", async () => {
  process.env.IMAGE_EMBEDDING_ENABLED = "true";
  delete process.env.IMAGE_EMBEDDING_REVIEW_UPGRADE_ENABLED;
  const restoreFetch = setFetchImage(await makePng());
  const vector = new Array(EMBEDDING_DIM).fill(0);
  const provider: EmbeddingProvider = {
    modelVersion: "fake-v1",
    embedImage: async () => vector,
  };
  setEmbeddingProviderForTesting(provider);

  const events: Array<{ kind: string; values: unknown[] }> = [];
  const fakeQuery = async (sql: string, values: unknown[] = []) => {
    if (sql.includes("WITH next AS")) {
      events.push({ kind: "claim", values });
      return result([{ event_id: "00000000-0000-0000-0000-000000000001", photo_url: "https://example.test/a.png", phash: null }]);
    }
    if (sql.includes("INSERT INTO submission_image_embeddings")) {
      events.push({ kind: "persist", values });
      return result([]);
    }
    if (sql.includes("FROM submission_image_embeddings")) {
      events.push({ kind: "ann", values });
      return result([{ event_id: "00000000-0000-0000-0000-000000000002", sim: 0.97 }]);
    }
    if (sql.includes("INSERT INTO submission_image_similarity_matches")) {
      events.push({ kind: "match", values });
      return result([]);
    }
    if (sql.includes("SET embedding_status = $2")) {
      events.push({ kind: "status", values });
      return result([]);
    }
    events.push({ kind: "other", values });
    return result([]);
  };
  setImageSimilarityCronQueryForTesting(fakeQuery as never);
  setEmbeddingQueryForTesting(fakeQuery as never);

  try {
    const output = await runEmbeddingDrain(Date.now() + 5000);
    assert.equal(output.embedded, 1);
    assert.equal(output.statusUpgrades, 0);
    assert.equal(events.some((e) => e.kind === "claim"), true);
    assert.equal(events.some((e) => e.kind === "ann"), true);
    const match = events.find((e) => e.kind === "match");
    assert.ok(match);
    assert.equal(match.values[5], "logged");
    assert.equal(events.some((e) => e.kind === "status" && e.values[1] === "done"), true);
  } finally {
    restoreFetch();
  }
});

test("runEmbeddingDrain upgrades recent auto-approved rows when the review gate is enabled", async () => {
  process.env.IMAGE_EMBEDDING_ENABLED = "true";
  process.env.IMAGE_EMBEDDING_REVIEW_UPGRADE_ENABLED = "true";
  const restoreFetch = setFetchImage(await makePng());
  setEmbeddingProviderForTesting({
    modelVersion: "fake-v1",
    embedImage: async () => new Array(EMBEDDING_DIM).fill(0),
  });

  const decisions: string[] = [];
  const fakeQuery = async (sql: string, values: unknown[] = []) => {
    if (sql.includes("WITH next AS")) {
      return result([{ event_id: "00000000-0000-0000-0000-000000000001", photo_url: "https://example.test/a.png", phash: null }]);
    }
    if (sql.includes("FROM submission_image_embeddings")) {
      return result([{ event_id: "00000000-0000-0000-0000-000000000002", sim: 0.97 }]);
    }
    if (sql.includes("SET details = jsonb_set")) {
      return result([], 1);
    }
    if (sql.includes("INSERT INTO submission_image_similarity_matches")) {
      decisions.push(String(values[5]));
    }
    return result([]);
  };
  setImageSimilarityCronQueryForTesting(fakeQuery as never);
  setEmbeddingQueryForTesting(fakeQuery as never);

  try {
    const output = await runEmbeddingDrain(Date.now() + 5000);
    assert.equal(output.embedded, 1);
    assert.equal(output.statusUpgrades, 1);
    assert.deepEqual(decisions, ["pending_review"]);
  } finally {
    restoreFetch();
  }
});

test("runEmbeddingDrain returns failed rows to retry queue before terminal failure", async () => {
  process.env.IMAGE_EMBEDDING_ENABLED = "true";
  const restoreFetch = setFetchImage(await makePng());
  setEmbeddingProviderForTesting({
    modelVersion: "fake-v1",
    embedImage: async () => {
      throw new Error("provider unavailable");
    },
  });

  const failures: unknown[][] = [];
  const fakeQuery = async (sql: string, values: unknown[] = []) => {
    if (sql.includes("WITH next AS")) {
      return result([{ event_id: "00000000-0000-0000-0000-000000000001", photo_url: "https://example.test/a.png", phash: null }]);
    }
    if (sql.includes("embedding_attempts = embedding_attempts + 1")) {
      failures.push(values);
      return result([{ embedding_status: "pending" }]);
    }
    return result([]);
  };
  setImageSimilarityCronQueryForTesting(fakeQuery as never);
  setEmbeddingQueryForTesting(fakeQuery as never);

  try {
    const output = await runEmbeddingDrain(Date.now() + 5000);
    assert.equal(output.embedded, 0);
    assert.equal(output.failed, 1);
    assert.equal(failures.length, 1);
    assert.equal(failures[0][1], "provider unavailable");
    assert.equal(failures[0][2], 3);
  } finally {
    restoreFetch();
  }
});

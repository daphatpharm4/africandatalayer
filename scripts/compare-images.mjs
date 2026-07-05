#!/usr/bin/env node
// Local Stage A dupe-detection harness.
//
// Usage:
//   npx tsx scripts/compare-images.mjs <imageA> <imageB> [imageC ...]
//
// Computes pHash + dHash for each input, then prints the pairwise
// Hamming distances and the AND-rule verdict (pHash <= 8 AND dHash <= 6)
// — the same rule the submission pipeline applies in Stage A.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  PHASH_THRESHOLD,
  DHASH_THRESHOLD,
  computePhash,
  computeDhash,
  hammingDistanceHex,
} from "../lib/server/imageSimilarity.ts";

const paths = process.argv.slice(2);
if (paths.length < 2) {
  console.error("Usage: npx tsx scripts/compare-images.mjs <imageA> <imageB> [imageC ...]");
  process.exit(2);
}

const hashes = await Promise.all(
  paths.map(async (p) => {
    const abs = resolve(p);
    const buf = await readFile(abs);
    const [phash, dhash] = await Promise.all([computePhash(buf), computeDhash(buf)]);
    return { path: p, phash, dhash };
  }),
);

console.log("\nHashes:");
for (const h of hashes) {
  console.log(`  ${h.path}`);
  console.log(`    pHash: ${h.phash ?? "(failed)"}`);
  console.log(`    dHash: ${h.dhash ?? "(failed)"}`);
}

console.log(`\nThresholds: pHash <= ${PHASH_THRESHOLD} AND dHash <= ${DHASH_THRESHOLD}\n`);
console.log("Pairwise:");
for (let i = 0; i < hashes.length; i++) {
  for (let j = i + 1; j < hashes.length; j++) {
    const a = hashes[i];
    const b = hashes[j];
    const pDist = a.phash && b.phash ? hammingDistanceHex(a.phash, b.phash) : null;
    const dDist = a.dhash && b.dhash ? hammingDistanceHex(a.dhash, b.dhash) : null;
    const passes =
      pDist !== null && dDist !== null && pDist <= PHASH_THRESHOLD && dDist <= DHASH_THRESHOLD;
    const verdict = passes ? "DUPLICATE" : "distinct";
    console.log(
      `  [${i}] vs [${j}]: pHash=${pDist ?? "n/a"}  dHash=${dDist ?? "n/a"}  -> ${verdict}`,
    );
  }
}
console.log();
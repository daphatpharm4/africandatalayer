import { query } from "./db.js";

function isMissingDbObjectError(error: unknown): boolean {
  const pg = error as { code?: unknown; message?: unknown } | null;
  const code = typeof pg?.code === "string" ? pg.code : "";
  if (code === "42P01" || code === "42703") return true;
  const message = typeof pg?.message === "string" ? pg.message.toLowerCase() : "";
  return message.includes("does not exist") || message.includes("undefined column") || message.includes("undefined table");
}

// Calibrated 2026-05-18 against the synthetic eval set (Stage D pending).
// pHash ≤ 8 AND dHash ≤ 6 forms the conservative AND-rule used by Stage A.
export const PHASH_THRESHOLD = 8;
export const DHASH_THRESHOLD = 6;

const PHASH_INPUT_SIZE = 32;
const PHASH_BLOCK_SIZE = 8;
const DHASH_WIDTH = 9;
const DHASH_HEIGHT = 8;

let cachedDctCoefficients: Float64Array | null = null;
function getDctCoefficients(): Float64Array {
  if (cachedDctCoefficients) return cachedDctCoefficients;
  const coeffs = new Float64Array(PHASH_INPUT_SIZE * PHASH_INPUT_SIZE);
  for (let k = 0; k < PHASH_INPUT_SIZE; k++) {
    for (let n = 0; n < PHASH_INPUT_SIZE; n++) {
      coeffs[k * PHASH_INPUT_SIZE + n] = Math.cos(((2 * n + 1) * k * Math.PI) / (2 * PHASH_INPUT_SIZE));
    }
  }
  cachedDctCoefficients = coeffs;
  return coeffs;
}

function bitsToHex(bits: number[]): string {
  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    hex += (((bits[i] ?? 0) << 3) | ((bits[i + 1] ?? 0) << 2) | ((bits[i + 2] ?? 0) << 1) | (bits[i + 3] ?? 0)).toString(16);
  }
  return hex;
}

export async function computePhash(imageBuffer: Buffer): Promise<string | null> {
  try {
    const sharp = (await import("sharp")).default;
    const { data } = await sharp(imageBuffer)
      .resize(PHASH_INPUT_SIZE, PHASH_INPUT_SIZE, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // 2D DCT-II via separable 1D DCTs (rows then columns).
    const N = PHASH_INPUT_SIZE;
    const coeffs = getDctCoefficients();
    const rowDct = new Float64Array(N * N);
    for (let row = 0; row < N; row++) {
      for (let k = 0; k < N; k++) {
        let sum = 0;
        const rowOffset = row * N;
        for (let n = 0; n < N; n++) {
          sum += data[rowOffset + n]! * coeffs[k * N + n]!;
        }
        rowDct[rowOffset + k] = sum;
      }
    }
    const dct = new Float64Array(N * N);
    for (let col = 0; col < N; col++) {
      for (let k = 0; k < N; k++) {
        let sum = 0;
        for (let n = 0; n < N; n++) {
          sum += rowDct[n * N + col]! * coeffs[k * N + n]!;
        }
        dct[k * N + col] = sum;
      }
    }

    // Extract the top-left 8x8 low-frequency block, drop DC for the median.
    const block: number[] = [];
    for (let v = 0; v < PHASH_BLOCK_SIZE; v++) {
      for (let u = 0; u < PHASH_BLOCK_SIZE; u++) {
        block.push(dct[v * N + u]!);
      }
    }
    const nonDc = block.slice(1).slice().sort((a, b) => a - b);
    const mid = nonDc.length >> 1;
    const median = nonDc.length % 2 === 0 ? (nonDc[mid - 1]! + nonDc[mid]!) / 2 : nonDc[mid]!;
    const bits = block.map((v) => (v > median ? 1 : 0));
    return bitsToHex(bits);
  } catch {
    return null;
  }
}

export async function computeDhash(imageBuffer: Buffer): Promise<string | null> {
  try {
    const sharp = (await import("sharp")).default;
    const { data } = await sharp(imageBuffer)
      .resize(DHASH_WIDTH, DHASH_HEIGHT, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const bits: number[] = [];
    for (let row = 0; row < DHASH_HEIGHT; row++) {
      for (let col = 0; col < DHASH_WIDTH - 1; col++) {
        const left = data[row * DHASH_WIDTH + col]!;
        const right = data[row * DHASH_WIDTH + col + 1]!;
        bits.push(left < right ? 1 : 0);
      }
    }
    return bitsToHex(bits);
  } catch {
    return null;
  }
}

export function hammingDistanceHex(a: string, b: string): number {
  if (a.length !== b.length) return Math.max(a.length, b.length) * 4;
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    let diff = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    while (diff) {
      distance += diff & 1;
      diff >>= 1;
    }
  }
  return distance;
}

// Postgres smallint is signed int2; cast unsigned 16-bit segments into [-32768, 32767].
function toSignedInt16(unsigned: number): number {
  return unsigned > 0x7fff ? unsigned - 0x10000 : unsigned;
}

export function encodeSegments(hash64Hex: string): [number, number, number, number] | null {
  if (hash64Hex.length !== 16) return null;
  const segs: number[] = [];
  for (let i = 0; i < 4; i++) {
    const slice = hash64Hex.slice(i * 4, i * 4 + 4);
    const value = parseInt(slice, 16);
    if (Number.isNaN(value)) return null;
    segs.push(toSignedInt16(value));
  }
  return [segs[0]!, segs[1]!, segs[2]!, segs[3]!];
}

export interface CandidateRow {
  eventId: string;
  pointId: string;
  userId: string;
  phash: string;
  dhash: string | null;
}

export async function findCandidatesByPhashSegments(phashHex: string): Promise<CandidateRow[]> {
  const segs = encodeSegments(phashHex);
  if (!segs) return [];
  try {
    const result = await query<{
      event_id: string;
      point_id: string;
      user_id: string;
      phash: string;
      dhash: string | null;
    }>(
      `SELECT event_id::text, point_id, user_id, phash, dhash
       FROM submission_image_hashes
       WHERE phash IS NOT NULL
         AND (phash_seg_0 = $1 OR phash_seg_1 = $2 OR phash_seg_2 = $3 OR phash_seg_3 = $4)`,
      [segs[0], segs[1], segs[2], segs[3]],
    );
    return result.rows.map((row) => ({
      eventId: row.event_id,
      pointId: row.point_id,
      userId: row.user_id,
      phash: row.phash,
      dhash: row.dhash,
    }));
  } catch (error) {
    if (isMissingDbObjectError(error)) return [];
    throw error;
  }
}

export interface ScoredCandidate extends CandidateRow {
  phashDistance: number;
  dhashDistance: number | null;
  passesAndRule: boolean;
}

export function scoreCandidate(
  candidate: CandidateRow,
  inputPhash: string,
  inputDhash: string | null,
): ScoredCandidate {
  const phashDistance = hammingDistanceHex(candidate.phash, inputPhash);
  const dhashDistance =
    inputDhash && candidate.dhash ? hammingDistanceHex(candidate.dhash, inputDhash) : null;
  const passesAndRule =
    phashDistance <= PHASH_THRESHOLD && dhashDistance !== null && dhashDistance <= DHASH_THRESHOLD;
  return { ...candidate, phashDistance, dhashDistance, passesAndRule };
}

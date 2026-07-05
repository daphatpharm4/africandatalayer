import { createSign } from "node:crypto";
import { query } from "./db.js";

// Model identity stored alongside every embedding so a future model bump
// can be detected and back-filled without losing the old vectors.
export const EMBEDDING_MODEL_VERSION = "multimodalembedding@001";
export const EMBEDDING_DIM = 1408;

// AND-rule semantic threshold: cosine sim >= this AND Stage A pHash hit forces auto-block.
// Stage-B-alone threshold (pHash misses, sim >= 0.95) flips status to pending_review.
// Calibrated 2026-05-18 against synthetic eval; Stage D will re-tune.
export const EMBEDDING_HARD_DUP_SIM = 0.92;
export const EMBEDDING_SOFT_DUP_SIM = 0.95;

export class EmbeddingProviderError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "EmbeddingProviderError";
    if (cause !== undefined) (this as Error & { cause?: unknown }).cause = cause;
  }
}

export interface EmbeddingProvider {
  readonly modelVersion: string;
  embedImage(imageBuffer: Buffer): Promise<number[]>;
}

function isEmbeddingEnabled(): boolean {
  const raw = process.env.IMAGE_EMBEDDING_ENABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true";
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.status >= 500 || response.status === 429) {
        lastError = new EmbeddingProviderError(`Vertex returned ${response.status}`);
      } else {
        return response;
      }
    } catch (error) {
      lastError = error;
    }
    // Exponential backoff with jitter: 200, 400, 800 ms (±25%).
    const base = 200 * 2 ** attempt;
    const jitter = base * (0.75 + Math.random() * 0.5);
    await new Promise((resolve) => setTimeout(resolve, jitter));
  }
  throw new EmbeddingProviderError("Vertex inference failed after retries", lastError);
}

const GCP_TOKEN_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const GCP_DEFAULT_TOKEN_URI = "https://oauth2.googleapis.com/token";

interface ServiceAccountKey {
  client_email?: string;
  private_key?: string;
  token_uri?: string;
}

let cachedGcpToken: { token: string; expiresAtMs: number } | null = null;

async function mintServiceAccountToken(key: Required<Pick<ServiceAccountKey, "client_email" | "private_key">> & ServiceAccountKey): Promise<{ token: string; expiresAtMs: number }> {
  const tokenUri = key.token_uri?.trim() || GCP_DEFAULT_TOKEN_URI;
  const nowSec = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claims = Buffer.from(
    JSON.stringify({
      iss: key.client_email,
      scope: GCP_TOKEN_SCOPE,
      aud: tokenUri,
      iat: nowSec,
      exp: nowSec + 3600,
    }),
  ).toString("base64url");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(key.private_key).toString("base64url");

  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new EmbeddingProviderError(`GCP token exchange failed (${response.status}): ${text.slice(0, 200)}`);
  }
  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) {
    throw new EmbeddingProviderError("GCP token exchange returned no access_token");
  }
  // Refresh a minute before expiry so an in-flight batch never straddles it.
  return { token: payload.access_token, expiresAtMs: Date.now() + Math.max(0, (payload.expires_in ?? 3600) - 60) * 1000 };
}

async function resolveGcpAccessToken(): Promise<string> {
  // Static token override for local development only: these expire after
  // ~1h, so production must use GCP_SERVICE_ACCOUNT_KEY.
  const staticToken = process.env.GCP_ACCESS_TOKEN?.trim();
  if (staticToken) return staticToken;

  const rawKey = process.env.GCP_SERVICE_ACCOUNT_KEY?.trim();
  if (!rawKey) {
    throw new EmbeddingProviderError("Set GCP_SERVICE_ACCOUNT_KEY (service-account JSON) or GCP_ACCESS_TOKEN");
  }
  if (cachedGcpToken && Date.now() < cachedGcpToken.expiresAtMs) return cachedGcpToken.token;

  let key: ServiceAccountKey;
  try {
    key = JSON.parse(rawKey) as ServiceAccountKey;
  } catch (error) {
    throw new EmbeddingProviderError("GCP_SERVICE_ACCOUNT_KEY is not valid JSON", error);
  }
  if (!key.client_email || !key.private_key) {
    throw new EmbeddingProviderError("GCP_SERVICE_ACCOUNT_KEY is missing client_email or private_key");
  }
  cachedGcpToken = await mintServiceAccountToken({ ...key, client_email: key.client_email, private_key: key.private_key });
  return cachedGcpToken.token;
}

class VertexMultimodalEmbeddingProvider implements EmbeddingProvider {
  readonly modelVersion = EMBEDDING_MODEL_VERSION;

  private endpoint(): string {
    const project = process.env.GCP_PROJECT_ID?.trim();
    const location = process.env.GCP_LOCATION?.trim() || "us-central1";
    if (!project) throw new EmbeddingProviderError("GCP_PROJECT_ID is not configured");
    return `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${this.modelVersion}:predict`;
  }

  async embedImage(imageBuffer: Buffer): Promise<number[]> {
    const body = {
      instances: [
        {
          image: { bytesBase64Encoded: imageBuffer.toString("base64") },
        },
      ],
      parameters: { dimension: EMBEDDING_DIM },
    };
    const response = await fetchWithRetry(this.endpoint(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await resolveGcpAccessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new EmbeddingProviderError(`Vertex ${response.status}: ${text.slice(0, 200)}`);
    }
    const payload = (await response.json()) as {
      predictions?: Array<{ imageEmbedding?: number[] }>;
    };
    const vector = payload.predictions?.[0]?.imageEmbedding;
    if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIM) {
      throw new EmbeddingProviderError(`Vertex returned malformed embedding (len=${vector?.length})`);
    }
    return vector;
  }
}

let cachedProvider: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider | null {
  if (!isEmbeddingEnabled()) return null;
  if (cachedProvider) return cachedProvider;
  cachedProvider = new VertexMultimodalEmbeddingProvider();
  return cachedProvider;
}

// Test seam: swap in a fake provider without env mutation.
export function setEmbeddingProviderForTesting(provider: EmbeddingProvider | null): void {
  cachedProvider = provider;
}

function formatVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

export async function persistEmbedding(
  eventId: string,
  vector: number[],
  modelVersion: string,
): Promise<void> {
  await query(
    `INSERT INTO submission_image_embeddings (event_id, embedding, model_version)
     VALUES ($1::uuid, $2::vector, $3)
     ON CONFLICT (event_id) DO UPDATE SET
       embedding = EXCLUDED.embedding,
       model_version = EXCLUDED.model_version`,
    [eventId, formatVectorLiteral(vector), modelVersion],
  );
}

export interface SimilarEmbedding {
  eventId: string;
  similarity: number;
}

export async function findSimilarEmbeddings(
  vector: number[],
  excludeEventId: string,
  limit = 10,
): Promise<SimilarEmbedding[]> {
  const result = await query<{ event_id: string; sim: number }>(
    `SELECT event_id::text, 1 - (embedding <=> $1::vector) AS sim
     FROM submission_image_embeddings
     WHERE event_id <> $2::uuid
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [formatVectorLiteral(vector), excludeEventId, limit],
  );
  return result.rows.map((row) => ({ eventId: row.event_id, similarity: Number(row.sim) }));
}

export async function markEmbeddingStatus(
  eventId: string,
  status: "pending" | "done" | "failed" | "skipped",
): Promise<void> {
  await query(
    `UPDATE submission_image_hashes
     SET embedding_status = $2
     WHERE event_id = $1::uuid`,
    [eventId, status],
  );
}

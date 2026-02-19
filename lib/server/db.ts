import { Pool, type PoolConfig, type QueryResult } from "pg";

const NETWORK_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "53300",
  "57P01",
  "08001",
  "08006",
]);

const DEFAULT_QUERY_TIMEOUT_MS = Number(process.env.POSTGRES_QUERY_TIMEOUT_MS ?? "10000") || 10000;

let pool: Pool | null = null;

export class StorageUnavailableError extends Error {
  readonly code = "storage_unavailable";

  constructor(message: string, options: { cause?: unknown } = {}) {
    super(message);
    this.name = "StorageUnavailableError";
    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export function isStorageUnavailableError(error: unknown): error is StorageUnavailableError {
  return error instanceof StorageUnavailableError;
}

function resolveConnectionString(): string | null {
  return (
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    null
  );
}

function resolveSslConfig(connectionString: string): PoolConfig["ssl"] | undefined {
  if (process.env.POSTGRES_SSL_NO_VERIFY === "true") {
    return { rejectUnauthorized: false };
  }

  try {
    const parsed = new URL(connectionString);
    const sslMode = parsed.searchParams.get("sslmode")?.trim().toLowerCase();
    if (sslMode === "no-verify") {
      return { rejectUnauthorized: false };
    }
  } catch {
    // Ignore URL parsing issues and let pg handle connection string validation.
  }

  return undefined;
}

function classifyDatabaseError(error: unknown): Error {
  if (error instanceof StorageUnavailableError) return error;
  if (!(error instanceof Error)) {
    return new StorageUnavailableError("Storage temporarily unavailable", { cause: error });
  }

  const anyError = error as Error & { code?: string };
  const code = typeof anyError.code === "string" ? anyError.code : "";
  const message = error.message.toLowerCase();

  if (NETWORK_ERROR_CODES.has(code) || message.includes("timeout") || message.includes("failed to fetch")) {
    return new StorageUnavailableError("Storage temporarily unavailable", { cause: error });
  }

  return error;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new StorageUnavailableError(`Database query timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

export function getPool(): Pool {
  if (pool) return pool;

  const connectionString = resolveConnectionString();
  if (!connectionString) {
    throw new StorageUnavailableError("POSTGRES_URL is not configured");
  }

  const max = Number(process.env.POSTGRES_POOL_MAX ?? "5") || 5;
  const ssl = resolveSslConfig(connectionString);

  pool = new Pool({
    connectionString,
    max,
    ssl,
  });

  pool.on("error", (error) => {
    console.error("Postgres pool error", error);
  });

  return pool;
}

export async function query<T = unknown>(text: string, values: unknown[] = []): Promise<QueryResult<T>> {
  try {
    const db = getPool();
    return await withTimeout(db.query<T>(text, values), DEFAULT_QUERY_TIMEOUT_MS);
  } catch (error) {
    throw classifyDatabaseError(error);
  }
}

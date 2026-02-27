import { query } from "../../lib/server/db.js";

export async function GET(): Promise<Response> {
  let dbStatus: "ok" | "error" = "error";
  let httpStatus = 503;

  try {
    await query("SELECT 1");
    dbStatus = "ok";
    httpStatus = 200;
  } catch {
    // db unreachable
  }

  const body = JSON.stringify({ status: dbStatus === "ok" ? "ok" : "error", db: dbStatus, ts: new Date().toISOString() });
  return new Response(body, {
    status: httpStatus,
    headers: { "Content-Type": "application/json" },
  });
}

import { query } from "./db.js";

export async function createFraudAlert(input: {
  eventId?: string | null;
  userId?: string | null;
  alertCode: string;
  severity?: "low" | "medium" | "high" | "critical";
  payload?: Record<string, unknown>;
}): Promise<void> {
  await query(
    `INSERT INTO fraud_alerts (event_id, user_id, alert_code, severity, payload)
     VALUES ($1::uuid, $2, $3, $4, $5::jsonb)`,
    [
      input.eventId ?? null,
      input.userId ?? null,
      input.alertCode,
      input.severity ?? "medium",
      JSON.stringify(input.payload ?? {}),
    ],
  );

  const webhookUrl = process.env.FRAUD_ALERT_WEBHOOK_URL?.trim();
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alertCode: input.alertCode,
        severity: input.severity ?? "medium",
        userId: input.userId ?? null,
        eventId: input.eventId ?? null,
        payload: input.payload ?? {},
      }),
    });
  } catch {
    // Persisted alert remains available in-app even if webhook delivery fails.
  }
}

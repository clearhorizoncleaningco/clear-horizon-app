import "server-only";

/**
 * One-way GoHighLevel push (BUILD_SPEC §B) — STUBBED OFF in v1.
 *
 * When the feature flag is off (or no webhook URL is configured), this performs
 * NO network call and returns a `stubbed` outcome carrying the exact payload that
 * *would* be sent — which the proposal page surfaces at the Phase 2 checkpoint.
 * When enabled with a webhook URL, it POSTs the payload (create/update contact +
 * attach proposal + opportunity value) and never throws — failures are returned
 * as a `failed` outcome so the UI can show them.
 */
import { getGhlConfig } from "./config";
import type { GhlPushPayload } from "./payload";

export type GhlPushOutcome =
  | { status: "stubbed"; reason: string; wouldSend: GhlPushPayload }
  | { status: "pushed"; sentTo: string; response: unknown; wouldSend: GhlPushPayload }
  | { status: "failed"; error: string; wouldSend: GhlPushPayload };

export async function pushQuoteToGhl(payload: GhlPushPayload): Promise<GhlPushOutcome> {
  const cfg = getGhlConfig();

  if (!cfg.enabled) {
    return {
      status: "stubbed",
      reason: "GHL push is disabled (set GHL_PUSH_ENABLED=true to enable).",
      wouldSend: payload,
    };
  }
  if (!cfg.webhookUrl) {
    return {
      status: "stubbed",
      reason: "GHL push is enabled but GHL_WEBHOOK_URL is not set.",
      wouldSend: payload,
    };
  }

  try {
    const res = await fetch(cfg.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return { status: "failed", error: `GHL webhook responded ${res.status}`, wouldSend: payload };
    }
    const response: unknown = await res.json().catch(() => ({}));
    return { status: "pushed", sentTo: cfg.webhookUrl, response, wouldSend: payload };
  } catch (e) {
    return {
      status: "failed",
      error: e instanceof Error ? e.message : "Unknown error contacting GHL.",
      wouldSend: payload,
    };
  }
}

import "server-only";

/**
 * Server-side GoHighLevel feature-flag config (BUILD_SPEC §B).
 *
 * The push is STUBBED OFF until credentials are added: `GHL_PUSH_ENABLED` must be
 * "true" AND `GHL_WEBHOOK_URL` must be a valid URL for a real send to occur.
 * Read at call time (not import) so tests and Admin can flip env without a
 * rebuild. These are server-only secrets — never import this from a client bundle
 * (hence not in src/lib/env.ts, which is public-only).
 */
export interface GhlConfig {
  enabled: boolean;
  webhookUrl: string | null;
}

export function getGhlConfig(): GhlConfig {
  const enabled = /^true$/i.test((process.env.GHL_PUSH_ENABLED ?? "").trim());
  const raw = (process.env.GHL_WEBHOOK_URL ?? "").trim();
  let webhookUrl: string | null = null;
  if (raw) {
    try {
      webhookUrl = new URL(raw).toString();
    } catch {
      webhookUrl = null; // malformed URL → treat as unset (stays stubbed)
    }
  }
  return { enabled, webhookUrl };
}

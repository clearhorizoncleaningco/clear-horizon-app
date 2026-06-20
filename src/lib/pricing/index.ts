/**
 * Public surface of the pure pricing module (CLAUDE.md §3.2).
 * Import the engine + types from "@/lib/pricing" everywhere (wizard, API, tests).
 * Nothing here touches Prisma or `server-only`, so it is safe in Client Components.
 */
export * from "./types";
export {
  PricingError,
  computeResidentialQuote,
  computeCommercialQuote,
  reconcileIntensity,
  resolveBaseLaborHours,
  resolveMarketTier,
  resolveSeasonal,
  resolveTravel,
  roundToCents,
  roundUpToIncrement,
} from "./engine";
export { buildConfigFromDefaults } from "./config-from-defaults";
export { parsePricingSettings, REQUIRED_SETTING_KEYS } from "./settings";
export type { PricingSettingRow, ScalarKnobs } from "./settings";

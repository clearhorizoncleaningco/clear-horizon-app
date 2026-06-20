/**
 * Pure parser for the scalar pricing knobs stored in the PricingSetting table
 * (§E.1 Step 2 bathrooms, §E.10 intensity, §E.14 seasonal, §E.21 rounding).
 *
 * Shared by BOTH config builders so the defaults-built config and the DB-built
 * config parse identically:
 *   - config-from-defaults.ts (tests)        feeds D.PRICING_SETTINGS
 *   - src/lib/quotes/pricing-config.ts (app) feeds the DB rows
 *
 * Pure: no Prisma, no `server-only`.
 */
import type { BathroomConfig, IntensityConfig, RoundingConfig, SeasonalConfig } from "./types";

export interface PricingSettingRow {
  key: string;
  value: string;
  valueType: string; // "number" | "string" | "boolean" | "json"
}

export interface ScalarKnobs {
  bathroom: BathroomConfig;
  intensity: IntensityConfig;
  rounding: RoundingConfig;
  seasonal: SeasonalConfig;
}

/** Keys the engine relies on (seeded by prisma/seed.ts from §E defaults). */
export const REQUIRED_SETTING_KEYS = [
  "bathroom.baselineBaths",
  "bathroom.hoursPerExtraBath",
  "intensity.rule",
  "intensity.cap",
  "intensity.deepCleanPremium",
  "rounding.increment",
  "seasonal.peakMultiplier",
  "seasonal.offMultiplier",
  "seasonal.peakMonths",
] as const;

export function parsePricingSettings(rows: PricingSettingRow[]): ScalarKnobs {
  const map = new Map(rows.map((r) => [r.key, r]));

  const require = (key: string): PricingSettingRow => {
    const row = map.get(key);
    if (!row) {
      throw new Error(
        `Missing pricing setting "${key}". Re-run \`npm run db:seed\` (or restore it in Admin → Pricing).`,
      );
    }
    return row;
  };

  const num = (key: string): number => {
    const raw = require(key).value;
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      throw new Error(`Pricing setting "${key}" is not a finite number: ${JSON.stringify(raw)}`);
    }
    return n;
  };

  const rule = require("intensity.rule").value === "product" ? "product" : "max";

  const peakMonths = ((): number[] => {
    const parsed: unknown = JSON.parse(require("seasonal.peakMonths").value);
    if (!Array.isArray(parsed) || !parsed.every((m) => typeof m === "number")) {
      throw new Error('Pricing setting "seasonal.peakMonths" must be a JSON array of month numbers.');
    }
    return parsed as number[];
  })();

  return {
    bathroom: {
      baselineBaths: num("bathroom.baselineBaths"),
      hoursPerExtraBath: num("bathroom.hoursPerExtraBath"),
    },
    intensity: {
      rule,
      cap: num("intensity.cap"),
      deepCleanPremium: num("intensity.deepCleanPremium"),
    },
    rounding: {
      increment: num("rounding.increment"),
      mode: "ceil",
    },
    seasonal: {
      peakMultiplier: num("seasonal.peakMultiplier"),
      offMultiplier: num("seasonal.offMultiplier"),
      peakMonths,
    },
  };
}

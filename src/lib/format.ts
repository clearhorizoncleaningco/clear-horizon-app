/** Display formatters (pure; safe on client + server). */

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const USD0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** $1,234.56 */
export function currency(n: number): string {
  return USD.format(n);
}

/** $1,235 (no cents) — for headline rounded prices. */
export function currency0(n: number): string {
  return USD0.format(n);
}

/** Trim trailing zeros for hour displays: 5.625 → "5.625", 5 → "5". */
export function hoursLabel(n: number): string {
  const rounded = Math.round(n * 1000) / 1000;
  return `${rounded}`;
}

/** 0.2475 → "24.8%" */
export function percent(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

/** 1.1 → "×1.1" */
export function multiplier(n: number): string {
  return `×${Math.round(n * 1000) / 1000}`;
}

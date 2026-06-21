import { describe, expect, it } from "vitest";
import { describeChange, diffNumericFields, diffValue, numbersDiffer } from "./diff";

describe("numbersDiffer", () => {
  it("ignores floating-point noise", () => {
    expect(numbersDiffer(85, 85.0)).toBe(false);
    expect(numbersDiffer(0.1 + 0.2, 0.3)).toBe(false);
    expect(numbersDiffer(85, 90)).toBe(true);
  });
});

describe("diffValue", () => {
  it("detects a numeric change (Naples rate $85 → $90)", () => {
    const c = diffValue("MarketTier", "Naples", "hourlyRate", 85, 90);
    expect(c).toEqual({
      entity: "MarketTier",
      entityLabel: "Naples",
      field: "hourlyRate",
      oldValue: "85",
      newValue: "90",
    });
  });

  it("returns null when a number is unchanged", () => {
    expect(diffValue("MarketTier", "Naples", "hourlyRate", 85, 85)).toBeNull();
  });

  it("returns null when the new value was not submitted", () => {
    expect(diffValue("MarketTier", "Naples", "hourlyRate", 85, undefined)).toBeNull();
    expect(diffValue("MarketTier", "Naples", "hourlyRate", 85, null)).toBeNull();
  });

  it("compares non-numeric values as trimmed strings", () => {
    expect(diffValue("Setting", undefined, "rounding.mode", "ceil", "ceil ")).toBeNull();
    expect(diffValue("Setting", undefined, "rounding.mode", "ceil", "floor")).toMatchObject({
      oldValue: "ceil",
      newValue: "floor",
    });
  });
});

describe("diffNumericFields", () => {
  it("returns only the fields that moved", () => {
    const changes = diffNumericFields(
      "MarketTier",
      "Naples",
      { hourlyRate: 85, minimumCharge: 225 },
      { hourlyRate: 90, minimumCharge: 225 },
      ["hourlyRate", "minimumCharge"],
    );
    expect(changes).toHaveLength(1);
    expect(changes[0].field).toBe("hourlyRate");
  });
});

describe("describeChange", () => {
  it("formats a readable summary", () => {
    const c = diffValue("MarketTier", "Naples", "hourlyRate", 85, 90)!;
    expect(describeChange(c)).toBe("MarketTier (Naples) · hourlyRate: 85 → 90");
  });
});

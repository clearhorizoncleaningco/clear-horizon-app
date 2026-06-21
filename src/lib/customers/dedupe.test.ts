import { describe, expect, it } from "vitest";
import {
  findDuplicateCandidates,
  normalizeEmail,
  normalizePhone,
  scoreDuplicate,
  type CustomerLike,
} from "./dedupe";

const existing: CustomerLike[] = [
  {
    id: "c1",
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "(239) 555-0100",
    phoneNormalized: "2395550100",
    address: "123 Gulf Shore Blvd",
    city: "Naples",
    zip: "34102",
  },
  {
    id: "c2",
    name: "John Smith",
    email: "john@example.com",
    phone: "239-555-0200",
    phoneNormalized: "2395550200",
    address: "5 Bay St",
    city: "Fort Myers",
    zip: "33901",
  },
];

describe("normalizePhone", () => {
  it("strips formatting and keeps the trailing 10 digits", () => {
    expect(normalizePhone("(239) 555-0100")).toBe("2395550100");
    expect(normalizePhone("+1 239 555 0100")).toBe("2395550100");
    expect(normalizePhone("1-239-555-0100")).toBe("2395550100");
  });
  it("handles blanks", () => {
    expect(normalizePhone(null)).toBe("");
    expect(normalizePhone("")).toBe("");
  });
});

describe("normalizeEmail", () => {
  it("trims and lower-cases", () => {
    expect(normalizeEmail("  Jane@Example.COM ")).toBe("jane@example.com");
  });
});

describe("scoreDuplicate", () => {
  it("flags an exact email match as the strongest signal", () => {
    const c = scoreDuplicate(existing[0], { email: "JANE@example.com" });
    expect(c.score).toBe(100);
    expect(c.reasons).toContain("Same email");
  });

  it("flags a phone match across different formatting", () => {
    const c = scoreDuplicate(existing[0], { phone: "239.555.0100" });
    expect(c.score).toBe(95);
    expect(c.reasons).toContain("Same phone");
  });

  it("flags name + ZIP as a medium signal, name-only as weak", () => {
    const nameZip = scoreDuplicate(existing[0], { name: "jane doe", zip: "34102" });
    expect(nameZip.score).toBe(75);
    expect(nameZip.reasons).toContain("Same name & ZIP");

    const nameOnly = scoreDuplicate(existing[0], { name: "Jane Doe", zip: "99999" });
    expect(nameOnly.score).toBe(45);
    expect(nameOnly.reasons).toContain("Same name");
  });

  it("does not match a 1-2 digit phone fragment", () => {
    const c = scoreDuplicate(existing[0], { phone: "55" });
    expect(c.score).toBe(0);
  });

  it("returns zero for an unrelated query", () => {
    const c = scoreDuplicate(existing[0], { name: "Nobody", email: "no@one.com", phone: "8888888888" });
    expect(c.score).toBe(0);
    expect(c.reasons).toHaveLength(0);
  });
});

describe("findDuplicateCandidates", () => {
  it("returns the matching customer, strongest first", () => {
    const matches = findDuplicateCandidates(existing, { email: "john@example.com" });
    expect(matches).toHaveLength(1);
    expect(matches[0].customer.id).toBe("c2");
  });

  it("excludes weak/no matches below the threshold", () => {
    const matches = findDuplicateCandidates(existing, { name: "Totally Different" });
    expect(matches).toHaveLength(0);
  });

  it("ranks an email match above a name-only match", () => {
    const matches = findDuplicateCandidates(
      [...existing, { id: "c3", name: "Jane Doe", zip: "00000" }],
      { name: "Jane Doe", email: "jane@example.com" },
    );
    expect(matches[0].customer.id).toBe("c1"); // email (100) beats name-only (45)
    expect(matches.map((m) => m.customer.id)).toContain("c3");
  });
});

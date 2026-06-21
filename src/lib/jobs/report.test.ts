import { describe, expect, it } from "vitest";
import { buildPhotoReport, type BuildPhotoReportInput } from "./report";

const provider = {
  companyName: "Clear Horizon Cleaning Co.",
  tagline: "Clean Spaces. Better Places.",
  email: "admin@clearhorizoncleaners.com",
  phone: "(239) 396-5740",
  website: "https://www.clearhorizoncleaners.com",
};

function input(overrides: Partial<BuildPhotoReportInput> = {}): BuildPhotoReportInput {
  return {
    reference: "CH-JOB-1234",
    customerName: "Jane Doe",
    summary: "2,200 sq ft · 3 bd / 2.5 ba · Naples",
    completedAt: new Date("2026-06-21T15:00:00.000Z"),
    address: "123 Gulf Shore Blvd",
    city: "Naples",
    provider,
    photos: [
      { kind: "Before", storagePath: "/brand/sample-before-kitchen.jpg", caption: "Kitchen", room: "Kitchen", sortOrder: 1 },
      { kind: "After", storagePath: "/brand/sample-after-kitchen.jpg", caption: "Kitchen", room: "Kitchen", sortOrder: 1 },
      { kind: "After", storagePath: "/brand/sample-after-bath.jpg", caption: "Primary bath", room: "Bath", sortOrder: 0 },
    ],
    ...overrides,
  };
}

describe("buildPhotoReport", () => {
  it("splits before/after photos and sorts by sortOrder", () => {
    const doc = buildPhotoReport(input());
    expect(doc.beforePhotos).toHaveLength(1);
    expect(doc.afterPhotos).toHaveLength(2);
    expect(doc.afterPhotos[0].storagePath).toBe("/brand/sample-after-bath.jpg"); // sortOrder 0 first
  });

  it("carries the customer + service context and a thank-you", () => {
    const doc = buildPhotoReport(input());
    expect(doc.customerName).toBe("Jane Doe");
    expect(doc.summary).toContain("2,200 sq ft");
    expect(doc.serviceDate).toBe("2026-06-21T15:00:00.000Z");
    expect(doc.thankYou).toContain("Clear Horizon");
  });

  it("falls back to a friendly name when none is given", () => {
    const doc = buildPhotoReport(input({ customerName: null }));
    expect(doc.customerName).toBe("Valued Customer");
  });

  // THE FIREWALL: the report must structurally exclude all internal economics.
  it("never includes any price / margin / labor / cost field or a $ figure", () => {
    const doc = buildPhotoReport(input());
    const json = JSON.stringify(doc).toLowerCase();
    for (const banned of ["margin", "labor", "cost", "price", "quoted", "$", "laborpct"]) {
      expect(json).not.toContain(banned);
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  COMMERCIAL_SCOPE,
  commercialScopes,
  RESIDENTIAL_DEEP_SCOPE,
  RESIDENTIAL_STANDARD_SCOPE,
  residentialScopes,
} from "./scope";

describe("scope checklists", () => {
  it("every checklist has areas and non-empty tasks", () => {
    for (const list of [RESIDENTIAL_STANDARD_SCOPE, RESIDENTIAL_DEEP_SCOPE, COMMERCIAL_SCOPE]) {
      expect(list.sections.length).toBeGreaterThan(0);
      for (const s of list.sections) {
        expect(s.area).toBeTruthy();
        expect(s.tasks.length).toBeGreaterThan(0);
      }
    }
  });

  it("recurring service includes standard + initial deep clean checklists", () => {
    const lists = residentialScopes({ isRecurring: true, primaryIsDeepClean: false, hasInitialDeepClean: true });
    expect(lists.map((l) => l.key)).toEqual(["residential-standard", "residential-deep"]);
  });

  it("one-time deep clean includes only the deep checklist", () => {
    const lists = residentialScopes({ isRecurring: false, primaryIsDeepClean: true, hasInitialDeepClean: false });
    expect(lists.map((l) => l.key)).toEqual(["residential-deep"]);
  });

  it("one-time standard includes only the standard checklist", () => {
    const lists = residentialScopes({ isRecurring: false, primaryIsDeepClean: false, hasInitialDeepClean: false });
    expect(lists.map((l) => l.key)).toEqual(["residential-standard"]);
  });

  it("commercial returns the commercial checklist", () => {
    expect(commercialScopes().map((l) => l.key)).toEqual(["commercial-standard"]);
  });
});

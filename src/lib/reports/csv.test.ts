import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  it("leaves simple values unquoted", () => {
    expect(csvCell("Naples")).toBe("Naples");
    expect(csvCell(500)).toBe("500");
    expect(csvCell(true)).toBe("true");
  });
  it("renders null/undefined as empty", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
  it("quotes and escapes commas, quotes, and newlines", () => {
    expect(csvCell("Doe, Jane")).toBe('"Doe, Jane"');
    expect(csvCell('5" pipe')).toBe('"5"" pipe"');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });
  it("quotes values with edge whitespace", () => {
    expect(csvCell(" leading")).toBe('" leading"');
  });
});

describe("toCsv", () => {
  it("builds a BOM-prefixed, CRLF document", () => {
    const csv = toCsv(["City", "Count"], [["Naples", 3], ["Fort Myers", 2]]);
    expect(csv.startsWith("﻿")).toBe(true);
    const body = csv.slice(1);
    expect(body).toBe("City,Count\r\nNaples,3\r\nFort Myers,2");
  });
  it("can omit the BOM", () => {
    const csv = toCsv(["A"], [["b"]], { bom: false });
    expect(csv.startsWith("﻿")).toBe(false);
    expect(csv).toBe("A\r\nb");
  });
});

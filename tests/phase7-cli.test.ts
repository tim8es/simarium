import { describe, expect, it } from "vitest";
import { parseBatchCliArgs } from "../tools/ecosystem-cli.ts";

describe("Phase 7 batch CLI contract", () => {
  it("parses explicit validation arguments", () => {
    expect(
      parseBatchCliArgs([
        "--days", "180",
        "--seeds", "100:20",
        "--sample", "5",
        "--format", "csv"
      ])
    ).toEqual({
      days: 180,
      seeds: Array.from({ length: 20 }, (_, index) => 100 + index),
      sampleEveryDays: 5,
      format: "csv"
    });
  });

  it("uses bounded smoke defaults", () => {
    const parsed = parseBatchCliArgs([]);
    expect(parsed.days).toBe(30);
    expect(parsed.seeds).toEqual(Array.from({ length: 10 }, (_, index) => index));
    expect(parsed.sampleEveryDays).toBe(5);
    expect(parsed.format).toBe("json");
  });

  it("rejects invalid format and sampling intervals", () => {
    expect(() => parseBatchCliArgs(["--format", "xml"])).toThrow(/format/i);
    expect(() => parseBatchCliArgs(["--sample", "0"])).toThrow(/sample/i);
  });
});

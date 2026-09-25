import { describe, expect, it } from "vitest";
import { executeBatchCli, parseBatchCliArgs } from "../tools/ecosystem-cli.ts";

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

  it("executes a bounded batch and renders JSON or CSV", () => {
    const json = executeBatchCli([
      "--days", "2",
      "--seeds", "7400:2",
      "--sample", "1",
      "--format", "json"
    ]);
    const parsed = JSON.parse(json);
    expect(parsed.runCount).toBe(2);
    expect(parsed.days).toBe(2);
    expect(parsed.invariantFailureRuns).toBe(0);

    const csv = executeBatchCli([
      "--days", "2",
      "--seeds", "7410:2",
      "--sample", "1",
      "--format", "csv"
    ]);
    expect(csv).toContain("metric,species,value");
    expect(csv).toContain("persistence_probability,dalotia,");
  }, 30_000);
});

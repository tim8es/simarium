import { describe, expect, it } from "vitest";
import {
  parseSeedSpec,
  snapshotsToCsv,
  batchSummaryToCsv
} from "../tools/ecosystem-report.ts";
import {
  runEcosystemBatch,
  runIntegratedEcosystem
} from "../tools/ecosystem-analysis.ts";

describe("Phase 7 report/export helpers", () => {
  it("parses deterministic seed ranges and explicit seed lists", () => {
    expect(parseSeedSpec("0:4")).toEqual([0, 1, 2, 3]);
    expect(parseSeedSpec("7,9,11")).toEqual([7, 9, 11]);
    expect(() => parseSeedSpec("3,3")).toThrow(/unique/i);
    expect(() => parseSeedSpec("5:0")).toThrow(/count/i);
  });

  it("exports sampled population/resource telemetry as stable CSV", () => {
    const run = runIntegratedEcosystem({
      seed: 7301,
      days: 4,
      sampleEveryDays: 2
    });
    const csv = snapshotsToCsv(run.samples);

    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain("day");
    expect(lines[0]).toContain("folsomia_living");
    expect(lines[0]).toContain("dalotia_living");
    expect(lines[0]).toContain("total_carbon_mg");
    expect(lines.at(-1)?.startsWith("4,")).toBe(true);
  }, 30_000);

  it("exports aggregate persistence probabilities for batch comparison", () => {
    const batch = runEcosystemBatch({
      seeds: [7310, 7311],
      days: 3,
      sampleEveryDays: 1
    });
    const csv = batchSummaryToCsv(batch);

    expect(csv).toContain("metric,species,value");
    expect(csv).toContain("persistence_probability,fittonia,");
    expect(csv).toContain("persistence_probability,dalotia,");
    expect(csv).toContain("post_start_generation_probability,folsomia,");
  }, 30_000);
});

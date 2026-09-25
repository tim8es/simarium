import { describe, expect, it } from "vitest";
import { runEcosystemBatch } from "../tools/ecosystem-analysis.ts";
import {
  mergeValidationShardDocuments
} from "../tools/ecosystem-validation.ts";

describe("Phase 7 validation shard aggregation", () => {
  it("merges independent shard JSON and evaluates the unchanged acceptance thresholds", () => {
    const a = runEcosystemBatch({
      seeds: [7600, 7601],
      days: 3,
      sampleEveryDays: 1
    });
    const b = runEcosystemBatch({
      seeds: [7602, 7603],
      days: 3,
      sampleEveryDays: 1
    });

    const report = mergeValidationShardDocuments([
      JSON.stringify(a),
      JSON.stringify(b)
    ]);

    expect(report.summary.runCount).toBe(4);
    expect(report.summary.seeds).toEqual([7600, 7601, 7602, 7603]);
    expect(report.acceptance.criteria.allProducersPersistence.target).toBe(0.8);
    expect(report.acceptance.criteria.detritivorePersistence.target).toBe(0.8);
    expect(report.acceptance.criteria.bradysiaPersistence.target).toBe(0.7);
    expect(report.acceptance.criteria.dalotiaPersistence.target).toBe(0.7);
  }, 30_000);

  it("rejects malformed or incompatible shard documents", () => {
    expect(() =>
      mergeValidationShardDocuments(["not-json"])
    ).toThrow(/json/i);

    const a = runEcosystemBatch({
      seeds: [7610],
      days: 2,
      sampleEveryDays: 1
    });
    const incompatible = { ...a, days: 3 };

    expect(() =>
      mergeValidationShardDocuments([
        JSON.stringify(a),
        JSON.stringify(incompatible)
      ])
    ).toThrow(/days/i);
  }, 30_000);
});

import { describe, expect, it } from "vitest";
import {
  collectEcosystemSnapshot,
  runEcosystemBatch,
  runIntegratedEcosystem
} from "../tools/ecosystem-analysis.ts";

describe("Phase 7 ecosystem analysis", () => {
  it("collects reproducible population/resource telemetry from one integrated world", () => {
    const result = runIntegratedEcosystem({
      seed: 7101,
      days: 12,
      sampleEveryDays: 2
    });

    expect(result.seed).toBe(7101);
    expect(result.days).toBe(12);
    expect(result.invariantFailures).toBe(0);
    expect(result.samples.length).toBe(7);

    const final = result.samples.at(-1)!;
    expect(final.day).toBe(12);
    expect(final.animals.folsomia.totalEver).toBeGreaterThan(0);
    expect(final.animals.trichorhina.totalEver).toBeGreaterThan(0);
    expect(final.animals.bradysia.totalEver).toBeGreaterThan(0);
    expect(final.animals.dalotia.totalEver).toBeGreaterThan(0);
    expect(final.plants.fittonia.totalEver).toBeGreaterThan(0);
    expect(final.resources.totalCarbonMg).toBeGreaterThan(0);
    expect(final.resources.totalWaterG).toBeGreaterThan(0);
  }, 30_000);

  it("reports persistence/extinction and post-start generation metrics without changing the ecosystem", () => {
    const run = runIntegratedEcosystem({
      seed: 7111,
      days: 30,
      sampleEveryDays: 1
    });

    expect(run.summary.animals.folsomia.postStartEver).toBeGreaterThan(0);
    expect(run.summary.animals.trichorhina.postStartEver).toBeGreaterThan(0);
    expect(run.summary.animals.bradysia.postStartEver).toBeGreaterThan(0);
    expect(run.summary.animals.dalotia.postStartEver).toBeGreaterThan(0);

    for (const metrics of Object.values(run.summary.animals)) {
      expect(metrics.finalLiving).toBeGreaterThanOrEqual(0);
      expect(metrics.totalEver).toBeGreaterThanOrEqual(metrics.finalLiving);
      expect(metrics.coefficientOfVariation).toBeGreaterThanOrEqual(0);
    }

    const snapshot = collectEcosystemSnapshot(run.ecosystem, 30);
    expect(snapshot.day).toBe(30);
  }, 30_000);

  it("aggregates independent seed runs deterministically", () => {
    const options = {
      seeds: [7200, 7201, 7202],
      days: 15,
      sampleEveryDays: 3
    };

    const a = runEcosystemBatch(options);
    const b = runEcosystemBatch(options);

    expect(a).toEqual(b);
    expect(a.runCount).toBe(3);
    expect(a.invariantFailureRuns).toBe(0);
    expect(a.persistenceProbability.fittonia).toBeGreaterThanOrEqual(0);
    expect(a.persistenceProbability.fittonia).toBeLessThanOrEqual(1);
    expect(a.persistenceProbability.dalotia).toBeGreaterThanOrEqual(0);
    expect(a.persistenceProbability.dalotia).toBeLessThanOrEqual(1);
    expect(a.postStartGenerationProbability.folsomia).toBeGreaterThanOrEqual(0);
    expect(a.postStartGenerationProbability.folsomia).toBeLessThanOrEqual(1);
  }, 60_000);
});

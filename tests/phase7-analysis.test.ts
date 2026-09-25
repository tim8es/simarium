import { describe, expect, it } from "vitest";
import {
  collectEcosystemSnapshot,
  evaluateMvpAcceptance,
  mergeBatchSummaries,
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

  it("keeps per-seed joint outcomes so acceptance criteria are exact", () => {
    const batch = runEcosystemBatch({
      seeds: [7500, 7501, 7502],
      days: 5,
      sampleEveryDays: 1
    });

    expect(batch.runOutcomes).toHaveLength(3);
    expect(batch.runOutcomes.map((run) => run.seed)).toEqual([7500, 7501, 7502]);

    for (const outcome of batch.runOutcomes) {
      expect(typeof outcome.persistence.allProducers).toBe("boolean");
      expect(typeof outcome.persistence.atLeastOneDetritivore).toBe("boolean");
      expect(outcome.invariantFailures).toBeGreaterThanOrEqual(0);
    }

    const allProducerRate =
      batch.runOutcomes.filter((run) => run.persistence.allProducers).length /
      batch.runCount;
    expect(batch.jointPersistenceProbability.allProducers).toBe(allProducerRate);
  }, 30_000);

  it("evaluates the documented MVP thresholds without changing them", () => {
    const batch = runEcosystemBatch({
      seeds: [7510, 7511],
      days: 3,
      sampleEveryDays: 1
    });
    const acceptance = evaluateMvpAcceptance(batch);

    expect(acceptance.criteria.zeroInvariantFailures.target).toBe(0);
    expect(acceptance.criteria.allProducersPersistence.target).toBe(0.8);
    expect(acceptance.criteria.detritivorePersistence.target).toBe(0.8);
    expect(acceptance.criteria.bradysiaPersistence.target).toBe(0.7);
    expect(acceptance.criteria.dalotiaPersistence.target).toBe(0.7);
    expect(typeof acceptance.pass).toBe("boolean");
  }, 30_000);

  it("merges sharded summaries using run-count weighted metrics", () => {
    const a = runEcosystemBatch({
      seeds: [7520, 7521],
      days: 2,
      sampleEveryDays: 1
    });
    const b = runEcosystemBatch({
      seeds: [7522],
      days: 2,
      sampleEveryDays: 1
    });

    const merged = mergeBatchSummaries([a, b]);

    expect(merged.runCount).toBe(3);
    expect(merged.seeds).toEqual([7520, 7521, 7522]);
    expect(merged.runOutcomes).toHaveLength(3);

    const expected =
      (a.persistenceProbability.dalotia * a.runCount +
        b.persistenceProbability.dalotia * b.runCount) /
      3;
    expect(merged.persistenceProbability.dalotia).toBeCloseTo(expected, 12);

    expect(() =>
      mergeBatchSummaries([
        a,
        { ...b, days: 3 }
      ])
    ).toThrow(/days/i);
  }, 30_000);

  it("carries a litter nitrogen tracer into living plant structural tissue in the integrated world", () => {
    const run = runIntegratedEcosystem({
      seed: 7001,
      days: 60,
      sampleEveryDays: 5
    });

    expect(run.summary.litterNitrogenTracer.seededMg).toBeGreaterThan(0);
    expect(run.summary.litterNitrogenTracer.maxPlantStructuralMg).toBeGreaterThan(0);
    expect(run.summary.litterNitrogenTracer.reachedPlantTissue).toBe(true);
  }, 60_000);

  it("exports stage, death-cause and prey-specific predation diagnostics for calibration", () => {
    const batch = runEcosystemBatch({
      seeds: [7001],
      days: 12,
      sampleEveryDays: 1
    });

    const outcome = batch.runOutcomes[0]!;
    expect(outcome.deathCauses.folsomia).toBeDefined();
    expect(outcome.deathCauses.bradysia).toBeDefined();
    expect(outcome.predation.total).toBe(
      outcome.predation.bradysia + outcome.predation.folsomia
    );
    expect(outcome.finalStages.bradysia).toBeDefined();
    expect(outcome.finalStages.dalotia).toBeDefined();
  }, 30_000);


});

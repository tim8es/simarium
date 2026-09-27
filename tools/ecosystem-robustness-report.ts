import { readFileSync } from "node:fs";
import type {
  BatchSummary,
  PopulationStabilityOutcome
} from "./ecosystem-analysis.js";
import { mergeBatchShardDocuments } from "./ecosystem-validation.js";

const species = [
  "fittonia",
  "peperomia",
  "pilea",
  "folsomia",
  "trichorhina",
  "bradysia",
  "dalotia"
] as const;

type SpeciesKey = typeof species[number];

function topExtremeSeeds(
  summary: BatchSummary,
  key: SpeciesKey,
  limit = 5
) {
  return summary.runOutcomes
    .map((outcome) => {
      const stability = outcome.stability[key] as PopulationStabilityOutcome;
      return {
        seed: outcome.seed,
        peakLiving: stability.peakLiving,
        finalLiving: outcome.finalLiving[key],
        meanLiving: stability.meanLiving,
        coefficientOfVariation: stability.coefficientOfVariation,
        peakToTroughRatio: stability.peakToTroughRatio,
        extinctionDay: stability.extinctionDay
      };
    })
    .sort((a, b) =>
      b.peakLiving - a.peakLiving ||
      b.coefficientOfVariation - a.coefficientOfVariation ||
      a.seed - b.seed
    )
    .slice(0, limit);
}

function extinctionSeeds(summary: BatchSummary, key: SpeciesKey) {
  return summary.runOutcomes
    .flatMap((outcome) => {
      const extinctionDay = outcome.stability[key].extinctionDay;
      return extinctionDay === null
        ? []
        : [{ seed: outcome.seed, extinctionDay }];
    })
    .sort((a, b) => a.extinctionDay - b.extinctionDay || a.seed - b.seed);
}

function speciesReport(summary: BatchSummary, key: SpeciesKey) {
  return {
    persistenceProbability: summary.persistenceProbability[key],
    extinctionFrequency: 1 - summary.persistenceProbability[key],
    meanExtinctionDay: summary.meanExtinctionDay[key],
    meanFinalLiving: summary.meanFinalLiving[key],
    meanLiving: summary.meanLiving[key],
    meanCoefficientOfVariation: summary.meanCoefficientOfVariation[key],
    meanPeakToTroughRatio: summary.meanPeakToTroughRatio[key],
    meanGenerationTurnover: summary.meanGenerationTurnover[key],
    extinctionSeeds: extinctionSeeds(summary, key),
    largestPeakReviewSeeds: topExtremeSeeds(summary, key)
  };
}

const paths = process.argv.slice(2);

try {
  if (paths.length === 0) {
    throw new Error("Provide one or more robustness shard JSON files");
  }

  const summary = mergeBatchShardDocuments(
    paths.map((path) => readFileSync(path, "utf8"))
  );

  const report = {
    purpose:
      "Non-gating 365-day robustness evidence. This report does not alter or replace the normative 180-day MVP acceptance thresholds.",
    days: summary.days,
    runCount: summary.runCount,
    seeds: summary.seeds,
    invariantFailureRuns: summary.invariantFailureRuns,
    invariantFailureSeeds: summary.runOutcomes
      .filter((outcome) => outcome.invariantFailures > 0)
      .map((outcome) => ({
        seed: outcome.seed,
        failureDay: outcome.invariantFailureDay ?? null,
        error: outcome.invariantError ?? null
      })),
    litterNitrogenTracerReturnProbability:
      summary.runCount > 0
        ? summary.litterNitrogenTracerReturnedRuns / summary.runCount
        : 0,
    jointPersistenceProbability: summary.jointPersistenceProbability,
    species: Object.fromEntries(
      species.map((key) => [key, speciesReport(summary, key)])
    ),
    meanResourceDrift: summary.meanResourceDrift,
    resourceDriftBySeed: summary.runOutcomes.map((outcome) => ({
      seed: outcome.seed,
      drift: outcome.resourceDrift
    }))
  };

  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`simarium robustness report failed: ${message}\n`);
  process.exitCode = 1;
}

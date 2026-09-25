import type {
  BatchSummary,
  EcosystemSnapshot
} from "./ecosystem-analysis.js";

export function parseSeedSpec(spec: string): number[] {
  const trimmed = spec.trim();
  if (trimmed === "") throw new Error("Seed specification cannot be empty");

  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    if (parts.length !== 2) {
      throw new Error("Seed range must use start:count");
    }
    const start = Number(parts[0]);
    const count = Number(parts[1]);
    if (!Number.isInteger(start)) {
      throw new Error("Seed range start must be an integer");
    }
    if (!Number.isInteger(count) || count <= 0) {
      throw new Error("Seed range count must be a positive integer");
    }
    return Array.from({ length: count }, (_, index) => start + index);
  }

  const seeds = trimmed.split(",").map((part) => Number(part.trim()));
  if (seeds.some((seed) => !Number.isInteger(seed))) {
    throw new Error("Every seed must be an integer");
  }
  if (new Set(seeds).size !== seeds.length) {
    throw new Error("Seed list values must be unique");
  }
  return seeds;
}

const SAMPLE_COLUMNS = [
  "day",
  "fittonia_living",
  "peperomia_living",
  "pilea_living",
  "folsomia_living",
  "trichorhina_living",
  "bradysia_living",
  "dalotia_living",
  "folsomia_total_ever",
  "trichorhina_total_ever",
  "bradysia_total_ever",
  "dalotia_total_ever",
  "predation_events",
  "litter_carbon_mg",
  "fine_detritus_carbon_mg",
  "corpse_carbon_mg",
  "available_nitrogen_mg",
  "available_phosphorus_mg",
  "fungal_carbon_mg",
  "bacterial_carbon_mg",
  "total_carbon_mg",
  "total_nitrogen_mg",
  "total_phosphorus_mg",
  "total_water_g"
] as const;

function sampleRow(sample: EcosystemSnapshot): Array<number> {
  return [
    sample.day,
    sample.plants.fittonia.living,
    sample.plants.peperomia.living,
    sample.plants.pilea.living,
    sample.animals.folsomia.living,
    sample.animals.trichorhina.living,
    sample.animals.bradysia.living,
    sample.animals.dalotia.living,
    sample.animals.folsomia.totalEver,
    sample.animals.trichorhina.totalEver,
    sample.animals.bradysia.totalEver,
    sample.animals.dalotia.totalEver,
    sample.events.predation,
    sample.resources.litterCarbonMg,
    sample.resources.fineDetritusCarbonMg,
    sample.resources.corpseCarbonMg,
    sample.resources.availableNitrogenMg,
    sample.resources.availablePhosphorusMg,
    sample.resources.fungalCarbonMg,
    sample.resources.bacterialCarbonMg,
    sample.resources.totalCarbonMg,
    sample.resources.totalNitrogenMg,
    sample.resources.totalPhosphorusMg,
    sample.resources.totalWaterG
  ];
}

export function snapshotsToCsv(samples: EcosystemSnapshot[]): string {
  const rows = [
    SAMPLE_COLUMNS.join(","),
    ...samples.map((sample) => sampleRow(sample).join(","))
  ];
  return rows.join("\n") + "\n";
}

export function batchSummaryToCsv(summary: BatchSummary): string {
  const rows: string[] = ["metric,species,value"];

  for (const [species, value] of Object.entries(summary.persistenceProbability)) {
    rows.push(`persistence_probability,${species},${value}`);
  }
  for (const [species, value] of Object.entries(
    summary.postStartGenerationProbability
  )) {
    rows.push(`post_start_generation_probability,${species},${value}`);
  }
  for (const [species, value] of Object.entries(summary.meanFinalLiving)) {
    rows.push(`mean_final_living,${species},${value}`);
  }

  rows.push(`invariant_failure_runs,all,${summary.invariantFailureRuns}`);
  rows.push(`run_count,all,${summary.runCount}`);
  rows.push(`days,all,${summary.days}`);

  return rows.join("\n") + "\n";
}

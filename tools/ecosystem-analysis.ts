import {
  type PlantRametPopulation
} from "../packages/sim-core/src/index.js";
import {
  createIntegratedEcosystem,
  type IntegratedEcosystem
} from "./ecosystem-factory.js";

export interface PopulationSnapshot {
  living: number;
  totalEver: number;
  postStartEver: number;
  deaths: number;
}

export interface PlantSnapshot extends PopulationSnapshot {
  clones: number;
}

export interface ResourceSnapshot {
  totalCarbonMg: number;
  totalNitrogenMg: number;
  totalPhosphorusMg: number;
  totalWaterG: number;
  litterCarbonMg: number;
  fineDetritusCarbonMg: number;
  corpseCarbonMg: number;
  availableNitrogenMg: number;
  availablePhosphorusMg: number;
  fungalCarbonMg: number;
  bacterialCarbonMg: number;
}

export interface EcosystemSnapshot {
  day: number;
  plants: {
    fittonia: PlantSnapshot;
    peperomia: PlantSnapshot;
    pilea: PlantSnapshot;
  };
  animals: {
    folsomia: PopulationSnapshot;
    trichorhina: PopulationSnapshot;
    bradysia: PopulationSnapshot;
    dalotia: PopulationSnapshot;
  };
  events: {
    predation: number;
  };
  resources: ResourceSnapshot;
}

export interface PopulationRunMetrics extends PopulationSnapshot {
  finalLiving: number;
  coefficientOfVariation: number;
  peakToTroughRatio: number | null;
  extinctionDay: number | null;
}

export interface PlantRunMetrics extends PopulationRunMetrics {
  clones: number;
}

export interface EcosystemRunSummary {
  plants: {
    fittonia: PlantRunMetrics;
    peperomia: PlantRunMetrics;
    pilea: PlantRunMetrics;
  };
  animals: {
    folsomia: PopulationRunMetrics;
    trichorhina: PopulationRunMetrics;
    bradysia: PopulationRunMetrics;
    dalotia: PopulationRunMetrics;
  };
  predationEvents: number;
  finalResources: ResourceSnapshot;
}

export interface IntegratedRunOptions {
  seed: number;
  days: number;
  sampleEveryDays?: number;
}

export interface IntegratedRunResult {
  seed: number;
  days: number;
  invariantFailures: number;
  samples: EcosystemSnapshot[];
  summary: EcosystemRunSummary;
  ecosystem: IntegratedEcosystem;
}

export interface BatchOptions {
  seeds: number[];
  days: number;
  sampleEveryDays?: number;
}

export interface BatchSummary {
  days: number;
  seeds: number[];
  runCount: number;
  invariantFailureRuns: number;
  persistenceProbability: {
    fittonia: number;
    peperomia: number;
    pilea: number;
    folsomia: number;
    trichorhina: number;
    bradysia: number;
    dalotia: number;
  };
  postStartGenerationProbability: {
    folsomia: number;
    trichorhina: number;
    bradysia: number;
    dalotia: number;
  };
  meanFinalLiving: {
    fittonia: number;
    peperomia: number;
    pilea: number;
    folsomia: number;
    trichorhina: number;
    bradysia: number;
    dalotia: number;
  };
}

type AnimalCollection = {
  all(): readonly {
    alive: boolean;
    birthTimeSeconds: number;
    parentId?: number;
  }[];
};

function populationSnapshot(population: AnimalCollection): PopulationSnapshot {
  const all = population.all();
  return {
    living: all.filter((entity) => entity.alive).length,
    totalEver: all.length,
    postStartEver: all.filter(
      (entity) => entity.birthTimeSeconds >= 0 && entity.parentId !== undefined
    ).length,
    deaths: all.filter((entity) => !entity.alive).length
  };
}

function plantSnapshot(population: PlantRametPopulation): PlantSnapshot {
  const all = population.all();
  return {
    living: all.filter((ramet) => ramet.alive).length,
    totalEver: all.length,
    postStartEver: all.filter(
      (ramet) => ramet.birthTimeSeconds >= 0 && ramet.parentId !== undefined
    ).length,
    deaths: all.filter((ramet) => !ramet.alive).length,
    clones: population.eventLog().filter((event) => event.type === "clone").length
  };
}

function poolCarbon(eco: IntegratedEcosystem, poolName: string): number {
  return eco.world.ledger.hasPool(poolName)
    ? eco.world.ledger.getPool(poolName).carbonMg
    : 0;
}

export function collectEcosystemSnapshot(
  eco: IntegratedEcosystem,
  day: number
): EcosystemSnapshot {
  const totals = eco.world.ledger.totals();
  const nutrientPool = eco.world.ledger.getPool("available_nutrients");

  return {
    day,
    plants: {
      fittonia: plantSnapshot(eco.plants.fittonia),
      peperomia: plantSnapshot(eco.plants.peperomia),
      pilea: plantSnapshot(eco.plants.pilea)
    },
    animals: {
      folsomia: populationSnapshot(eco.animals.folsomia),
      trichorhina: populationSnapshot(eco.animals.trichorhina),
      bradysia: populationSnapshot(eco.animals.bradysia),
      dalotia: populationSnapshot(eco.animals.dalotia)
    },
    events: {
      predation: eco.animals.dalotia
        .eventLog()
        .filter((event) => event.type === "predation").length
    },
    resources: {
      totalCarbonMg: totals.carbonMg,
      totalNitrogenMg: totals.nitrogenMg,
      totalPhosphorusMg: totals.phosphorusMg,
      totalWaterG: totals.waterG,
      litterCarbonMg: poolCarbon(eco, "litter"),
      fineDetritusCarbonMg: poolCarbon(eco, "fine_detritus"),
      corpseCarbonMg: poolCarbon(eco, "animal_corpses"),
      availableNitrogenMg: nutrientPool.nitrogenMg,
      availablePhosphorusMg: nutrientPool.phosphorusMg,
      fungalCarbonMg: poolCarbon(eco, "linnemannia_biomass"),
      bacterialCarbonMg: poolCarbon(eco, "bacillus_biomass")
    }
  };
}

function coefficientOfVariation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean === 0) return 0;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    values.length;
  return Math.sqrt(variance) / mean;
}

function peakToTrough(values: number[]): number | null {
  if (values.length === 0) return null;
  const max = Math.max(...values);
  const positive = values.filter((value) => value > 0);
  if (positive.length === 0) return null;
  const min = Math.min(...positive);
  return min > 0 ? max / min : null;
}

function extinctionDay(
  samples: EcosystemSnapshot[],
  selector: (sample: EcosystemSnapshot) => number
): number | null {
  const firstZero = samples.find((sample) => selector(sample) === 0);
  return firstZero?.day ?? null;
}

function animalMetrics(
  final: PopulationSnapshot,
  samples: EcosystemSnapshot[],
  selector: (sample: EcosystemSnapshot) => number
): PopulationRunMetrics {
  const livingSeries = samples.map(selector);
  return {
    ...final,
    finalLiving: final.living,
    coefficientOfVariation: coefficientOfVariation(livingSeries),
    peakToTroughRatio: peakToTrough(livingSeries),
    extinctionDay: extinctionDay(samples, selector)
  };
}

function plantMetrics(
  final: PlantSnapshot,
  samples: EcosystemSnapshot[],
  selector: (sample: EcosystemSnapshot) => number
): PlantRunMetrics {
  return {
    ...animalMetrics(final, samples, selector),
    clones: final.clones
  };
}

function buildRunSummary(samples: EcosystemSnapshot[]): EcosystemRunSummary {
  const final = samples.at(-1);
  if (!final) throw new Error("Cannot summarize a run without samples");

  return {
    plants: {
      fittonia: plantMetrics(
        final.plants.fittonia,
        samples,
        (sample) => sample.plants.fittonia.living
      ),
      peperomia: plantMetrics(
        final.plants.peperomia,
        samples,
        (sample) => sample.plants.peperomia.living
      ),
      pilea: plantMetrics(
        final.plants.pilea,
        samples,
        (sample) => sample.plants.pilea.living
      )
    },
    animals: {
      folsomia: animalMetrics(
        final.animals.folsomia,
        samples,
        (sample) => sample.animals.folsomia.living
      ),
      trichorhina: animalMetrics(
        final.animals.trichorhina,
        samples,
        (sample) => sample.animals.trichorhina.living
      ),
      bradysia: animalMetrics(
        final.animals.bradysia,
        samples,
        (sample) => sample.animals.bradysia.living
      ),
      dalotia: animalMetrics(
        final.animals.dalotia,
        samples,
        (sample) => sample.animals.dalotia.living
      )
    },
    predationEvents: final.events.predation,
    finalResources: final.resources
  };
}

export function runIntegratedEcosystem(
  options: IntegratedRunOptions
): IntegratedRunResult {
  if (!Number.isInteger(options.days) || options.days <= 0) {
    throw new Error("days must be a positive integer");
  }

  const sampleEveryDays = options.sampleEveryDays ?? 1;
  if (!Number.isInteger(sampleEveryDays) || sampleEveryDays <= 0) {
    throw new Error("sampleEveryDays must be a positive integer");
  }

  const eco = createIntegratedEcosystem(options.seed);
  const stepsPerDay = 86400 / eco.world.config.fixedDtSeconds;
  if (!Number.isInteger(stepsPerDay)) {
    throw new Error("Integrated fixed timestep must divide one day exactly");
  }

  const samples: EcosystemSnapshot[] = [
    collectEcosystemSnapshot(eco, 0)
  ];
  let invariantFailures = 0;

  for (let day = 1; day <= options.days; day++) {
    eco.scheduler.step(stepsPerDay);
    try {
      eco.invariants.check(eco.world);
    } catch {
      invariantFailures++;
      break;
    }

    if (day % sampleEveryDays === 0 || day === options.days) {
      samples.push(collectEcosystemSnapshot(eco, day));
    }
  }

  return {
    seed: options.seed,
    days: options.days,
    invariantFailures,
    samples,
    summary: buildRunSummary(samples),
    ecosystem: eco
  };
}

function probability(
  runs: IntegratedRunResult[],
  predicate: (run: IntegratedRunResult) => boolean
): number {
  if (runs.length === 0) return 0;
  return runs.filter(predicate).length / runs.length;
}

function mean(
  runs: IntegratedRunResult[],
  selector: (run: IntegratedRunResult) => number
): number {
  if (runs.length === 0) return 0;
  return runs.reduce((sum, run) => sum + selector(run), 0) / runs.length;
}

export function runEcosystemBatch(options: BatchOptions): BatchSummary {
  if (options.seeds.length === 0) {
    throw new Error("Batch requires at least one seed");
  }
  if (new Set(options.seeds).size !== options.seeds.length) {
    throw new Error("Batch seeds must be unique");
  }

  const runs = options.seeds.map((seed) =>
    runIntegratedEcosystem({
      seed,
      days: options.days,
      sampleEveryDays: options.sampleEveryDays
    })
  );

  const result: BatchSummary = {
    days: options.days,
    seeds: [...options.seeds],
    runCount: runs.length,
    invariantFailureRuns: runs.filter((run) => run.invariantFailures > 0).length,
    persistenceProbability: {
      fittonia: probability(runs, (run) => run.summary.plants.fittonia.finalLiving > 0),
      peperomia: probability(runs, (run) => run.summary.plants.peperomia.finalLiving > 0),
      pilea: probability(runs, (run) => run.summary.plants.pilea.finalLiving > 0),
      folsomia: probability(runs, (run) => run.summary.animals.folsomia.finalLiving > 0),
      trichorhina: probability(runs, (run) => run.summary.animals.trichorhina.finalLiving > 0),
      bradysia: probability(runs, (run) => run.summary.animals.bradysia.finalLiving > 0),
      dalotia: probability(runs, (run) => run.summary.animals.dalotia.finalLiving > 0)
    },
    postStartGenerationProbability: {
      folsomia: probability(runs, (run) => run.summary.animals.folsomia.postStartEver > 0),
      trichorhina: probability(runs, (run) => run.summary.animals.trichorhina.postStartEver > 0),
      bradysia: probability(runs, (run) => run.summary.animals.bradysia.postStartEver > 0),
      dalotia: probability(runs, (run) => run.summary.animals.dalotia.postStartEver > 0)
    },
    meanFinalLiving: {
      fittonia: mean(runs, (run) => run.summary.plants.fittonia.finalLiving),
      peperomia: mean(runs, (run) => run.summary.plants.peperomia.finalLiving),
      pilea: mean(runs, (run) => run.summary.plants.pilea.finalLiving),
      folsomia: mean(runs, (run) => run.summary.animals.folsomia.finalLiving),
      trichorhina: mean(runs, (run) => run.summary.animals.trichorhina.finalLiving),
      bradysia: mean(runs, (run) => run.summary.animals.bradysia.finalLiving),
      dalotia: mean(runs, (run) => run.summary.animals.dalotia.finalLiving)
    }
  };

  return result;
}

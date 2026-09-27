import {
  MassTracer,
  zeroMaterial,
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
  meanLiving: number;
  peakLiving: number;
  troughLiving: number;
  coefficientOfVariation: number;
  peakToTroughRatio: number | null;
  extinctionDay: number | null;
  generationTurnover: number;
}

export interface PopulationStabilityOutcome {
  meanLiving: number;
  peakLiving: number;
  troughLiving: number;
  coefficientOfVariation: number;
  peakToTroughRatio: number | null;
  extinctionDay: number | null;
  generationTurnover: number;
}

export interface PlantRunMetrics extends PopulationRunMetrics {
  clones: number;
}

export interface LitterNitrogenTracerMetrics {
  seededMg: number;
  maxPlantStructuralMg: number;
  reachedPlantTissue: boolean;
}

export interface EcosystemRunSummary {
  litterNitrogenTracer: LitterNitrogenTracerMetrics;
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
  invariantFailureDay?: number;
  invariantError?: string;
  samples: EcosystemSnapshot[];
  summary: EcosystemRunSummary;
  ecosystem: IntegratedEcosystem;
}

export interface BatchOptions {
  seeds: number[];
  days: number;
  sampleEveryDays?: number;
}

export interface RunOutcome {
  seed: number;
  invariantFailures: number;
  invariantFailureDay?: number;
  invariantError?: string;
  finalResources: ResourceSnapshot;
  persistence: {
    fittonia: boolean;
    peperomia: boolean;
    pilea: boolean;
    folsomia: boolean;
    trichorhina: boolean;
    bradysia: boolean;
    dalotia: boolean;
    allProducers: boolean;
    atLeastOneDetritivore: boolean;
  };
  postStartGeneration: {
    folsomia: boolean;
    trichorhina: boolean;
    bradysia: boolean;
    dalotia: boolean;
  };
  finalLiving: {
    fittonia: number;
    peperomia: number;
    pilea: number;
    folsomia: number;
    trichorhina: number;
    bradysia: number;
    dalotia: number;
  };
  stability: {
    fittonia: PopulationStabilityOutcome;
    peperomia: PopulationStabilityOutcome;
    pilea: PopulationStabilityOutcome;
    folsomia: PopulationStabilityOutcome;
    trichorhina: PopulationStabilityOutcome;
    bradysia: PopulationStabilityOutcome;
    dalotia: PopulationStabilityOutcome;
  };
  resourceDrift: ResourceSnapshot;
  litterNitrogenTracerReturned: boolean;
  deathCauses: {
    folsomia: Record<string, number>;
    trichorhina: Record<string, number>;
    bradysia: Record<string, number>;
    dalotia: Record<string, number>;
  };
  predation: {
    total: number;
    bradysia: number;
    folsomia: number;
  };
  finalStages: {
    folsomia: Record<string, number>;
    trichorhina: Record<string, number>;
    bradysia: Record<string, number>;
    dalotia: Record<string, number>;
  };
}

export interface BatchSummary {
  days: number;
  seeds: number[];
  runCount: number;
  runOutcomes: RunOutcome[];
  invariantFailureRuns: number;
  litterNitrogenTracerReturnedRuns: number;
  persistenceProbability: {
    fittonia: number;
    peperomia: number;
    pilea: number;
    folsomia: number;
    trichorhina: number;
    bradysia: number;
    dalotia: number;
  };
  jointPersistenceProbability: {
    allProducers: number;
    atLeastOneDetritivore: number;
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
  meanLiving: {
    fittonia: number;
    peperomia: number;
    pilea: number;
    folsomia: number;
    trichorhina: number;
    bradysia: number;
    dalotia: number;
  };
  meanCoefficientOfVariation: {
    fittonia: number;
    peperomia: number;
    pilea: number;
    folsomia: number;
    trichorhina: number;
    bradysia: number;
    dalotia: number;
  };
  meanPeakToTroughRatio: {
    fittonia: number | null;
    peperomia: number | null;
    pilea: number | null;
    folsomia: number | null;
    trichorhina: number | null;
    bradysia: number | null;
    dalotia: number | null;
  };
  meanGenerationTurnover: {
    fittonia: number;
    peperomia: number;
    pilea: number;
    folsomia: number;
    trichorhina: number;
    bradysia: number;
    dalotia: number;
  };
  meanExtinctionDay: {
    fittonia: number | null;
    peperomia: number | null;
    pilea: number | null;
    folsomia: number | null;
    trichorhina: number | null;
    bradysia: number | null;
    dalotia: number | null;
  };
  meanResourceDrift: ResourceSnapshot;
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

type ValidatedAnimalState = {
  id: number;
  alive: boolean;
  ageSeconds: number;
  stageAgeSeconds: number;
  birthTimeSeconds: number;
  material: {
    carbonMg: number;
    nitrogenMg: number;
    phosphorusMg: number;
    waterG: number;
  };
  reserveCarbonMg: number;
  starvationSeconds: number;
  dehydrationSeconds: number;
  adultAgeSeconds?: number;
  parentId?: number;
};

function assertFiniteNumber(
  value: number,
  path: string,
  options: { nonNegative?: boolean } = {}
): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Non-finite organism state at ${path}: ${value}`);
  }
  if (options.nonNegative && value < -1e-12) {
    throw new Error(`Negative organism state at ${path}: ${value}`);
  }
}

function assertUniqueIds(
  label: string,
  entities: readonly { id: number }[]
): void {
  const ids = new Set<number>();
  for (const entity of entities) {
    if (!Number.isInteger(entity.id) || entity.id <= 0) {
      throw new Error(`Invalid ${label} entity id: ${entity.id}`);
    }
    if (ids.has(entity.id)) {
      throw new Error(`Duplicate ${label} entity id: ${entity.id}`);
    }
    ids.add(entity.id);
  }
}

function assertAnimalStates(
  label: string,
  individuals: readonly ValidatedAnimalState[]
): void {
  assertUniqueIds(label, individuals);
  for (const individual of individuals) {
    assertFiniteNumber(individual.ageSeconds, `${label}#${individual.id}.ageSeconds`, { nonNegative: true });
    assertFiniteNumber(individual.stageAgeSeconds, `${label}#${individual.id}.stageAgeSeconds`, { nonNegative: true });
    assertFiniteNumber(individual.birthTimeSeconds, `${label}#${individual.id}.birthTimeSeconds`);
    assertFiniteNumber(individual.reserveCarbonMg, `${label}#${individual.id}.reserveCarbonMg`, { nonNegative: true });
    assertFiniteNumber(individual.starvationSeconds, `${label}#${individual.id}.starvationSeconds`, { nonNegative: true });
    assertFiniteNumber(individual.dehydrationSeconds, `${label}#${individual.id}.dehydrationSeconds`, { nonNegative: true });
    if (individual.adultAgeSeconds !== undefined) {
      assertFiniteNumber(individual.adultAgeSeconds, `${label}#${individual.id}.adultAgeSeconds`, { nonNegative: true });
    }
    if (
      individual.parentId !== undefined &&
      (!Number.isInteger(individual.parentId) || individual.parentId <= 0)
    ) {
      throw new Error(`Invalid ${label}#${individual.id}.parentId: ${individual.parentId}`);
    }
    for (const [key, value] of Object.entries(individual.material)) {
      assertFiniteNumber(value, `${label}#${individual.id}.material.${key}`, { nonNegative: true });
    }
  }
}

export function assertIntegratedStateValid(eco: IntegratedEcosystem): void {
  assertAnimalStates("folsomia", eco.animals.folsomia.all());
  assertAnimalStates("trichorhina", eco.animals.trichorhina.all());
  assertAnimalStates("bradysia", eco.animals.bradysia.all());
  assertAnimalStates("dalotia", eco.animals.dalotia.all());

  for (const [label, population] of [
    ["fittonia", eco.plants.fittonia],
    ["peperomia", eco.plants.peperomia],
    ["pilea", eco.plants.pilea]
  ] as const) {
    const ramets = population.all();
    assertUniqueIds(label, ramets);
    for (const ramet of ramets) {
      assertFiniteNumber(ramet.birthTimeSeconds, `${label}#${ramet.id}.birthTimeSeconds`);
      assertFiniteNumber(ramet.ageSeconds, `${label}#${ramet.id}.ageSeconds`, { nonNegative: true });
      assertFiniteNumber(ramet.share, `${label}#${ramet.id}.share`, { nonNegative: true });
      if (
        ramet.parentId !== undefined &&
        (!Number.isInteger(ramet.parentId) || ramet.parentId <= 0)
      ) {
        throw new Error(`Invalid ${label}#${ramet.id}.parentId: ${ramet.parentId}`);
      }
      if (!Number.isInteger(ramet.offspringCount) || ramet.offspringCount < 0) {
        throw new Error(
          `Invalid ${label}#${ramet.id}.offspringCount: ${ramet.offspringCount}`
        );
      }
    }
    population.assertShares();
  }
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
  const positive = livingSeries.filter((value) => value > 0);
  const meanLiving =
    livingSeries.reduce((sum, value) => sum + value, 0) /
    Math.max(1, livingSeries.length);
  return {
    ...final,
    finalLiving: final.living,
    meanLiving,
    peakLiving: livingSeries.length > 0 ? Math.max(...livingSeries) : 0,
    troughLiving: positive.length > 0 ? Math.min(...positive) : 0,
    coefficientOfVariation: coefficientOfVariation(livingSeries),
    peakToTroughRatio: peakToTrough(livingSeries),
    extinctionDay: extinctionDay(samples, selector),
    generationTurnover:
      final.totalEver > 0 ? final.postStartEver / final.totalEver : 0
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

function buildRunSummary(
  samples: EcosystemSnapshot[],
  litterNitrogenTracer: LitterNitrogenTracerMetrics
): EcosystemRunSummary {
  const final = samples.at(-1);
  if (!final) throw new Error("Cannot summarize a run without samples");

  return {
    litterNitrogenTracer,
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
  assertIntegratedStateValid(eco);
  eco.invariants.check(eco.world);

  const tracer = new MassTracer();
  tracer.attach(eco.world.ledger);
  const tracerId = "integrated_litter_nitrogen";
  const litterNitrogenMg = eco.world.ledger.getPool("litter").nitrogenMg;
  const seededNitrogenMg = Math.min(1, litterNitrogenMg);
  tracer.seed(
    tracerId,
    "litter",
    { ...zeroMaterial(), nitrogenMg: seededNitrogenMg },
    eco.world.ledger
  );

  const plantStructuralTracerMg = (): number =>
    ["fittonia_structural", "peperomia_structural", "pilea_structural"]
      .map((poolName) => tracer.get(tracerId, poolName).nitrogenMg)
      .reduce((sum, value) => sum + value, 0);

  let maxPlantStructuralTracerMg = plantStructuralTracerMg();

  const stepsPerDay = 86400 / eco.world.config.fixedDtSeconds;
  if (!Number.isInteger(stepsPerDay)) {
    throw new Error("Integrated fixed timestep must divide one day exactly");
  }

  const samples: EcosystemSnapshot[] = [
    collectEcosystemSnapshot(eco, 0)
  ];
  let invariantFailures = 0;
  let invariantFailureDay: number | undefined;
  let invariantError: string | undefined;

  for (let day = 1; day <= options.days; day++) {
    try {
      eco.scheduler.step(stepsPerDay);
      assertIntegratedStateValid(eco);
      eco.invariants.check(eco.world);
    } catch (error) {
      invariantFailures++;
      invariantFailureDay = day;
      invariantError = error instanceof Error ? error.message : String(error);

      // Keep diagnostics anchored to the actual failure state, including
      // failures raised by per-system aggregate checks inside scheduler.step.
      maxPlantStructuralTracerMg = Math.max(
        maxPlantStructuralTracerMg,
        plantStructuralTracerMg()
      );
      samples.push(collectEcosystemSnapshot(eco, day));
      break;
    }

    maxPlantStructuralTracerMg = Math.max(
      maxPlantStructuralTracerMg,
      plantStructuralTracerMg()
    );

    if (day % sampleEveryDays === 0 || day === options.days) {
      samples.push(collectEcosystemSnapshot(eco, day));
    }
  }

  return {
    seed: options.seed,
    days: options.days,
    invariantFailures,
    ...(invariantFailureDay !== undefined ? { invariantFailureDay } : {}),
    ...(invariantError !== undefined ? { invariantError } : {}),
    samples,
    summary: buildRunSummary(samples, {
      seededMg: seededNitrogenMg,
      maxPlantStructuralMg: maxPlantStructuralTracerMg,
      reachedPlantTissue: maxPlantStructuralTracerMg > 0
    }),
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

function countStrings(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function livingStageCounts(
  individuals: readonly { alive: boolean; stage: string }[]
): Record<string, number> {
  return countStrings(
    individuals.filter((individual) => individual.alive).map((individual) => individual.stage)
  );
}

function deathEventCauses(
  events: readonly { type: string }[]
): Record<string, number> {
  const causes: string[] = [];
  for (const event of events) {
    if (event.type !== "death") continue;
    const cause = (event as { cause?: unknown }).cause;
    if (typeof cause === "string") causes.push(cause);
  }
  return countStrings(causes);
}

function resourceDelta(
  initial: ResourceSnapshot,
  final: ResourceSnapshot
): ResourceSnapshot {
  return {
    totalCarbonMg: final.totalCarbonMg - initial.totalCarbonMg,
    totalNitrogenMg: final.totalNitrogenMg - initial.totalNitrogenMg,
    totalPhosphorusMg: final.totalPhosphorusMg - initial.totalPhosphorusMg,
    totalWaterG: final.totalWaterG - initial.totalWaterG,
    litterCarbonMg: final.litterCarbonMg - initial.litterCarbonMg,
    fineDetritusCarbonMg:
      final.fineDetritusCarbonMg - initial.fineDetritusCarbonMg,
    corpseCarbonMg: final.corpseCarbonMg - initial.corpseCarbonMg,
    availableNitrogenMg:
      final.availableNitrogenMg - initial.availableNitrogenMg,
    availablePhosphorusMg:
      final.availablePhosphorusMg - initial.availablePhosphorusMg,
    fungalCarbonMg: final.fungalCarbonMg - initial.fungalCarbonMg,
    bacterialCarbonMg: final.bacterialCarbonMg - initial.bacterialCarbonMg
  };
}

function stabilityOutcome(
  metrics: PopulationRunMetrics
): PopulationStabilityOutcome {
  return {
    meanLiving: metrics.meanLiving,
    peakLiving: metrics.peakLiving,
    troughLiving: metrics.troughLiving,
    coefficientOfVariation: metrics.coefficientOfVariation,
    peakToTroughRatio: metrics.peakToTroughRatio,
    extinctionDay: metrics.extinctionDay,
    generationTurnover: metrics.generationTurnover
  };
}

function runOutcome(run: IntegratedRunResult): RunOutcome {
  const persistence = {
    fittonia: run.summary.plants.fittonia.finalLiving > 0,
    peperomia: run.summary.plants.peperomia.finalLiving > 0,
    pilea: run.summary.plants.pilea.finalLiving > 0,
    folsomia: run.summary.animals.folsomia.finalLiving > 0,
    trichorhina: run.summary.animals.trichorhina.finalLiving > 0,
    bradysia: run.summary.animals.bradysia.finalLiving > 0,
    dalotia: run.summary.animals.dalotia.finalLiving > 0,
    allProducers:
      run.summary.plants.fittonia.finalLiving > 0 &&
      run.summary.plants.peperomia.finalLiving > 0 &&
      run.summary.plants.pilea.finalLiving > 0,
    atLeastOneDetritivore:
      run.summary.animals.folsomia.finalLiving > 0 ||
      run.summary.animals.trichorhina.finalLiving > 0
  };

  const predationEvents = run.ecosystem.animals.dalotia
    .eventLog()
    .filter((event) => event.type === "predation");
  const bradysiaPredation = predationEvents.filter(
    (event) => event.preySpecies === "bradysia_impatiens"
  ).length;
  const folsomiaPredation = predationEvents.filter(
    (event) => event.preySpecies === "folsomia_candida"
  ).length;

  const trichorhinaDeathCauses = countStrings(
    run.ecosystem.animals.trichorhina
      .all()
      .filter((individual) => !individual.alive)
      .flatMap((individual) => {
        const cause =
          run.ecosystem.animals.trichorhina.record(individual.id).deathCause;
        return cause === undefined ? [] : [cause];
      })
  );

  return {
    seed: run.seed,
    invariantFailures: run.invariantFailures,
    ...(run.invariantFailureDay !== undefined
      ? { invariantFailureDay: run.invariantFailureDay }
      : {}),
    ...(run.invariantError !== undefined
      ? { invariantError: run.invariantError }
      : {}),
    finalResources: run.summary.finalResources,
    persistence,
    postStartGeneration: {
      folsomia: run.summary.animals.folsomia.postStartEver > 0,
      trichorhina: run.summary.animals.trichorhina.postStartEver > 0,
      bradysia: run.summary.animals.bradysia.postStartEver > 0,
      dalotia: run.summary.animals.dalotia.postStartEver > 0
    },
    finalLiving: {
      fittonia: run.summary.plants.fittonia.finalLiving,
      peperomia: run.summary.plants.peperomia.finalLiving,
      pilea: run.summary.plants.pilea.finalLiving,
      folsomia: run.summary.animals.folsomia.finalLiving,
      trichorhina: run.summary.animals.trichorhina.finalLiving,
      bradysia: run.summary.animals.bradysia.finalLiving,
      dalotia: run.summary.animals.dalotia.finalLiving
    },
    stability: {
      fittonia: stabilityOutcome(run.summary.plants.fittonia),
      peperomia: stabilityOutcome(run.summary.plants.peperomia),
      pilea: stabilityOutcome(run.summary.plants.pilea),
      folsomia: stabilityOutcome(run.summary.animals.folsomia),
      trichorhina: stabilityOutcome(run.summary.animals.trichorhina),
      bradysia: stabilityOutcome(run.summary.animals.bradysia),
      dalotia: stabilityOutcome(run.summary.animals.dalotia)
    },
    resourceDrift: resourceDelta(
      run.samples[0]!.resources,
      run.summary.finalResources
    ),
    litterNitrogenTracerReturned:
      run.summary.litterNitrogenTracer.reachedPlantTissue,
    deathCauses: {
      folsomia: deathEventCauses(run.ecosystem.animals.folsomia.eventLog()),
      trichorhina: trichorhinaDeathCauses,
      bradysia: deathEventCauses(run.ecosystem.animals.bradysia.eventLog()),
      dalotia: deathEventCauses(run.ecosystem.animals.dalotia.eventLog())
    },
    predation: {
      total: predationEvents.length,
      bradysia: bradysiaPredation,
      folsomia: folsomiaPredation
    },
    finalStages: {
      folsomia: livingStageCounts(run.ecosystem.animals.folsomia.all()),
      trichorhina: livingStageCounts(run.ecosystem.animals.trichorhina.all()),
      bradysia: livingStageCounts(run.ecosystem.animals.bradysia.all()),
      dalotia: livingStageCounts(run.ecosystem.animals.dalotia.all())
    }
  };
}

function outcomeProbability(
  outcomes: RunOutcome[],
  predicate: (outcome: RunOutcome) => boolean
): number {
  if (outcomes.length === 0) return 0;
  return outcomes.filter(predicate).length / outcomes.length;
}

function outcomeMean(
  outcomes: RunOutcome[],
  selector: (outcome: RunOutcome) => number
): number {
  if (outcomes.length === 0) return 0;
  return outcomes.reduce((sum, outcome) => sum + selector(outcome), 0) /
    outcomes.length;
}

function outcomeMeanNullable(
  outcomes: RunOutcome[],
  selector: (outcome: RunOutcome) => number | null
): number | null {
  const values = outcomes
    .map(selector)
    .filter((value): value is number => value !== null);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function summarizeOutcomes(
  days: number,
  seeds: number[],
  outcomes: RunOutcome[]
): BatchSummary {
  return {
    days,
    seeds: [...seeds],
    runCount: outcomes.length,
    runOutcomes: [...outcomes],
    invariantFailureRuns: outcomes.filter(
      (outcome) => outcome.invariantFailures > 0
    ).length,
    litterNitrogenTracerReturnedRuns: outcomes.filter(
      (outcome) => outcome.litterNitrogenTracerReturned
    ).length,
    persistenceProbability: {
      fittonia: outcomeProbability(outcomes, (x) => x.persistence.fittonia),
      peperomia: outcomeProbability(outcomes, (x) => x.persistence.peperomia),
      pilea: outcomeProbability(outcomes, (x) => x.persistence.pilea),
      folsomia: outcomeProbability(outcomes, (x) => x.persistence.folsomia),
      trichorhina: outcomeProbability(outcomes, (x) => x.persistence.trichorhina),
      bradysia: outcomeProbability(outcomes, (x) => x.persistence.bradysia),
      dalotia: outcomeProbability(outcomes, (x) => x.persistence.dalotia)
    },
    jointPersistenceProbability: {
      allProducers: outcomeProbability(
        outcomes,
        (x) => x.persistence.allProducers
      ),
      atLeastOneDetritivore: outcomeProbability(
        outcomes,
        (x) => x.persistence.atLeastOneDetritivore
      )
    },
    postStartGenerationProbability: {
      folsomia: outcomeProbability(
        outcomes,
        (x) => x.postStartGeneration.folsomia
      ),
      trichorhina: outcomeProbability(
        outcomes,
        (x) => x.postStartGeneration.trichorhina
      ),
      bradysia: outcomeProbability(
        outcomes,
        (x) => x.postStartGeneration.bradysia
      ),
      dalotia: outcomeProbability(
        outcomes,
        (x) => x.postStartGeneration.dalotia
      )
    },
    meanFinalLiving: {
      fittonia: outcomeMean(outcomes, (x) => x.finalLiving.fittonia),
      peperomia: outcomeMean(outcomes, (x) => x.finalLiving.peperomia),
      pilea: outcomeMean(outcomes, (x) => x.finalLiving.pilea),
      folsomia: outcomeMean(outcomes, (x) => x.finalLiving.folsomia),
      trichorhina: outcomeMean(outcomes, (x) => x.finalLiving.trichorhina),
      bradysia: outcomeMean(outcomes, (x) => x.finalLiving.bradysia),
      dalotia: outcomeMean(outcomes, (x) => x.finalLiving.dalotia)
    },
    meanLiving: {
      fittonia: outcomeMean(outcomes, (x) => x.stability.fittonia.meanLiving),
      peperomia: outcomeMean(outcomes, (x) => x.stability.peperomia.meanLiving),
      pilea: outcomeMean(outcomes, (x) => x.stability.pilea.meanLiving),
      folsomia: outcomeMean(outcomes, (x) => x.stability.folsomia.meanLiving),
      trichorhina: outcomeMean(outcomes, (x) => x.stability.trichorhina.meanLiving),
      bradysia: outcomeMean(outcomes, (x) => x.stability.bradysia.meanLiving),
      dalotia: outcomeMean(outcomes, (x) => x.stability.dalotia.meanLiving)
    },
    meanCoefficientOfVariation: {
      fittonia: outcomeMean(outcomes, (x) => x.stability.fittonia.coefficientOfVariation),
      peperomia: outcomeMean(outcomes, (x) => x.stability.peperomia.coefficientOfVariation),
      pilea: outcomeMean(outcomes, (x) => x.stability.pilea.coefficientOfVariation),
      folsomia: outcomeMean(outcomes, (x) => x.stability.folsomia.coefficientOfVariation),
      trichorhina: outcomeMean(outcomes, (x) => x.stability.trichorhina.coefficientOfVariation),
      bradysia: outcomeMean(outcomes, (x) => x.stability.bradysia.coefficientOfVariation),
      dalotia: outcomeMean(outcomes, (x) => x.stability.dalotia.coefficientOfVariation)
    },
    meanPeakToTroughRatio: {
      fittonia: outcomeMeanNullable(outcomes, (x) => x.stability.fittonia.peakToTroughRatio),
      peperomia: outcomeMeanNullable(outcomes, (x) => x.stability.peperomia.peakToTroughRatio),
      pilea: outcomeMeanNullable(outcomes, (x) => x.stability.pilea.peakToTroughRatio),
      folsomia: outcomeMeanNullable(outcomes, (x) => x.stability.folsomia.peakToTroughRatio),
      trichorhina: outcomeMeanNullable(outcomes, (x) => x.stability.trichorhina.peakToTroughRatio),
      bradysia: outcomeMeanNullable(outcomes, (x) => x.stability.bradysia.peakToTroughRatio),
      dalotia: outcomeMeanNullable(outcomes, (x) => x.stability.dalotia.peakToTroughRatio)
    },
    meanGenerationTurnover: {
      fittonia: outcomeMean(outcomes, (x) => x.stability.fittonia.generationTurnover),
      peperomia: outcomeMean(outcomes, (x) => x.stability.peperomia.generationTurnover),
      pilea: outcomeMean(outcomes, (x) => x.stability.pilea.generationTurnover),
      folsomia: outcomeMean(outcomes, (x) => x.stability.folsomia.generationTurnover),
      trichorhina: outcomeMean(outcomes, (x) => x.stability.trichorhina.generationTurnover),
      bradysia: outcomeMean(outcomes, (x) => x.stability.bradysia.generationTurnover),
      dalotia: outcomeMean(outcomes, (x) => x.stability.dalotia.generationTurnover)
    },
    meanExtinctionDay: {
      fittonia: outcomeMeanNullable(outcomes, (x) => x.stability.fittonia.extinctionDay),
      peperomia: outcomeMeanNullable(outcomes, (x) => x.stability.peperomia.extinctionDay),
      pilea: outcomeMeanNullable(outcomes, (x) => x.stability.pilea.extinctionDay),
      folsomia: outcomeMeanNullable(outcomes, (x) => x.stability.folsomia.extinctionDay),
      trichorhina: outcomeMeanNullable(outcomes, (x) => x.stability.trichorhina.extinctionDay),
      bradysia: outcomeMeanNullable(outcomes, (x) => x.stability.bradysia.extinctionDay),
      dalotia: outcomeMeanNullable(outcomes, (x) => x.stability.dalotia.extinctionDay)
    },
    meanResourceDrift: {
      totalCarbonMg: outcomeMean(outcomes, (x) => x.resourceDrift.totalCarbonMg),
      totalNitrogenMg: outcomeMean(outcomes, (x) => x.resourceDrift.totalNitrogenMg),
      totalPhosphorusMg: outcomeMean(outcomes, (x) => x.resourceDrift.totalPhosphorusMg),
      totalWaterG: outcomeMean(outcomes, (x) => x.resourceDrift.totalWaterG),
      litterCarbonMg: outcomeMean(outcomes, (x) => x.resourceDrift.litterCarbonMg),
      fineDetritusCarbonMg: outcomeMean(outcomes, (x) => x.resourceDrift.fineDetritusCarbonMg),
      corpseCarbonMg: outcomeMean(outcomes, (x) => x.resourceDrift.corpseCarbonMg),
      availableNitrogenMg: outcomeMean(outcomes, (x) => x.resourceDrift.availableNitrogenMg),
      availablePhosphorusMg: outcomeMean(outcomes, (x) => x.resourceDrift.availablePhosphorusMg),
      fungalCarbonMg: outcomeMean(outcomes, (x) => x.resourceDrift.fungalCarbonMg),
      bacterialCarbonMg: outcomeMean(outcomes, (x) => x.resourceDrift.bacterialCarbonMg)
    }
  };
}

export function runEcosystemBatch(options: BatchOptions): BatchSummary {
  if (options.seeds.length === 0) {
    throw new Error("Batch requires at least one seed");
  }
  if (new Set(options.seeds).size !== options.seeds.length) {
    throw new Error("Batch seeds must be unique");
  }

  // Convert each completed world to its compact outcome immediately.
  // IntegratedRunResult intentionally exposes the full ecosystem for one-run
  // diagnostics, but retaining one full world per seed makes long multi-seed
  // calibration batches accumulate all historical individuals in memory.
  // Sequential compaction preserves seed order/results while allowing each
  // completed world to become unreachable before the next seed starts.
  const outcomes: RunOutcome[] = [];
  for (const seed of options.seeds) {
    const runOptions: IntegratedRunOptions = {
      seed,
      days: options.days
    };
    if (options.sampleEveryDays !== undefined) {
      runOptions.sampleEveryDays = options.sampleEveryDays;
    }
    outcomes.push(runOutcome(runIntegratedEcosystem(runOptions)));
  }

  return summarizeOutcomes(options.days, options.seeds, outcomes);
}

export function mergeBatchSummaries(
  summaries: BatchSummary[]
): BatchSummary {
  if (summaries.length === 0) {
    throw new Error("At least one batch summary is required");
  }

  const days = summaries[0]!.days;
  if (summaries.some((summary) => summary.days !== days)) {
    throw new Error("Cannot merge batch summaries with different days");
  }

  const seeds = summaries.flatMap((summary) => summary.seeds);
  if (new Set(seeds).size !== seeds.length) {
    throw new Error("Cannot merge batch summaries with duplicate seeds");
  }

  const outcomes = summaries.flatMap((summary) => summary.runOutcomes);
  return summarizeOutcomes(days, seeds, outcomes);
}

export interface AcceptanceCriterion {
  actual: number;
  target: number;
  pass: boolean;
}

export interface MvpAcceptance {
  pass: boolean;
  criteria: {
    zeroInvariantFailures: AcceptanceCriterion;
    allProducersPersistence: AcceptanceCriterion;
    detritivorePersistence: AcceptanceCriterion;
    bradysiaPersistence: AcceptanceCriterion;
    dalotiaPersistence: AcceptanceCriterion;
    survivingAnimalGenerations: AcceptanceCriterion;
    litterNitrogenTracerReturn: AcceptanceCriterion;
  };
}

export function evaluateMvpAcceptance(
  summary: BatchSummary
): MvpAcceptance {
  const survivingAnimalPairs = summary.runOutcomes.flatMap((outcome) => [
    [outcome.persistence.folsomia, outcome.postStartGeneration.folsomia],
    [outcome.persistence.trichorhina, outcome.postStartGeneration.trichorhina],
    [outcome.persistence.bradysia, outcome.postStartGeneration.bradysia],
    [outcome.persistence.dalotia, outcome.postStartGeneration.dalotia]
  ] as const);
  const survivingPairs = survivingAnimalPairs.filter(([survives]) => survives);
  const generationRate =
    survivingPairs.length === 0
      ? 1
      : survivingPairs.filter(([, generated]) => generated).length /
        survivingPairs.length;

  const criteria = {
    zeroInvariantFailures: {
      actual: summary.invariantFailureRuns,
      target: 0,
      pass: summary.invariantFailureRuns === 0
    },
    allProducersPersistence: {
      actual: summary.jointPersistenceProbability.allProducers,
      target: 0.8,
      pass: summary.jointPersistenceProbability.allProducers >= 0.8
    },
    detritivorePersistence: {
      actual: summary.jointPersistenceProbability.atLeastOneDetritivore,
      target: 0.8,
      pass:
        summary.jointPersistenceProbability.atLeastOneDetritivore >= 0.8
    },
    bradysiaPersistence: {
      actual: summary.persistenceProbability.bradysia,
      target: 0.7,
      pass: summary.persistenceProbability.bradysia >= 0.7
    },
    dalotiaPersistence: {
      actual: summary.persistenceProbability.dalotia,
      target: 0.7,
      pass: summary.persistenceProbability.dalotia >= 0.7
    },
    survivingAnimalGenerations: {
      actual: generationRate,
      target: 1,
      pass: generationRate === 1
    },
    litterNitrogenTracerReturn: {
      actual: summary.litterNitrogenTracerReturnedRuns,
      target: 1,
      pass: summary.litterNitrogenTracerReturnedRuns >= 1
    }
  };

  return {
    pass: Object.values(criteria).every((criterion) => criterion.pass),
    criteria
  };
}

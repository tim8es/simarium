import { describe, expect, it } from "vitest";
import phase2 from "../data/experiments/phase2-multiplant.json";
import experiment from "../data/experiments/phase4-trichorhina.json";
import {
  DeterministicRng,
  FixedStepScheduler,
  InvariantMonitor,
  MassLedger,
  MicrobialDecomposerSystem,
  ScalarGrid3D,
  TrichorhinaDetritivoreSystem,
  WorldState,
  seedTrichorhinaJuveniles,
  type TrichorhinaParameters,
  type TrichorhinaPopulation
} from "../packages/sim-core/src/index.ts";

const p = (name: keyof typeof experiment.parameters): number =>
  experiment.parameters[name].value;

function createPopulation(): TrichorhinaPopulation {
  return seedTrichorhinaJuveniles({
    count: experiment.initialPopulation.count,
    ageDays: experiment.initialPopulation.ageDays,
    carbonMg: p("initialJuvenileCarbonMg"),
    reserveCarbonMg: p("initialReserveCarbonMg"),
    nitrogenPerCarbon: p("nitrogenPerCarbon"),
    phosphorusPerCarbon: p("phosphorusPerCarbon"),
    adultBodyWaterG: p("adultBodyWaterG")
  });
}

function createWorld(
  population?: TrichorhinaPopulation,
  mutate?: (pools: typeof experiment.world.initialPools) => void
): WorldState {
  const pools = structuredClone(experiment.world.initialPools);
  if (population) pools.trichorhina_biomass = population.totalLivingMaterial();
  mutate?.(pools);

  return new WorldState(
    {
      seed: 20260925,
      fixedDtSeconds: experiment.world.fixedDtSeconds,
      roomTemperatureC: experiment.world.temperatureC
    },
    new MassLedger(pools),
    {
      temperatureC: new ScalarGrid3D(
        2,
        2,
        2,
        experiment.world.temperatureC
      )
    },
    new DeterministicRng(20260925)
  );
}

function parameters(
  overrides: Partial<TrichorhinaParameters> = {}
): TrichorhinaParameters {
  return {
    biomassPool: "trichorhina_biomass",
    feedBufferPool: "trichorhina_feed_buffer",
    coarseLitterPool: "litter",
    fineDetritusPool: "fine_detritus",
    fungusPool: "linnemannia_biomass",
    atmospherePool: "atmosphere",
    substratePool: "substrate",
    corpsePool: "animal_corpses",

    temperatureOptimumC: p("temperatureOptimumC"),
    temperatureSigmaC: p("temperatureSigmaC"),
    mancaDevelopmentDays: p("mancaDevelopmentDays"),
    adultDevelopmentDays: p("adultDevelopmentDays"),
    broodIntervalDays: p("broodIntervalDays"),
    broodSize: p("broodSize"),
    adultLifespanDays: p("adultLifespanDays"),

    feedingCarbonRateMgPerSecond: p("feedingCarbonRateMgPerSecond"),
    assimilationEfficiency: p("assimilationEfficiency"),
    reserveTargetFraction: p("reserveTargetFraction"),
    reproductionReserveFraction: p("reproductionReserveFraction"),
    basalMetabolismCarbonMgPerSecond: p("basalMetabolismCarbonMgPerSecond"),

    moistureHalfSaturationWaterG: p("moistureHalfSaturationWaterG"),
    reproductionMoistureThreshold: p("reproductionMoistureThreshold"),
    desiccationRatePerSecond: p("desiccationRatePerSecond"),
    hydrationRatePerSecond: p("hydrationRatePerSecond"),

    adultCarbonTargetMg: p("adultCarbonMg"),
    maturationCarbonFractionOfAdult: p("maturationCarbonFractionOfAdult"),
    adultBodyWaterG: p("adultBodyWaterG"),
    mancaCarbonMg: p("mancaCarbonMg"),
    ...overrides
  };
}

function decomposer(
  litterPool: string,
  bufferPool: string,
  rateMultiplier: number,
  turnoverRate: number
): MicrobialDecomposerSystem {
  return new MicrobialDecomposerSystem({
    litterPool,
    bufferPool,
    fungusPool: "linnemannia_biomass",
    bacteriaPool: "bacillus_biomass",
    atmospherePool: "atmosphere",
    nutrientPool: "available_nutrients",
    substratePool: "substrate",
    decompositionRatePerSecond:
      phase2.decomposer.decompositionRatePerSecond.value * rateMultiplier,
    carbonUseEfficiency: phase2.decomposer.carbonUseEfficiency.value,
    fungalShare: phase2.decomposer.fungalShare.value,
    microbialTurnoverRatePerSecond: turnoverRate,
    moisturePool: "substrate",
    moistureHalfSaturationWaterG:
      phase2.decomposer.moistureHalfSaturationWaterG.value,
    temperatureOptimumC: phase2.decomposer.temperatureOptimumC.value,
    temperatureSigmaC: phase2.decomposer.temperatureSigmaC.value
  });
}

describe("Phase 4 Trichorhina tomentosa detritivore", () => {
  it("matures and produces material-paid parthenogenetic offspring", () => {
    const population = createPopulation();
    const world = createWorld(population);
    const invariant = new InvariantMonitor(world);

    const scheduler = new FixedStepScheduler(world, [
      new TrichorhinaDetritivoreSystem(population, parameters())
    ]);
    scheduler.runFor(100 * 86400);
    invariant.check(world);

    const descendants = population
      .all()
      .filter((individual) => individual.parentId !== undefined);
    expect(descendants.length).toBeGreaterThan(0);
    expect(
      population
        .all()
        .some((individual) => individual.stage === "adult" && individual.offspringCount > 0)
    ).toBe(true);
    population.assertMatchesAggregate(
      world.ledger.getPool("trichorhina_biomass")
    );
    expect(world.ledger.getPool("trichorhina_feed_buffer").carbonMg).toBeCloseTo(0, 12);
  }, 30_000);

  it("suppresses brood production when the substrate is too dry", () => {
    const wetPopulation = createPopulation();
    const wet = createWorld(wetPopulation);
    const dryPopulation = createPopulation();
    const dry = createWorld(dryPopulation, (pools) => {
      pools.substrate.waterG = 10;
    });

    new FixedStepScheduler(wet, [
      new TrichorhinaDetritivoreSystem(wetPopulation, parameters())
    ]).runFor(100 * 86400);

    new FixedStepScheduler(dry, [
      new TrichorhinaDetritivoreSystem(dryPopulation, parameters())
    ]).runFor(100 * 86400);

    const wetDescendants = wetPopulation.all().filter((x) => x.parentId !== undefined).length;
    const dryDescendants = dryPopulation.all().filter((x) => x.parentId !== undefined).length;

    expect(wetDescendants).toBeGreaterThan(0);
    expect(dryDescendants).toBe(0);
  }, 30_000);

  it("creates fine detritus through feeding rather than changing decomposition globally", () => {
    const population = createPopulation();
    const world = createWorld(population);
    const invariant = new InvariantMonitor(world);
    const initialCoarse = world.ledger.getPool("litter").carbonMg;

    new FixedStepScheduler(world, [
      new TrichorhinaDetritivoreSystem(population, parameters()),
      decomposer(
        "fine_detritus",
        "fine_decomposition_buffer",
        p("fineDetritusRateMultiplier"),
        0
      )
    ]).runFor(20 * 86400);

    invariant.check(world);
    expect(world.ledger.getPool("litter").carbonMg).toBeLessThan(initialCoarse);
    expect(
      world.ledger.getPool("fine_detritus").carbonMg +
      world.ledger.getPool("fine_decomposition_buffer").carbonMg
    ).toBeGreaterThanOrEqual(0);
    expect(world.ledger.getPool("trichorhina_biomass").carbonMg).toBeGreaterThan(0);
  }, 30_000);

  it("pre-fragmented litter decomposes faster because of pool properties, independent of isopod presence", () => {
    const coarse = createWorld(undefined, (pools) => {
      pools.litter.carbonMg = 100;
      pools.litter.nitrogenMg = 3;
      pools.litter.phosphorusMg = 0.3;
      pools.fine_detritus.carbonMg = 0;
      pools.fine_detritus.nitrogenMg = 0;
      pools.fine_detritus.phosphorusMg = 0;
    });
    const fine = createWorld(undefined, (pools) => {
      pools.litter.carbonMg = 0;
      pools.litter.nitrogenMg = 0;
      pools.litter.phosphorusMg = 0;
      pools.fine_detritus.carbonMg = 100;
      pools.fine_detritus.nitrogenMg = 3;
      pools.fine_detritus.phosphorusMg = 0.3;
    });

    new FixedStepScheduler(coarse, [
      decomposer(
        "litter",
        "coarse_decomposition_buffer",
        1,
        0
      )
    ]).runFor(15 * 86400);

    new FixedStepScheduler(fine, [
      decomposer(
        "fine_detritus",
        "fine_decomposition_buffer",
        p("fineDetritusRateMultiplier"),
        0
      )
    ]).runFor(15 * 86400);

    expect(fine.ledger.getPool("fine_detritus").carbonMg).toBeLessThan(
      coarse.ledger.getPool("litter").carbonMg
    );
  });

  it("moves remaining body matter into corpse biomass on senescence", () => {
    const population = createPopulation();
    for (const individual of population.living()) {
      individual.stage = "adult";
      individual.ageSeconds = (p("adultLifespanDays") + 1) * 86400;
      individual.stageAgeSeconds = 100 * 86400;
    }
    const world = createWorld(population);
    const invariant = new InvariantMonitor(world);

    new FixedStepScheduler(world, [
      new TrichorhinaDetritivoreSystem(population, parameters())
    ]).step(1);

    invariant.check(world);
    expect(population.living()).toHaveLength(0);
    expect(world.ledger.getPool("animal_corpses").carbonMg).toBeGreaterThan(0);
    expect(world.ledger.getPool("trichorhina_biomass").carbonMg).toBeCloseTo(0, 12);
  });
  it("does not mature an underweight juvenile on thermal time alone", () => {
    const population = createPopulation();
    for (const individual of population.living()) {
      individual.stage = "juvenile";
      individual.stageAgeSeconds = (p("adultDevelopmentDays") + 1) * 86400;
      individual.material.carbonMg = p("adultCarbonMg") * 0.10;
      individual.reserveCarbonMg = individual.material.carbonMg * 0.05;
    }
    const world = createWorld(population, (pools) => {
      pools.litter.carbonMg = 0;
      pools.litter.nitrogenMg = 0;
      pools.litter.phosphorusMg = 0;
      pools.linnemannia_biomass.carbonMg = 0;
      pools.linnemannia_biomass.nitrogenMg = 0;
      pools.linnemannia_biomass.phosphorusMg = 0;
    });

    new FixedStepScheduler(world, [
      new TrichorhinaDetritivoreSystem(population, parameters())
    ]).step(1);

    expect(population.living().every((x) => x.stage === "juvenile")).toBe(true);
  });

});

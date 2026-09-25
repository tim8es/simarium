import { describe, expect, it } from "vitest";
import experiment from "../data/experiments/phase3-folsomia.json";
import {
  DeterministicRng,
  FixedStepScheduler,
  FolsomiaLifecycleSystem,
  InvariantMonitor,
  MassLedger,
  ScalarGrid3D,
  WorldState,
  seedFolsomiaJuveniles,
  type FolsomiaParameters,
  type FolsomiaPopulation
} from "../packages/sim-core/src/index.ts";

const p = (name: keyof typeof experiment.parameters): number =>
  experiment.parameters[name].value;

function createPopulation(): FolsomiaPopulation {
  return seedFolsomiaJuveniles({
    count: experiment.initialPopulation.count,
    ageDays: experiment.initialPopulation.ageDays,
    carbonMg: p("initialJuvenileCarbonMg"),
    reserveCarbonMg: p("initialReserveCarbonMg"),
    nitrogenPerCarbon: p("nitrogenPerCarbon"),
    phosphorusPerCarbon: p("phosphorusPerCarbon"),
    bodyWaterG: p("adultBodyWaterG")
  });
}

function createWorld(
  population: FolsomiaPopulation,
  mutatePools?: (pools: typeof experiment.world.initialPools) => void
): WorldState {
  const pools = structuredClone(experiment.world.initialPools);
  pools.folsomia_biomass = population.totalLivingMaterial();
  mutatePools?.(pools);

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

function parameters(overrides: Partial<FolsomiaParameters> = {}): FolsomiaParameters {
  return {
    biomassPool: "folsomia_biomass",
    feedBufferPool: "folsomia_feed_buffer",
    foodPools: ["linnemannia_biomass", "bacillus_biomass"],
    litterPool: "litter",
    corpsePool: "animal_corpses",
    atmospherePool: "atmosphere",
    substratePool: "substrate",

    temperatureOptimumC: p("temperatureOptimumC"),
    temperatureSigmaC: p("temperatureSigmaC"),
    eggDevelopmentDays: p("eggDevelopmentDays"),
    adultDevelopmentDays: p("adultDevelopmentDays"),
    reproductionIntervalDays: p("reproductionIntervalDays"),
    clutchSize: p("clutchSize"),
    adultLifespanDays: p("adultLifespanDays"),

    feedingCarbonRateMgPerSecond: p("feedingCarbonRateMgPerSecond"),
    assimilationEfficiency: p("assimilationEfficiency"),
    reserveTargetFraction: p("reserveTargetFraction"),
    reproductionReserveFraction: p("reproductionReserveFraction"),
    basalMetabolismCarbonMgPerSecond: p("basalMetabolismCarbonMgPerSecond"),
    starvationDeathDays: p("starvationDeathDays"),

    moistureHalfSaturationWaterG: p("moistureHalfSaturationWaterG"),
    reproductionMoistureThreshold: p("reproductionMoistureThreshold"),
    desiccationRatePerSecond: p("desiccationRatePerSecond"),
    hydrationRatePerSecond: p("hydrationRatePerSecond"),

    adultBodyWaterG: p("adultBodyWaterG"),
    adultCarbonTargetMg: p("adultCarbonMg"),
    eggCarbonMg: p("eggCarbonMg"),
    ...overrides
  };
}

describe("Phase 3 Folsomia candida lifecycle", () => {
  it("produces post-start descendants and preserves genealogy across generations", () => {
    const population = createPopulation();
    const world = createWorld(population);
    const invariant = new InvariantMonitor(world);
    const system = new FolsomiaLifecycleSystem(population, parameters());
    const scheduler = new FixedStepScheduler(world, [system]);

    scheduler.runFor(75 * 86400);
    invariant.check(world);

    const descendants = population
      .all()
      .filter((individual) => individual.parentId !== undefined);
    expect(descendants.length).toBeGreaterThan(0);

    const grandchildren = descendants.filter((individual) => {
      if (individual.parentId === undefined) return false;
      return population.record(individual.parentId).parentId !== undefined;
    });
    expect(grandchildren.length).toBeGreaterThan(0);

    expect(
      population.eventLog().some((event) => event.type === "reproduction")
    ).toBe(true);
    expect(
      population.eventLog().some((event) => event.type === "stage" && event.to === "adult")
    ).toBe(true);

    population.assertMatchesAggregate(
      world.ledger.getPool("folsomia_biomass"),
      1e-8
    );
    expect(world.ledger.getPool("folsomia_feed_buffer").carbonMg).toBeCloseTo(0, 12);
  }, 30_000);

  it("suppresses reproduction in a dry substrate proxy", () => {
    const wetPopulation = createPopulation();
    const wet = createWorld(wetPopulation);
    const dryPopulation = createPopulation();
    const dry = createWorld(dryPopulation, (pools) => {
      pools.substrate.waterG = 10;
    });

    new FixedStepScheduler(wet, [
      new FolsomiaLifecycleSystem(wetPopulation, parameters())
    ]).runFor(30 * 86400);

    new FixedStepScheduler(dry, [
      new FolsomiaLifecycleSystem(dryPopulation, parameters())
    ]).runFor(30 * 86400);

    const wetBirths = wetPopulation.eventLog().filter(
      (event) => event.type === "birth" && event.parentId !== undefined
    ).length;
    const dryBirths = dryPopulation.eventLog().filter(
      (event) => event.type === "birth" && event.parentId !== undefined
    ).length;

    expect(wetBirths).toBeGreaterThan(0);
    expect(dryBirths).toBe(0);
  }, 30_000);

  it("moves all remaining individual matter into corpse biomass on senescence", () => {
    const population = createPopulation();
    for (const individual of population.living()) {
      individual.stage = "adult";
      individual.ageSeconds = (p("adultLifespanDays") + 1) * 86400;
      individual.stageAgeSeconds = 30 * 86400;
    }
    const world = createWorld(population);
    const invariant = new InvariantMonitor(world);

    new FixedStepScheduler(world, [
      new FolsomiaLifecycleSystem(population, parameters())
    ]).step(1);

    invariant.check(world);
    expect(population.living()).toHaveLength(0);
    expect(world.ledger.getPool("animal_corpses").carbonMg).toBeGreaterThan(0);
    expect(world.ledger.getPool("folsomia_biomass").carbonMg).toBeCloseTo(0, 12);
    expect(
      population.eventLog().filter((event) => event.type === "death").length
    ).toBe(experiment.initialPopulation.count);
  });

  it("can die from starvation without hidden population rescue", () => {
    const population = createPopulation();
    for (const individual of population.living()) {
      individual.stage = "adult";
      individual.ageSeconds = 30 * 86400;
      individual.stageAgeSeconds = 30 * 86400;
      individual.reserveCarbonMg = 0.00001;
    }
    const world = createWorld(population, (pools) => {
      pools.linnemannia_biomass = {
        carbonMg: 0,
        nitrogenMg: 0,
        phosphorusMg: 0,
        waterG: 0
      };
      pools.bacillus_biomass = {
        carbonMg: 0,
        nitrogenMg: 0,
        phosphorusMg: 0,
        waterG: 0
      };
    });
    const invariant = new InvariantMonitor(world);

    const stressed = parameters({
      basalMetabolismCarbonMgPerSecond:
        p("basalMetabolismCarbonMgPerSecond") * 20,
      starvationDeathDays: 2,
      adultLifespanDays: 1000
    });

    new FixedStepScheduler(world, [
      new FolsomiaLifecycleSystem(population, stressed)
    ]).runFor(15 * 86400);

    invariant.check(world);
    expect(population.living().length).toBeLessThan(
      experiment.initialPopulation.count
    );
    expect(
      population.eventLog().some(
        (event) =>
          event.type === "death" &&
          (event.cause === "starvation" || event.cause === "carbon_exhaustion")
      )
    ).toBe(true);
    expect(world.ledger.getPool("animal_corpses").carbonMg).toBeGreaterThan(0);
  }, 30_000);
});

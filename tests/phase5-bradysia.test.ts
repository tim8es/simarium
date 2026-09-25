import { describe, expect, it } from "vitest";
import experiment from "../data/experiments/phase5-bradysia.json";
import {
  BradysiaLifecycleSystem,
  BradysiaPopulation,
  DeterministicRng,
  FixedStepScheduler,
  InvariantMonitor,
  MassLedger,
  ScalarGrid3D,
  WorldState,
  seedBradysiaLarvae,
  type BradysiaParameters,
  type Material
} from "../packages/sim-core/src/index.ts";

const p = (name: keyof typeof experiment.parameters): number =>
  experiment.parameters[name].value;

function createLarvalPopulation(): BradysiaPopulation {
  return seedBradysiaLarvae({
    count: experiment.initialPopulation.count,
    ageDays: experiment.initialPopulation.ageDays,
    carbonMg: p("initialLarvaCarbonMg"),
    reserveCarbonMg: p("initialReserveCarbonMg"),
    nitrogenPerCarbon: p("nitrogenPerCarbon"),
    phosphorusPerCarbon: p("phosphorusPerCarbon"),
    adultBodyWaterG: p("adultBodyWaterG")
  });
}

function createAdultPair(includeMale = true): BradysiaPopulation {
  const population = new BradysiaPopulation();
  const material: Material = {
    carbonMg: p("adultCarbonTargetMg"),
    nitrogenMg: p("adultCarbonTargetMg") * p("nitrogenPerCarbon"),
    phosphorusMg: p("adultCarbonTargetMg") * p("phosphorusPerCarbon"),
    waterG: p("adultBodyWaterG")
  };

  population.create({
    stage: "adult",
    sex: "female",
    ageSeconds: 22 * 86400,
    stageAgeSeconds: 0,
    adultAgeSeconds: 0,
    birthTimeSeconds: -22 * 86400,
    material,
    reserveCarbonMg: material.carbonMg * 0.35,
    starvationSeconds: 0,
    dehydrationSeconds: 0,
    hasOviposited: false
  });

  if (includeMale) {
    population.create({
      stage: "adult",
      sex: "male",
      ageSeconds: 22 * 86400,
      stageAgeSeconds: 0,
      adultAgeSeconds: 0,
      birthTimeSeconds: -22 * 86400,
      material,
      reserveCarbonMg: material.carbonMg * 0.35,
      starvationSeconds: 0,
      dehydrationSeconds: 0,
      hasOviposited: false
    });
  }

  return population;
}

function createWorld(
  population: BradysiaPopulation,
  mutate?: (pools: typeof experiment.world.initialPools) => void
): WorldState {
  const pools = structuredClone(experiment.world.initialPools);
  pools.bradysia_biomass = population.totalLivingMaterial();
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
  overrides: Partial<BradysiaParameters> = {}
): BradysiaParameters {
  return {
    biomassPool: "bradysia_biomass",
    feedBufferPool: "bradysia_feed_buffer",
    fungusPool: "linnemannia_biomass",
    rootTissuePool: "plant_root_tissue",
    litterPool: "litter",
    atmospherePool: "atmosphere",
    substratePool: "substrate",
    corpsePool: "animal_corpses",

    referenceTemperatureC: p("referenceTemperatureC"),
    temperatureSigmaC: p("temperatureSigmaC"),
    eggDevelopmentDays: p("eggDevelopmentDays"),
    larvalDevelopmentDays: p("larvalDevelopmentDays"),
    pupalDevelopmentDays: p("pupalDevelopmentDays"),
    adultLifespanDays: p("adultLifespanDays"),
    preOvipositionHours: p("preOvipositionHours"),
    fecundityEggsPerFemale: p("fecundityEggsPerFemale"),
    femaleProbability: p("femaleProbability"),

    larvalFeedingCarbonMgPerSecond: p("larvalFeedingCarbonMgPerSecond"),
    assimilationEfficiency: p("assimilationEfficiency"),
    fungusPreference: p("fungusPreference"),
    basalMetabolismCarbonMgPerSecond: p("basalMetabolismCarbonMgPerSecond"),
    adultFlightMetabolismMultiplier: p("adultFlightMetabolismMultiplier"),
    adultCarbonTargetMg: p("adultCarbonTargetMg"),
    eggCarbonMg: p("eggCarbonMg"),

    adultBodyWaterG: p("adultBodyWaterG"),
    moistureHalfSaturationWaterG: p("moistureHalfSaturationWaterG"),
    ovipositionMoistureThreshold: p("ovipositionMoistureThreshold"),
    ...overrides
  };
}

describe("Phase 5 Bradysia impatiens lifecycle", () => {
  it("completes larva -> pupa -> adult and assigns real sexes deterministically", () => {
    const population = createLarvalPopulation();
    const world = createWorld(population);
    const invariant = new InvariantMonitor(world);

    new FixedStepScheduler(world, [
      new BradysiaLifecycleSystem(population, parameters())
    ]).runFor(20 * 86400);

    invariant.check(world);
    const adults = population
      .living()
      .filter((individual) => individual.stage === "adult");

    expect(adults.length).toBeGreaterThan(0);
    expect(adults.every((individual) => individual.sex !== undefined)).toBe(true);
    expect(
      population.eventLog().some((event) => event.type === "stage" && event.to === "pupa")
    ).toBe(true);
    expect(
      population.eventLog().some((event) => event.type === "stage" && event.to === "adult")
    ).toBe(true);
    population.assertMatchesAggregate(
      world.ledger.getPool("bradysia_biomass")
    );
  }, 30_000);

  it("requires a male and moist substrate for oviposition", () => {
    const paired = createAdultPair(true);
    const pairedWorld = createWorld(paired);
    const unpaired = createAdultPair(false);
    const unpairedWorld = createWorld(unpaired);
    const dryPair = createAdultPair(true);
    const dryWorld = createWorld(dryPair, (pools) => {
      pools.substrate.waterG = 10;
    });

    new FixedStepScheduler(pairedWorld, [
      new BradysiaLifecycleSystem(paired, parameters())
    ]).runFor(24 * 3600);

    new FixedStepScheduler(unpairedWorld, [
      new BradysiaLifecycleSystem(unpaired, parameters())
    ]).runFor(24 * 3600);

    new FixedStepScheduler(dryWorld, [
      new BradysiaLifecycleSystem(dryPair, parameters())
    ]).runFor(24 * 3600);

    const pairedEggs = paired.all().filter((x) => x.parentId !== undefined);
    const unpairedEggs = unpaired.all().filter((x) => x.parentId !== undefined);
    const dryEggs = dryPair.all().filter((x) => x.parentId !== undefined);

    expect(pairedEggs).toHaveLength(p("fecundityEggsPerFemale"));
    expect(unpairedEggs).toHaveLength(0);
    expect(dryEggs).toHaveLength(0);
  });

  it("uses root tissue as fallback when fungal food is unavailable", () => {
    const population = createLarvalPopulation();
    const world = createWorld(population, (pools) => {
      pools.linnemannia_biomass = {
        carbonMg: 0,
        nitrogenMg: 0,
        phosphorusMg: 0,
        waterG: 0
      };
    });
    const invariant = new InvariantMonitor(world);
    const rootBefore = world.ledger.getPool("plant_root_tissue").carbonMg;

    new FixedStepScheduler(world, [
      new BradysiaLifecycleSystem(population, parameters())
    ]).runFor(4 * 86400);

    invariant.check(world);
    expect(world.ledger.getPool("plant_root_tissue").carbonMg).toBeLessThan(rootBefore);
    expect(world.ledger.getPool("bradysia_feed_buffer").carbonMg).toBeCloseTo(0, 12);
  });

  it("moves short-lived adult biomass into corpse pool without rescue", () => {
    const population = createAdultPair(true);
    const world = createWorld(population);
    const invariant = new InvariantMonitor(world);

    new FixedStepScheduler(world, [
      new BradysiaLifecycleSystem(
        population,
        parameters({ preOvipositionHours: 1000 })
      )
    ]).runFor(7 * 86400);

    invariant.check(world);
    expect(population.living()).toHaveLength(0);
    expect(world.ledger.getPool("animal_corpses").carbonMg).toBeGreaterThan(0);
    expect(world.ledger.getPool("bradysia_biomass").carbonMg).toBeCloseTo(0, 12);
  });
});

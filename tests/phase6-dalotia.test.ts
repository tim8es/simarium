import { describe, expect, it } from "vitest";
import dalotiaFixture from "../data/experiments/phase6-dalotia.json";
import bradysiaFixture from "../data/experiments/phase5-bradysia.json";
import folsomiaFixture from "../data/experiments/phase3-folsomia.json";
import {
  BradysiaPopulation,
  DalotiaPopulation,
  DalotiaPredatorSystem,
  DeterministicRng,
  FixedStepScheduler,
  FolsomiaPopulation,
  InvariantMonitor,
  MassLedger,
  ScalarGrid3D,
  SpatialHabitat,
  WorldState,
  seedBradysiaLarvae,
  seedDalotiaLarvae,
  seedFolsomiaJuveniles,
  type DalotiaParameters,
  type Material
} from "../packages/sim-core/src/index.ts";

const p = (name: keyof typeof dalotiaFixture.parameters): number =>
  dalotiaFixture.parameters[name].value;
const bp = (name: keyof typeof bradysiaFixture.parameters): number =>
  bradysiaFixture.parameters[name].value;
const fp = (name: keyof typeof folsomiaFixture.parameters): number =>
  folsomiaFixture.parameters[name].value;

function preyPopulations(bradysiaCount = 40, folsomiaCount = 40): {
  bradysia: BradysiaPopulation;
  folsomia: FolsomiaPopulation;
} {
  return {
    bradysia: seedBradysiaLarvae({
      count: bradysiaCount,
      ageDays: 2,
      carbonMg: bp("initialLarvaCarbonMg"),
      reserveCarbonMg: bp("initialReserveCarbonMg"),
      nitrogenPerCarbon: bp("nitrogenPerCarbon"),
      phosphorusPerCarbon: bp("phosphorusPerCarbon"),
      adultBodyWaterG: bp("adultBodyWaterG")
    }),
    folsomia: seedFolsomiaJuveniles({
      count: folsomiaCount,
      ageDays: 12,
      carbonMg: fp("initialJuvenileCarbonMg"),
      reserveCarbonMg: fp("initialReserveCarbonMg"),
      nitrogenPerCarbon: fp("nitrogenPerCarbon"),
      phosphorusPerCarbon: fp("phosphorusPerCarbon"),
      bodyWaterG: fp("adultBodyWaterG")
    })
  };
}

function adultMaterial(): Material {
  return {
    carbonMg: p("adultCarbonTargetMg"),
    nitrogenMg: p("adultCarbonTargetMg") * p("nitrogenPerCarbon"),
    phosphorusMg: p("adultCarbonTargetMg") * p("phosphorusPerCarbon"),
    waterG: p("adultBodyWaterG")
  };
}

function adultPredators(pair = false): DalotiaPopulation {
  const population = new DalotiaPopulation();
  const material = adultMaterial();
  population.create({
    stage: "adult",
    sex: "female",
    ageSeconds: 17 * 86400,
    stageAgeSeconds: 0,
    adultAgeSeconds: 0,
    birthTimeSeconds: -17 * 86400,
    material,
    reserveCarbonMg: material.carbonMg * 0.30,
    starvationSeconds: 0,
    dehydrationSeconds: 0,
    eggsLaid: 0,
    eggAccumulator: 0,
    attackAccumulator: 0,
    hasMated: false
  });
  if (pair) {
    population.create({
      stage: "adult",
      sex: "male",
      ageSeconds: 17 * 86400,
      stageAgeSeconds: 0,
      adultAgeSeconds: 0,
      birthTimeSeconds: -17 * 86400,
      material,
      reserveCarbonMg: material.carbonMg * 0.30,
      starvationSeconds: 0,
      dehydrationSeconds: 0,
      eggsLaid: 0,
      eggAccumulator: 0,
      attackAccumulator: 0,
      hasMated: false
    });
  }
  return population;
}

function createWorld(
  dalotia: DalotiaPopulation,
  prey: { bradysia: BradysiaPopulation; folsomia: FolsomiaPopulation },
  mutate?: (pools: typeof dalotiaFixture.world.initialPools) => void
): WorldState {
  const pools = structuredClone(dalotiaFixture.world.initialPools);
  pools.dalotia_biomass = dalotia.totalLivingMaterial();
  pools.bradysia_biomass = prey.bradysia.totalLivingMaterial();
  pools.folsomia_biomass = prey.folsomia.totalLivingMaterial();
  mutate?.(pools);

  return new WorldState(
    {
      seed: 20260925,
      fixedDtSeconds: dalotiaFixture.world.fixedDtSeconds,
      roomTemperatureC: dalotiaFixture.world.temperatureC
    },
    new MassLedger(pools),
    {
      temperatureC: new ScalarGrid3D(
        2,
        2,
        2,
        dalotiaFixture.world.temperatureC
      )
    },
    new DeterministicRng(20260925)
  );
}

function parameters(
  overrides: Partial<DalotiaParameters> = {}
): DalotiaParameters {
  return {
    biomassPool: "dalotia_biomass",
    feedBufferPool: "dalotia_feed_buffer",
    litterPool: "litter",
    atmospherePool: "atmosphere",
    substratePool: "substrate",
    corpsePool: "animal_corpses",
    bradysiaBiomassPool: "bradysia_biomass",
    folsomiaBiomassPool: "folsomia_biomass",

    referenceTemperatureC: p("referenceTemperatureC"),
    temperatureSigmaC: p("temperatureSigmaC"),
    eggDevelopmentDays: p("eggDevelopmentDays"),
    larvalDevelopmentDays: p("larvalDevelopmentDays"),
    pupalDevelopmentDays: p("pupalDevelopmentDays"),
    femaleAdultLifespanDays: p("femaleAdultLifespanDays"),
    maleAdultLifespanDays: p("maleAdultLifespanDays"),
    femaleProbability: p("femaleProbability"),
    immatureSurvivalProbability: p("immatureSurvivalProbability"),

    lifetimeFecundity: p("lifetimeFecundity"),
    reproductivePeriodDays: p("reproductivePeriodDays"),
    preOvipositionDays: p("preOvipositionDays"),

    maxAdultPreyPerDay: p("maxAdultPreyPerDay"),
    maxLarvalPreyPerDay: p("maxLarvalPreyPerDay"),
    preyHalfSaturationCount: p("preyHalfSaturationCount"),
    captureProbability: p("captureProbability"),
    assimilationEfficiency: p("assimilationEfficiency"),
    reserveTargetFraction: p("reserveTargetFraction"),

    basalMetabolismCarbonMgPerSecond: p("basalMetabolismCarbonMgPerSecond"),
    adultCarbonTargetMg: p("adultCarbonTargetMg"),
    pupationCarbonFractionOfAdult: p("pupationCarbonFractionOfAdult"),
    reproductionReserveFraction: p("reproductionReserveFraction"),
    eggCarbonMg: p("eggCarbonMg"),
    adultBodyWaterG: p("adultBodyWaterG"),

    moistureHalfSaturationWaterG: p("moistureHalfSaturationWaterG"),
    reproductionMoistureThreshold: p("reproductionMoistureThreshold"),
    starvationDeathDays: p("starvationDeathDays"),
    desiccationRatePerSecond: p("desiccationRatePerSecond"),
    hydrationRatePerSecond: p("hydrationRatePerSecond"),
    ...overrides
  };
}

describe("Phase 6 Dalotia coriaria predator", () => {
  it("develops larva -> pupa -> adult with deterministic sex assignment", () => {
    const dalotia = seedDalotiaLarvae({
      count: 6,
      ageDays: 0,
      carbonMg: p("initialLarvaCarbonMg"),
      reserveCarbonMg: p("initialReserveCarbonMg"),
      nitrogenPerCarbon: p("nitrogenPerCarbon"),
      phosphorusPerCarbon: p("phosphorusPerCarbon"),
      adultBodyWaterG: p("adultBodyWaterG")
    });
    const prey = preyPopulations();
    const world = createWorld(dalotia, prey);
    const invariant = new InvariantMonitor(world);

    new FixedStepScheduler(world, [
      new DalotiaPredatorSystem(dalotia, prey, parameters())
    ]).runFor(16 * 86400);

    invariant.check(world);
    const adults = dalotia.living().filter((x) => x.stage === "adult");
    expect(adults.length).toBeGreaterThan(0);
    expect(adults.every((x) => x.sex !== undefined)).toBe(true);
  }, 30_000);

  it("kills concrete prey individuals and transfers their mass into predator/detritus", () => {
    const dalotia = adultPredators(false);
    const prey = preyPopulations(40, 40);
    const world = createWorld(dalotia, prey);
    const invariant = new InvariantMonitor(world);
    const initialPrey =
      prey.bradysia.living().length + prey.folsomia.living().length;
    const predatorCarbonBefore = world.ledger.getPool("dalotia_biomass").carbonMg;

    new FixedStepScheduler(world, [
      new DalotiaPredatorSystem(dalotia, prey, parameters())
    ]).runFor(86400);

    invariant.check(world);
    const remainingPrey =
      prey.bradysia.living().length + prey.folsomia.living().length;
    const predationEvents = dalotia
      .eventLog()
      .filter((event) => event.type === "predation");

    expect(remainingPrey).toBeLessThan(initialPrey);
    expect(predationEvents.length).toBeGreaterThan(0);
    expect(world.ledger.getPool("dalotia_biomass").carbonMg).toBeGreaterThan(
      predatorCarbonBefore
    );
    expect(
      [...prey.bradysia.all(), ...prey.folsomia.all()].some(
        (individual) => !individual.alive
      )
    ).toBe(true);
  });

  it("requires a male and moist substrate for egg production", () => {
    const preyA = preyPopulations();
    const pair = adultPredators(true);
    const pairedWorld = createWorld(pair, preyA);

    const preyB = preyPopulations();
    const loneFemale = adultPredators(false);
    const loneWorld = createWorld(loneFemale, preyB);

    const preyC = preyPopulations();
    const dryPair = adultPredators(true);
    const dryWorld = createWorld(dryPair, preyC, (pools) => {
      pools.substrate.waterG = 10;
    });

    new FixedStepScheduler(pairedWorld, [
      new DalotiaPredatorSystem(pair, preyA, parameters())
    ]).runFor(5 * 86400);

    new FixedStepScheduler(loneWorld, [
      new DalotiaPredatorSystem(loneFemale, preyB, parameters())
    ]).runFor(5 * 86400);

    new FixedStepScheduler(dryWorld, [
      new DalotiaPredatorSystem(dryPair, preyC, parameters())
    ]).runFor(5 * 86400);

    expect(pair.all().filter((x) => x.parentId !== undefined).length).toBeGreaterThan(0);
    expect(loneFemale.all().filter((x) => x.parentId !== undefined)).toHaveLength(0);
    expect(dryPair.all().filter((x) => x.parentId !== undefined)).toHaveLength(0);
  }, 30_000);

  it("dies without prey instead of receiving hidden food or rescue", () => {
    const dalotia = adultPredators(false);
    const prey = preyPopulations(0, 0);
    const world = createWorld(dalotia, prey);
    const invariant = new InvariantMonitor(world);

    for (const predator of dalotia.living()) {
      predator.reserveCarbonMg = 0.000001;
    }

    new FixedStepScheduler(world, [
      new DalotiaPredatorSystem(
        dalotia,
        prey,
        parameters({
          basalMetabolismCarbonMgPerSecond:
            p("basalMetabolismCarbonMgPerSecond") * 10,
          starvationDeathDays: 2
        })
      )
    ]).runFor(8 * 86400);

    invariant.check(world);
    expect(dalotia.living()).toHaveLength(0);
    expect(world.ledger.getPool("animal_corpses").carbonMg).toBeGreaterThan(0);
  });

  it("does not pupate an underweight larva without sufficient prey-derived growth", () => {
    const dalotia = seedDalotiaLarvae({
      count: 4,
      ageDays: 0,
      carbonMg: p("adultCarbonTargetMg") * 0.10,
      reserveCarbonMg: 0,
      nitrogenPerCarbon: p("nitrogenPerCarbon"),
      phosphorusPerCarbon: p("phosphorusPerCarbon"),
      adultBodyWaterG: p("adultBodyWaterG")
    });
    for (const individual of dalotia.living()) {
      individual.stageAgeSeconds = (p("larvalDevelopmentDays") + 1) * 86400;
    }
    const prey = preyPopulations(0, 0);
    const world = createWorld(dalotia, prey);

    new FixedStepScheduler(world, [
      new DalotiaPredatorSystem(dalotia, prey, parameters())
    ]).step(1);

    expect(
      dalotia.living().every((individual) => individual.stage === "larva")
    ).toBe(true);
  });

  it("does not produce eggs from a depleted female until feeding restores reserves", () => {
    const dalotia = adultPredators(true);
    const female = dalotia.living().find((x) => x.sex === "female")!;
    female.reserveCarbonMg = 0;
    female.adultAgeSeconds = (p("preOvipositionDays") + 1) * 86400;

    const prey = preyPopulations(0, 0);
    const world = createWorld(dalotia, prey);

    new FixedStepScheduler(world, [
      new DalotiaPredatorSystem(dalotia, prey, parameters())
    ]).runFor(2 * 86400);

    expect(dalotia.all().filter((x) => x.parentId !== undefined)).toHaveLength(0);
  });

  it("stops hunting when adult energetic reserves are already above the feeding target", () => {
    const dalotia = adultPredators(false);
    const prey = preyPopulations(20, 20);
    const predator = dalotia.living()[0]!;
    predator.reserveCarbonMg = predator.material.carbonMg * 0.50;

    const world = createWorld(dalotia, prey);
    const initialPrey =
      prey.bradysia.living().length + prey.folsomia.living().length;

    new FixedStepScheduler(world, [
      new DalotiaPredatorSystem(
        dalotia,
        prey,
        parameters({ reserveTargetFraction: 0.40 })
      )
    ]).runFor(86400);

    expect(
      dalotia.eventLog().filter((event) => event.type === "predation")
    ).toHaveLength(0);
    expect(
      prey.bradysia.living().length + prey.folsomia.living().length
    ).toBe(initialPrey);
  });


  it("applies documented immature survival before adult emergence", () => {
    const dalotia = seedDalotiaLarvae({
      count: 4,
      ageDays: 0,
      carbonMg: p("initialLarvaCarbonMg"),
      reserveCarbonMg: p("initialReserveCarbonMg"),
      nitrogenPerCarbon: p("nitrogenPerCarbon"),
      phosphorusPerCarbon: p("phosphorusPerCarbon"),
      adultBodyWaterG: p("adultBodyWaterG")
    });
    for (const individual of dalotia.living()) {
      individual.stage = "pupa";
      individual.stageAgeSeconds = (p("pupalDevelopmentDays") + 1) * 86400;
    }
    const prey = preyPopulations();
    const world = createWorld(dalotia, prey);

    new FixedStepScheduler(world, [
      new DalotiaPredatorSystem(
        dalotia,
        prey,
        parameters({ immatureSurvivalProbability: 0 })
      )
    ]).step(1);

    expect(dalotia.living()).toHaveLength(0);
    expect(
      dalotia.eventLog().some(
        (event) =>
          event.type === "death" && event.cause === "developmental_mortality"
      )
    ).toBe(true);
  });

  it("continues reserve-funded oviposition after one local mating encounter", () => {
    const dalotia = adultPredators(true);
    const prey = preyPopulations(100, 100);
    const world = createWorld(dalotia, prey);
    const habitat = new SpatialHabitat(12, 1);
    habitat.set("dalotia_coriaria#1", { x: 0, z: 0, layer: "substrate" });
    habitat.set("dalotia_coriaria#2", { x: 1, z: 0, layer: "substrate" });

    const female = dalotia.get(1);
    female.adultAgeSeconds = (p("preOvipositionDays") + 1) * 86400;
    const system = new DalotiaPredatorSystem(
      dalotia,
      prey,
      parameters(),
      habitat,
      1
    );
    const scheduler = new FixedStepScheduler(world, [system]);

    scheduler.runFor(86400);
    const afterMating = female.eggsLaid;
    expect(female.hasMated).toBe(true);
    expect(afterMating).toBeGreaterThan(0);

    habitat.set("dalotia_coriaria#2", { x: 10, z: 0, layer: "substrate" });
    scheduler.runFor(2 * 86400);

    expect(female.eggsLaid).toBeGreaterThan(afterMating);
  }, 30_000);

  it("requires a local adult male for reproduction when spatial encounters are enabled", () => {
    const dalotia = adultPredators(true);
    const prey = preyPopulations(60, 60);
    const world = createWorld(dalotia, prey);
    const habitat = new SpatialHabitat(12, 1);
    habitat.set("dalotia_coriaria#1", { x: 0, z: 0, layer: "substrate" });
    habitat.set("dalotia_coriaria#2", { x: 8, z: 0, layer: "substrate" });

    const system = new DalotiaPredatorSystem(
      dalotia,
      prey,
      parameters(),
      habitat,
      1
    );
    const scheduler = new FixedStepScheduler(world, [system]);

    scheduler.runFor(3 * 86400);
    expect(dalotia.all().filter((x) => x.parentId !== undefined)).toHaveLength(0);

    habitat.set("dalotia_coriaria#2", { x: 1, z: 0, layer: "substrate" });
    scheduler.runFor(2 * 86400);
    expect(dalotia.all().filter((x) => x.parentId !== undefined).length).toBeGreaterThan(0);
  }, 30_000);

});

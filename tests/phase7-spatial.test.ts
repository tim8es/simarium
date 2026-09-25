import { describe, expect, it } from "vitest";
import { createIntegratedEcosystem } from "../tools/ecosystem-factory.ts";
import bradysiaFixture from "../data/experiments/phase5-bradysia.json";
import dalotiaFixture from "../data/experiments/phase6-dalotia.json";
import folsomiaFixture from "../data/experiments/phase3-folsomia.json";
import {
  BradysiaPopulation,
  DalotiaPopulation,
  DalotiaPredatorSystem,
  DeterministicRng,
  FixedStepScheduler,
  MassLedger,
  ScalarGrid3D,
  SpatialHabitat,
  WorldState,
  seedBradysiaLarvae,
  seedFolsomiaJuveniles,
  type DalotiaParameters,
  type Material
} from "../packages/sim-core/src/index.ts";

const d = (name: keyof typeof dalotiaFixture.parameters) =>
  dalotiaFixture.parameters[name].value;
const b = (name: keyof typeof bradysiaFixture.parameters) =>
  bradysiaFixture.parameters[name].value;
const f = (name: keyof typeof folsomiaFixture.parameters) =>
  folsomiaFixture.parameters[name].value;

function parameters(): DalotiaParameters {
  return {
    biomassPool: "dalotia_biomass",
    feedBufferPool: "dalotia_feed_buffer",
    litterPool: "litter",
    atmospherePool: "atmosphere",
    substratePool: "substrate",
    corpsePool: "animal_corpses",
    bradysiaBiomassPool: "bradysia_biomass",
    folsomiaBiomassPool: "folsomia_biomass",
    referenceTemperatureC: d("referenceTemperatureC"),
    temperatureSigmaC: d("temperatureSigmaC"),
    eggDevelopmentDays: d("eggDevelopmentDays"),
    larvalDevelopmentDays: d("larvalDevelopmentDays"),
    pupalDevelopmentDays: d("pupalDevelopmentDays"),
    femaleAdultLifespanDays: d("femaleAdultLifespanDays"),
    maleAdultLifespanDays: d("maleAdultLifespanDays"),
    femaleProbability: d("femaleProbability"),
    immatureSurvivalProbability: d("immatureSurvivalProbability"),
    lifetimeFecundity: d("lifetimeFecundity"),
    reproductivePeriodDays: d("reproductivePeriodDays"),
    preOvipositionDays: d("preOvipositionDays"),
    maxAdultPreyPerDay: 100,
    maxLarvalPreyPerDay: d("maxLarvalPreyPerDay"),
    preyHalfSaturationCount: 1,
    captureProbability: 1,
    assimilationEfficiency: d("assimilationEfficiency"),
    reserveTargetFraction: d("reserveTargetFraction"),
    basalMetabolismCarbonMgPerSecond: d("basalMetabolismCarbonMgPerSecond"),
    adultCarbonTargetMg: d("adultCarbonTargetMg"),
    pupationCarbonFractionOfAdult: d("pupationCarbonFractionOfAdult"),
    reproductionReserveFraction: d("reproductionReserveFraction"),
    eggCarbonMg: d("eggCarbonMg"),
    adultBodyWaterG: d("adultBodyWaterG"),
    moistureHalfSaturationWaterG: d("moistureHalfSaturationWaterG"),
    reproductionMoistureThreshold: d("reproductionMoistureThreshold"),
    starvationDeathDays: d("starvationDeathDays"),
    desiccationRatePerSecond: d("desiccationRatePerSecond"),
    hydrationRatePerSecond: d("hydrationRatePerSecond")
  };
}

describe("Phase 7 local encounter index", () => {
  it("prevents global predation and allows predation after prey enters a local cell", () => {
    const bradysia = seedBradysiaLarvae({
      count: 1,
      ageDays: 2,
      carbonMg: b("initialLarvaCarbonMg"),
      reserveCarbonMg: b("initialReserveCarbonMg"),
      nitrogenPerCarbon: b("nitrogenPerCarbon"),
      phosphorusPerCarbon: b("phosphorusPerCarbon"),
      adultBodyWaterG: b("adultBodyWaterG")
    });
    const folsomia = seedFolsomiaJuveniles({
      count: 0,
      ageDays: 12,
      carbonMg: f("initialJuvenileCarbonMg"),
      reserveCarbonMg: f("initialReserveCarbonMg"),
      nitrogenPerCarbon: f("nitrogenPerCarbon"),
      phosphorusPerCarbon: f("phosphorusPerCarbon"),
      bodyWaterG: f("adultBodyWaterG")
    });

    const dalotia = new DalotiaPopulation();
    const adult: Material = {
      carbonMg: d("adultCarbonTargetMg"),
      nitrogenMg: d("adultCarbonTargetMg") * d("nitrogenPerCarbon"),
      phosphorusMg: d("adultCarbonTargetMg") * d("phosphorusPerCarbon"),
      waterG: d("adultBodyWaterG")
    };
    dalotia.create({
      stage: "adult",
      sex: "male",
      ageSeconds: 20 * 86400,
      stageAgeSeconds: 0,
      adultAgeSeconds: 0,
      birthTimeSeconds: -20 * 86400,
      material: adult,
      reserveCarbonMg: adult.carbonMg * 0.3,
      starvationSeconds: 0,
      dehydrationSeconds: 0,
      eggsLaid: 0,
      eggAccumulator: 0,
      attackAccumulator: 0
    });

    const pools = structuredClone(dalotiaFixture.world.initialPools);
    pools.dalotia_biomass = dalotia.totalLivingMaterial();
    pools.bradysia_biomass = bradysia.totalLivingMaterial();
    pools.folsomia_biomass = folsomia.totalLivingMaterial();

    const world = new WorldState(
      { seed: 1, fixedDtSeconds: 3600, roomTemperatureC: 26 },
      new MassLedger(pools),
      { temperatureC: new ScalarGrid3D(1, 1, 1, 26) },
      new DeterministicRng(1)
    );

    const habitat = new SpatialHabitat(10, 1);
    habitat.set("dalotia_coriaria#1", { x: 0, z: 0, layer: "substrate" });
    habitat.set("bradysia_impatiens#1", { x: 5, z: 0, layer: "substrate" });

    const system = new DalotiaPredatorSystem(
      dalotia,
      { bradysia, folsomia },
      parameters(),
      habitat
    );
    const scheduler = new FixedStepScheduler(world, [system]);

    scheduler.runFor(12 * 3600);
    expect(bradysia.living()).toHaveLength(1);

    habitat.set("bradysia_impatiens#1", { x: 0, z: 0, layer: "substrate" });
    scheduler.runFor(12 * 3600);
    expect(bradysia.living()).toHaveLength(0);
  });
  it("uses centimeter-scale integrated habitat cells rather than decimeter-scale encounter cells", () => {
    const eco = createIntegratedEcosystem(7701);

    expect(eco.habitat.width).toBe(60);
    expect(eco.habitat.depth).toBe(30);
  });


  it("does not treat opposite terrarium walls as adjacent", () => {
    const habitat = new SpatialHabitat(60, 30);
    habitat.set("predator", { x: 0, z: 10, layer: "substrate" });
    habitat.set("prey", { x: 59, z: 10, layer: "substrate" });

    expect(habitat.isLocal("predator", "prey", 1)).toBe(false);
  });


  it("indexes only nearby entity refs on the bounded habitat", () => {
    const habitat = new SpatialHabitat(60, 30);
    habitat.set("predator", { x: 10, z: 10, layer: "substrate" });
    habitat.set("near-a", { x: 11, z: 10, layer: "substrate" });
    habitat.set("near-b", { x: 9, z: 9, layer: "substrate" });
    habitat.set("far", { x: 40, z: 20, layer: "substrate" });
    habitat.set("air", { x: 10, z: 10, layer: "air" });

    expect(new Set(habitat.nearbyRefs("predator", 1))).toEqual(
      new Set(["predator", "near-a", "near-b"])
    );

    habitat.remove("near-a");
    expect(habitat.nearbyRefs("predator", 1)).not.toContain("near-a");
  });


});

import { describe, expect, it } from "vitest";
import experiment from "../data/experiments/phase2-multiplant.json";
import {
  DeterministicRng,
  FixedStepScheduler,
  InvariantMonitor,
  MassLedger,
  MicrobialDecomposerSystem,
  PlantPhysiologySystem,
  ScalarGrid3D,
  WorldState
} from "../packages/sim-core/src/index.ts";

type PlantId = keyof typeof experiment.plants;

const plantPrefixes: Record<PlantId, string> = {
  fittonia_albivenis: "fittonia",
  peperomia_caperata: "peperomia",
  pilea_depressa: "pilea"
};

function value(entry: { value: number }): number {
  return entry.value;
}

function createWorld(initialPools = structuredClone(experiment.initialPools)): WorldState {
  return new WorldState(
    {
      seed: 20260925,
      fixedDtSeconds: 300,
      roomTemperatureC: 22.5
    },
    new MassLedger(initialPools),
    { temperatureC: new ScalarGrid3D(2, 2, 2, 22.5) },
    new DeterministicRng(20260925)
  );
}

function plantSystem(id: PlantId, lightMultiplier = 1): PlantPhysiologySystem {
  const p = experiment.plants[id];
  const prefix = plantPrefixes[id];

  return new PlantPhysiologySystem({
    atmospherePool: "atmosphere",
    reservePool: `${prefix}_reserve`,
    structuralPool: `${prefix}_structural`,
    nutrientPool: "available_nutrients",
    litterPool: "litter",
    substratePool: "substrate",
    mobileWaterPool: `${prefix}_water`,

    relativeLight: value(p.relativeLight) * lightMultiplier,
    lightHalfSaturation: value(p.lightHalfSaturation),
    temperatureOptimumC: value(p.temperatureOptimumC),
    temperatureSigmaC: value(p.temperatureSigmaC),

    maxPhotosynthesisCarbonMgPerSecond: value(p.maxPhotosynthesisCarbonMgPerSecond),
    structuralGrowthRatePerSecond: value(p.structuralGrowthRatePerSecond),
    nitrogenMgPerCarbonMg: value(experiment.shared.nitrogenMgPerCarbonMg),
    phosphorusMgPerCarbonMg: value(experiment.shared.phosphorusMgPerCarbonMg),
    senescenceRatePerSecond: value(p.senescenceRatePerSecond),

    targetWaterGPerStructuralCarbonMg: value(p.targetWaterGPerStructuralCarbonMg),
    rootWaterUptakeRatePerSecond: value(p.rootWaterUptakeRatePerSecond),
    transpirationRatePerSecond: value(p.transpirationRatePerSecond),
    waterStressHalfSaturation: value(p.waterStressHalfSaturation),
    maintenanceRespirationCarbonPerStructuralCarbonPerSecond: value(
      p.maintenanceRespirationCarbonPerStructuralCarbonPerSecond
    )
  });
}

function decomposerSystem(rateMultiplier = 1): MicrobialDecomposerSystem {
  const p = experiment.decomposer;
  return new MicrobialDecomposerSystem({
    litterPool: "litter",
    bufferPool: "decomposition_buffer",
    fungusPool: "linnemannia_biomass",
    bacteriaPool: "bacillus_biomass",
    atmospherePool: "atmosphere",
    nutrientPool: "available_nutrients",
    substratePool: "substrate",

    decompositionRatePerSecond: value(p.decompositionRatePerSecond) * rateMultiplier,
    carbonUseEfficiency: value(p.carbonUseEfficiency),
    fungalShare: value(p.fungalShare),
    microbialTurnoverRatePerSecond: value(p.microbialTurnoverRatePerSecond),

    moisturePool: "substrate",
    moistureHalfSaturationWaterG: value(p.moistureHalfSaturationWaterG),
    temperatureOptimumC: value(p.temperatureOptimumC),
    temperatureSigmaC: value(p.temperatureSigmaC)
  });
}

function combinedPlantCarbon(world: WorldState, prefix: string): number {
  return (
    world.ledger.getPool(`${prefix}_reserve`).carbonMg +
    world.ledger.getPool(`${prefix}_structural`).carbonMg
  );
}

describe("Phase 2 multi-plant physiology", () => {
  it("runs all three real plant species with water uptake, transpiration, respiration and senescence", () => {
    const world = createWorld();
    const invariant = new InvariantMonitor(world);
    const before = Object.fromEntries(
      Object.values(plantPrefixes).map((prefix) => [
        prefix,
        combinedPlantCarbon(world, prefix)
      ])
    );

    const scheduler = new FixedStepScheduler(world, [
      decomposerSystem(),
      plantSystem("fittonia_albivenis"),
      plantSystem("peperomia_caperata"),
      plantSystem("pilea_depressa")
    ]);

    scheduler.runFor(30 * 86400);
    invariant.check(world);

    for (const prefix of Object.values(plantPrefixes)) {
      expect(combinedPlantCarbon(world, prefix), prefix).toBeGreaterThan(before[prefix]!);
      expect(world.ledger.getPool(`${prefix}_water`).waterG, prefix).toBeGreaterThan(0);
    }

    expect(world.ledger.getPool("atmosphere").waterG).toBeGreaterThan(
      experiment.initialPools.atmosphere.waterG
    );
    expect(world.ledger.getPool("litter").carbonMg).toBeGreaterThan(0);
  }, 30_000);

  it("makes Fittonia carbon gain lower under severe water shortage", () => {
    const wet = createWorld();
    const dryPools = structuredClone(experiment.initialPools);
    dryPools.substrate.waterG = 0;
    dryPools.surface_water.waterG = 0;
    dryPools.fittonia_water.waterG = 0.01;
    const dry = createWorld(dryPools);

    const wetScheduler = new FixedStepScheduler(wet, [plantSystem("fittonia_albivenis")]);
    const dryScheduler = new FixedStepScheduler(dry, [plantSystem("fittonia_albivenis")]);

    wetScheduler.runFor(10 * 86400);
    dryScheduler.runFor(10 * 86400);

    expect(combinedPlantCarbon(wet, "fittonia")).toBeGreaterThan(
      combinedPlantCarbon(dry, "fittonia")
    );
  });

  it("slows microbial litter processing when substrate water is scarce", () => {
    const wet = createWorld();
    const dryPools = structuredClone(experiment.initialPools);
    dryPools.substrate.waterG = 10;
    const dry = createWorld(dryPools);

    new FixedStepScheduler(wet, [decomposerSystem()]).runFor(10 * 86400);
    new FixedStepScheduler(dry, [decomposerSystem()]).runFor(10 * 86400);

    expect(wet.ledger.getPool("litter").carbonMg).toBeLessThan(
      dry.ledger.getPool("litter").carbonMg
    );
  });

  it("preserves invariants across a bounded light/decomposition sensitivity grid", () => {
    const multipliers = [0.5, 1, 1.5];

    for (const light of multipliers) {
      for (const decomposition of multipliers) {
        const world = createWorld();
        const invariant = new InvariantMonitor(world);
        const scheduler = new FixedStepScheduler(world, [
          decomposerSystem(decomposition),
          plantSystem("fittonia_albivenis", light),
          plantSystem("peperomia_caperata", light),
          plantSystem("pilea_depressa", light)
        ]);

        scheduler.runFor(45 * 86400);
        expect(() => invariant.check(world)).not.toThrow();
        expect(world.ledger.getPool("litter").carbonMg).toBeGreaterThanOrEqual(0);
      }
    }
  }, 30_000);
});

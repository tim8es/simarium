import { describe, expect, it } from "vitest";
import experiment from "../data/experiments/phase2-producer-loop.json";
import {
  DeterministicRng,
  FixedStepScheduler,
  InvariantMonitor,
  MassLedger,
  MassTracer,
  MicrobialDecomposerSystem,
  PlantProducerSystem,
  ScalarGrid3D,
  WorldState
} from "../packages/sim-core/src/index.ts";

const value = (name: keyof typeof experiment.parameters): number =>
  experiment.parameters[name].value;

function createExperimentWorld(): WorldState {
  const temperature = new ScalarGrid3D(2, 2, 2, value("temperatureOptimumC"));
  return new WorldState(
    {
      seed: 20260925,
      fixedDtSeconds: 60,
      roomTemperatureC: value("temperatureOptimumC")
    },
    new MassLedger(experiment.initialPools),
    { temperatureC: temperature },
    new DeterministicRng(20260925)
  );
}

describe("Phase 2 producer/decomposer vertical slice", () => {
  it("returns nitrogen from tagged litter into new Fittonia structural tissue", () => {
    const world = createExperimentWorld();
    const invariant = new InvariantMonitor(world);
    const tracer = new MassTracer();
    tracer.attach(world.ledger);

    tracer.seed(
      "old_leaf_n",
      "litter",
      { carbonMg: 0, nitrogenMg: 1, phosphorusMg: 0, waterG: 0 },
      world.ledger
    );
    const initialTracer = tracer.totals("old_leaf_n");

    const decomposer = new MicrobialDecomposerSystem({
      litterPool: "litter",
      bufferPool: "decomposition_buffer",
      fungusPool: "linnemannia_biomass",
      bacteriaPool: "bacillus_biomass",
      atmospherePool: "atmosphere",
      nutrientPool: "available_nutrients",
      substratePool: "substrate",
      decompositionRatePerSecond: value("decompositionRatePerSecond"),
      carbonUseEfficiency: value("carbonUseEfficiency"),
      fungalShare: value("fungalShare"),
      microbialTurnoverRatePerSecond: value("microbialTurnoverRatePerSecond")
    });

    const producer = new PlantProducerSystem({
      atmospherePool: "atmosphere",
      reservePool: "fittonia_reserve",
      structuralPool: "fittonia_structural",
      nutrientPool: "available_nutrients",
      litterPool: "litter",
      relativeLight: value("relativeLight"),
      lightHalfSaturation: value("lightHalfSaturation"),
      temperatureOptimumC: value("temperatureOptimumC"),
      temperatureSigmaC: value("temperatureSigmaC"),
      maxPhotosynthesisCarbonMgPerSecond: value("maxPhotosynthesisCarbonMgPerSecond"),
      structuralGrowthRatePerSecond: value("structuralGrowthRatePerSecond"),
      nitrogenMgPerCarbonMg: value("nitrogenMgPerCarbonMg"),
      phosphorusMgPerCarbonMg: value("phosphorusMgPerCarbonMg"),
      senescenceRatePerSecond: value("senescenceRatePerSecond")
    });

    const scheduler = new FixedStepScheduler(world, [decomposer, producer]);
    scheduler.runFor(60 * 86400);
    invariant.check(world);

    const plantTracer = tracer.get("old_leaf_n", "fittonia_structural");
    expect(plantTracer.nitrogenMg).toBeGreaterThan(0);
    expect(tracer.totals("old_leaf_n").nitrogenMg).toBeCloseTo(
      initialTracer.nitrogenMg,
      10
    );
    expect(world.ledger.getPool("decomposition_buffer").carbonMg).toBeCloseTo(0, 10);
    expect(world.ledger.getPool("decomposition_buffer").nitrogenMg).toBeCloseTo(0, 10);
    expect(world.ledger.getPool("decomposition_buffer").phosphorusMg).toBeCloseTo(0, 10);
  }, 30_000);
});

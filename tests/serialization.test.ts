import { describe, expect, it } from "vitest";
import {
  FixedStepScheduler,
  TemperatureBoundarySystem,
  TemperatureDiffusionSystem,
  WaterCycleSystem,
  createPhase1World,
  deserializeWorld,
  serializeWorld
} from "../packages/sim-core/src/index.ts";

describe("world serialization", () => {
  it("round-trips all phase-1 state exactly", () => {
    const world = createPhase1World({ seed: 99, fixedDtSeconds: 60 });
    const scheduler = new FixedStepScheduler(world, [
      new TemperatureBoundarySystem(0.00001),
      new TemperatureDiffusionSystem(0.0005),
      new WaterCycleSystem({
        infiltrationPerSecond: 0.00002,
        evaporationPerSecond: 0.000005,
        condensationPerSecond: 0.000002
      })
    ]);

    scheduler.step(100);
    world.rng.nextUint32();
    world.rng.nextUint32();

    const serialized = serializeWorld(world);
    const restored = deserializeWorld(serialized);

    expect(serializeWorld(restored)).toBe(serialized);
  });
});

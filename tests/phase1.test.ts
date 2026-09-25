import { describe, expect, it } from "vitest";
import {
  FixedStepScheduler,
  InvariantMonitor,
  WaterCycleSystem,
  createPhase1World,
  serializeWorld
} from "../packages/sim-core/src/index.ts";

function waterSystem(): WaterCycleSystem {
  return new WaterCycleSystem({
    infiltrationPerSecond: 0.00002,
    evaporationPerSecond: 0.000005,
    condensationPerSecond: 0.000002
  });
}

describe("Phase 1 headless kernel", () => {
  it("is deterministic for the same seed and initial state", () => {
    const run = (): string => {
      const world = createPhase1World({ seed: 123, fixedDtSeconds: 60 });
      const scheduler = new FixedStepScheduler(world, [waterSystem()]);
      scheduler.step(10_000);
      return serializeWorld(world);
    };

    expect(run()).toBe(run());
  });

  it("accounts for explicit material boundary flux", () => {
    const world = createPhase1World();
    const monitor = new InvariantMonitor(world);

    world.ledger.applyBoundaryFlux("atmosphere", {
      carbonMg: 10,
      nitrogenMg: 0,
      phosphorusMg: 0,
      waterG: -1
    });

    expect(() => monitor.check(world)).not.toThrow();
  });

  it("runs 365 virtual days without material drift", () => {
    const world = createPhase1World({ seed: 11, fixedDtSeconds: 60 });
    const scheduler = new FixedStepScheduler(world, [waterSystem()]);
    const monitor = new InvariantMonitor(world);

    const steps = (365 * 86400) / world.config.fixedDtSeconds;
    const chunk = 25_000;
    let remaining = steps;

    while (remaining > 0) {
      const count = Math.min(chunk, remaining);
      scheduler.step(count);
      monitor.check(world);
      remaining -= count;
    }

    expect(world.timeSeconds).toBe(365 * 86400);
    expect(world.tick).toBe(steps);
    expect(() => monitor.check(world)).not.toThrow();
  }, 30_000);
});

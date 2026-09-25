import type { SimSystem } from "./systems.js";
import type { WorldState } from "./world.js";

export class FixedStepScheduler {
  constructor(
    readonly world: WorldState,
    readonly systems: readonly SimSystem[]
  ) {
    if (!Number.isFinite(world.config.fixedDtSeconds) || world.config.fixedDtSeconds <= 0) {
      throw new Error("fixedDtSeconds must be positive");
    }
  }

  step(count = 1): void {
    if (!Number.isInteger(count) || count < 0) {
      throw new Error("step count must be a non-negative integer");
    }

    const dt = this.world.config.fixedDtSeconds;
    for (let i = 0; i < count; i++) {
      for (const system of this.systems) {
        system.step(this.world, dt);
      }
      this.world.timeSeconds += dt;
      this.world.tick += 1;
    }
  }

  runFor(durationSeconds: number): void {
    const steps = durationSeconds / this.world.config.fixedDtSeconds;
    if (!Number.isInteger(steps)) {
      throw new Error("durationSeconds must be an exact multiple of fixedDtSeconds");
    }
    this.step(steps);
  }
}

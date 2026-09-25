import type { Material } from "./material.js";
import type { WorldState } from "./world.js";

export interface SimSystem {
  readonly name: string;
  step(world: WorldState, dtSeconds: number): void;
}

function waterOnly(waterG: number): Material {
  return { carbonMg: 0, nitrogenMg: 0, phosphorusMg: 0, waterG };
}

function firstOrderAmount(source: number, ratePerSecond: number, dtSeconds: number): number {
  if (ratePerSecond <= 0 || source <= 0) return 0;
  return source * (1 - Math.exp(-ratePerSecond * dtSeconds));
}

export interface WaterCycleRates {
  infiltrationPerSecond: number;
  evaporationPerSecond: number;
  condensationPerSecond: number;
}

export class WaterCycleSystem implements SimSystem {
  readonly name = "water-cycle";

  constructor(private readonly rates: WaterCycleRates) {
    for (const [name, value] of Object.entries(rates)) {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`${name} must be finite and non-negative`);
      }
    }
  }

  step(world: WorldState, dtSeconds: number): void {
    const surfaceBefore = world.ledger.getPool("surface_water").waterG;
    const infiltration = firstOrderAmount(
      surfaceBefore,
      this.rates.infiltrationPerSecond,
      dtSeconds
    );
    if (infiltration > 0) {
      world.ledger.transfer("surface_water", "substrate", waterOnly(infiltration));
    }

    const surfaceAfterInfiltration = world.ledger.getPool("surface_water").waterG;
    const evaporation = firstOrderAmount(
      surfaceAfterInfiltration,
      this.rates.evaporationPerSecond,
      dtSeconds
    );
    if (evaporation > 0) {
      world.ledger.transfer("surface_water", "atmosphere", waterOnly(evaporation));
    }

    const atmospheric = world.ledger.getPool("atmosphere").waterG;
    const condensation = firstOrderAmount(
      atmospheric,
      this.rates.condensationPerSecond,
      dtSeconds
    );
    if (condensation > 0) {
      world.ledger.transfer("atmosphere", "surface_water", waterOnly(condensation));
    }
  }
}

export class TemperatureDiffusionSystem implements SimSystem {
  readonly name = "temperature-diffusion";

  constructor(private readonly diffusivityPerSecond: number) {
    if (!Number.isFinite(diffusivityPerSecond) || diffusivityPerSecond < 0) {
      throw new Error("diffusivityPerSecond must be finite and non-negative");
    }
  }

  step(world: WorldState, dtSeconds: number): void {
    world.environment.temperatureC.diffuse(this.diffusivityPerSecond * dtSeconds);
  }
}

export class TemperatureBoundarySystem implements SimSystem {
  readonly name = "temperature-boundary";

  constructor(private readonly relaxationPerSecond: number) {
    if (!Number.isFinite(relaxationPerSecond) || relaxationPerSecond < 0) {
      throw new Error("relaxationPerSecond must be finite and non-negative");
    }
  }

  step(world: WorldState, dtSeconds: number): void {
    const fraction = 1 - Math.exp(-this.relaxationPerSecond * dtSeconds);
    world.environment.temperatureC.relaxBoundaryFaces(
      world.config.roomTemperatureC,
      fraction
    );
  }
}

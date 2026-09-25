import {
  MATERIAL_KEYS,
  addMaterial,
  subtractMaterial,
  type Material
} from "./material.js";
import type { WorldState } from "./world.js";

export interface InvariantOptions {
  absoluteTolerance?: number;
  relativeTolerance?: number;
}

function toleranceFor(expected: number, options: Required<InvariantOptions>): number {
  return options.absoluteTolerance + Math.abs(expected) * options.relativeTolerance;
}

export class InvariantMonitor {
  private readonly baselineTotals: Material;
  private readonly baselineBoundaryFlux: Material;
  private readonly options: Required<InvariantOptions>;

  constructor(world: WorldState, options: InvariantOptions = {}) {
    this.baselineTotals = world.ledger.totals();
    this.baselineBoundaryFlux = world.ledger.cumulativeBoundaryFlux();
    this.options = {
      absoluteTolerance: options.absoluteTolerance ?? 1e-8,
      relativeTolerance: options.relativeTolerance ?? 1e-10
    };
  }

  check(world: WorldState): void {
    world.ledger.assertValid();
    world.environment.temperatureC.assertFinite();

    const boundarySinceBaseline = subtractMaterial(
      world.ledger.cumulativeBoundaryFlux(),
      this.baselineBoundaryFlux
    );
    const expected = addMaterial(this.baselineTotals, boundarySinceBaseline);
    const actual = world.ledger.totals();

    for (const key of MATERIAL_KEYS) {
      const residual = actual[key] - expected[key];
      const tolerance = toleranceFor(expected[key], this.options);
      if (Math.abs(residual) > tolerance) {
        throw new Error(
          `Invariant failed for ${key}: actual=${actual[key]}, expected=${expected[key]}, residual=${residual}, tolerance=${tolerance}`
        );
      }
    }
  }
}

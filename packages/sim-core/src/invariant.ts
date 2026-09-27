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

export interface InvariantResidual {
  actual: number;
  expected: number;
  residual: number;
  tolerance: number;
}

export type InvariantReport = Record<
  "carbonMg" | "nitrogenMg" | "phosphorusMg" | "waterG",
  InvariantResidual
>;

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

  report(world: WorldState): InvariantReport {
    const boundarySinceBaseline = subtractMaterial(
      world.ledger.cumulativeBoundaryFlux(),
      this.baselineBoundaryFlux
    );
    const expected = addMaterial(this.baselineTotals, boundarySinceBaseline);
    const actual = world.ledger.totals();
    const report = {} as InvariantReport;
    for (const key of MATERIAL_KEYS) {
      const residual = actual[key] - expected[key];
      report[key] = {
        actual: actual[key],
        expected: expected[key],
        residual,
        tolerance: toleranceFor(expected[key], this.options)
      };
    }
    return report;
  }

  check(world: WorldState): void {
    world.ledger.assertValid();
    world.environment.temperatureC.assertFinite();

    const report = this.report(world);
    for (const key of MATERIAL_KEYS) {
      const entry = report[key];
      if (Math.abs(entry.residual) > entry.tolerance) {
        throw new Error(
          `Invariant failed for ${key}: actual=${entry.actual}, expected=${entry.expected}, residual=${entry.residual}, tolerance=${entry.tolerance}`
        );
      }
    }
  }
}

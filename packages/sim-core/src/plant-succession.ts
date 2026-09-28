import { scaleMaterial, type Material, zeroMaterial } from "./material.js";
import type { PlantRametPopulation } from "./plant-lineage.js";
import type { SimSystem } from "./systems.js";
import type { WorldState } from "./world.js";

const DAY_SECONDS = 86_400;

export interface PlantPropaguleBankParameters {
  propagulePool: string;
  structuralPool: string;
  reservePool: string;
  waterPool: string;
  substratePool: string;
  emergenceDays: readonly number[];
  minimumSubstrateWaterG: number;
  structuralCarbonFraction: number;
}

function nonZero(material: Material): boolean {
  return (
    material.carbonMg > 0 ||
    material.nitrogenMg > 0 ||
    material.phosphorusMg > 0 ||
    material.waterG > 0
  );
}

/**
 * Material-conserving delayed plant establishment.
 * "New" plants may only appear from biomass/water already present in the
 * explicit propagule pool at world creation.
 */
export class PlantPropaguleBankSystem implements SimSystem {
  readonly name = "plant-propagule-bank";
  private nextEmergence = 0;

  constructor(
    readonly population: PlantRametPopulation,
    private readonly p: PlantPropaguleBankParameters
  ) {
    if (p.emergenceDays.length === 0) {
      throw new Error("Plant propagule bank needs at least one emergence day");
    }
    if (p.emergenceDays.some((day) => !Number.isFinite(day) || day < 0)) {
      throw new Error("Plant propagule emergence days must be finite and non-negative");
    }
    if (p.structuralCarbonFraction <= 0 || p.structuralCarbonFraction >= 1) {
      throw new Error("structuralCarbonFraction must be in (0,1)");
    }
  }

  step(world: WorldState, _dtSeconds: number): void {
    while (
      this.nextEmergence < this.p.emergenceDays.length &&
      world.timeSeconds >= this.p.emergenceDays[this.nextEmergence]! * DAY_SECONDS
    ) {
      if (
        world.ledger.getPool(this.p.substratePool).waterG <
        this.p.minimumSubstrateWaterG
      ) {
        return;
      }
      this.germinate(world);
      this.nextEmergence++;
    }
  }

  private germinate(world: WorldState): void {
    const bank = world.ledger.getPool(this.p.propagulePool);
    if (!nonZero(bank)) return;

    const remainingPulses = this.p.emergenceDays.length - this.nextEmergence;
    const allocation = scaleMaterial(bank, 1 / Math.max(1, remainingPulses));
    const structural: Material = {
      carbonMg: allocation.carbonMg * this.p.structuralCarbonFraction,
      nitrogenMg: allocation.nitrogenMg,
      phosphorusMg: allocation.phosphorusMg,
      waterG: 0
    };
    const reserve: Material = {
      ...zeroMaterial(),
      carbonMg: allocation.carbonMg - structural.carbonMg
    };
    const water: Material = {
      ...zeroMaterial(),
      waterG: allocation.waterG
    };

    const existingStructuralC =
      world.ledger.getPool(this.p.structuralPool).carbonMg;

    if (nonZero(structural)) {
      world.ledger.transfer(this.p.propagulePool, this.p.structuralPool, structural);
    }
    if (nonZero(reserve)) {
      world.ledger.transfer(this.p.propagulePool, this.p.reservePool, reserve);
    }
    if (nonZero(water)) {
      world.ledger.transfer(this.p.propagulePool, this.p.waterPool, water);
    }

    const totalStructuralC =
      world.ledger.getPool(this.p.structuralPool).carbonMg;
    const newStructuralC = Math.max(0, totalStructuralC - existingStructuralC);
    const living = this.population.living();
    const newShare =
      totalStructuralC > 0
        ? Math.max(1e-9, Math.min(1, newStructuralC / totalStructuralC))
        : 1;

    for (const ramet of living) ramet.share *= 1 - newShare;
    this.population.create({
      birthTimeSeconds: world.timeSeconds,
      ageSeconds: 0,
      share: living.length === 0 ? 1 : newShare,
      lastCloneSeconds: world.timeSeconds
    });
    this.population.normalizeShares();
    this.population.assertShares();
  }
}

import { scaleMaterial } from "./material.js";
import type { SimSystem } from "./systems.js";
import type { WorldState } from "./world.js";

export interface PlantRamet {
  id: number;
  parentId?: number;
  alive: boolean;
  birthTimeSeconds: number;
  ageSeconds: number;
  share: number;
  lastCloneSeconds: number;
  offspringCount: number;
}

export interface PlantRametRecord {
  id: number;
  parentId?: number;
  birthTimeSeconds: number;
  deathTimeSeconds?: number;
  offspringIds: number[];
}

export type PlantRametEvent =
  | { type: "birth"; timeSeconds: number; id: number; parentId?: number }
  | { type: "clone"; timeSeconds: number; parentId: number; offspringId: number }
  | { type: "death"; timeSeconds: number; id: number };

export class PlantRametPopulation {
  private nextId = 1;
  private readonly ramets: PlantRamet[] = [];
  private readonly records = new Map<number, PlantRametRecord>();
  private readonly events: PlantRametEvent[] = [];

  create(input: {
    parentId?: number;
    birthTimeSeconds: number;
    ageSeconds: number;
    share: number;
    lastCloneSeconds?: number;
  }): number {
    if (!Number.isFinite(input.share) || input.share < 0) {
      throw new Error("Ramet share must be finite and non-negative");
    }
    const id = this.nextId++;
    const ramet: PlantRamet = {
      id,
      alive: true,
      birthTimeSeconds: input.birthTimeSeconds,
      ageSeconds: input.ageSeconds,
      share: input.share,
      lastCloneSeconds:
        input.lastCloneSeconds ?? Number.NEGATIVE_INFINITY,
      offspringCount: 0
    };
    if (input.parentId !== undefined) ramet.parentId = input.parentId;
    this.ramets.push(ramet);

    const record: PlantRametRecord = {
      id,
      birthTimeSeconds: input.birthTimeSeconds,
      offspringIds: []
    };
    if (input.parentId !== undefined) record.parentId = input.parentId;
    this.records.set(id, record);

    const event: PlantRametEvent = {
      type: "birth",
      timeSeconds: input.birthTimeSeconds,
      id
    };
    if (input.parentId !== undefined) event.parentId = input.parentId;
    this.events.push(event);
    return id;
  }

  living(): PlantRamet[] {
    return this.ramets.filter((ramet) => ramet.alive);
  }

  all(): readonly PlantRamet[] {
    return this.ramets;
  }

  record(id: number): PlantRametRecord {
    const record = this.records.get(id);
    if (!record) throw new Error(`Unknown plant ramet record: ${id}`);
    return record;
  }

  eventLog(): readonly PlantRametEvent[] {
    return this.events;
  }

  clone(parent: PlantRamet, childShare: number, timeSeconds: number): number {
    if (!parent.alive) throw new Error("Dead ramet cannot clone");
    if (childShare <= 0 || childShare >= parent.share) {
      throw new Error("Child share must be positive and smaller than parent share");
    }
    parent.share -= childShare;
    parent.lastCloneSeconds = timeSeconds;
    parent.offspringCount += 1;

    const childId = this.create({
      parentId: parent.id,
      birthTimeSeconds: timeSeconds,
      ageSeconds: 0,
      share: childShare,
      lastCloneSeconds: timeSeconds
    });
    this.record(parent.id).offspringIds.push(childId);
    this.events.push({
      type: "clone",
      timeSeconds,
      parentId: parent.id,
      offspringId: childId
    });
    return childId;
  }

  markDead(id: number, timeSeconds: number): void {
    const ramet = this.ramets.find((candidate) => candidate.id === id);
    if (!ramet || !ramet.alive) return;
    ramet.alive = false;
    ramet.share = 0;
    this.record(id).deathTimeSeconds = timeSeconds;
    this.events.push({ type: "death", timeSeconds, id });
  }

  normalizeShares(): void {
    const living = this.living();
    const sum = living.reduce((total, ramet) => total + ramet.share, 0);
    if (living.length === 0) return;
    if (sum <= 0) {
      const equal = 1 / living.length;
      for (const ramet of living) ramet.share = equal;
      return;
    }
    for (const ramet of living) ramet.share /= sum;
  }

  assertShares(tolerance = 1e-9): void {
    const living = this.living();
    if (living.length === 0) return;
    const sum = living.reduce((total, ramet) => total + ramet.share, 0);
    if (Math.abs(sum - 1) > tolerance) {
      throw new Error(`Living plant ramet shares must sum to 1, received ${sum}`);
    }
    if (living.some((ramet) => ramet.share <= 0)) {
      throw new Error("Living plant ramets must have positive shares");
    }
  }
}

export interface PlantClonalParameters {
  structuralPool: string;
  reservePool: string;
  waterPool: string;
  litterPool: string;
  substratePool: string;

  maturityDays: number;
  cloneIntervalDays: number;
  cloneFraction: number;
  minimumStructuralCarbonMgForClone: number;
  rametLifespanDays: number;
}

const DAY = 86400;

export class PlantClonalLineageSystem implements SimSystem {
  readonly name = "plant-clonal-lineage";

  constructor(
    readonly population: PlantRametPopulation,
    private readonly p: PlantClonalParameters
  ) {
    if (p.cloneFraction <= 0 || p.cloneFraction >= 0.5) {
      throw new Error("cloneFraction must be in (0, 0.5)");
    }
  }

  step(world: WorldState, dtSeconds: number): void {
    for (const ramet of this.population.living()) {
      ramet.ageSeconds += dtSeconds;
    }

    this.handleDeaths(world);
    if (this.population.living().length === 0) return;

    const structuralC = world.ledger.getPool(this.p.structuralPool).carbonMg;
    const current = [...this.population.living()];
    for (const ramet of current) {
      if (ramet.ageSeconds < this.p.maturityDays * DAY) continue;
      if (
        world.timeSeconds - ramet.lastCloneSeconds <
        this.p.cloneIntervalDays * DAY
      ) continue;

      const rametStructuralC = structuralC * ramet.share;
      if (rametStructuralC < this.p.minimumStructuralCarbonMgForClone) continue;

      const childShare = ramet.share * this.p.cloneFraction;
      this.population.clone(ramet, childShare, world.timeSeconds);
    }

    this.population.normalizeShares();
    this.population.assertShares();
  }

  private handleDeaths(world: WorldState): void {
    const living = this.population.living();
    const dying = living.filter(
      (ramet) => ramet.ageSeconds >= this.p.rametLifespanDays * DAY
    );
    if (dying.length === 0) return;

    const dyingShare = Math.min(
      1,
      dying.reduce((total, ramet) => total + ramet.share, 0)
    );

    const structural = world.ledger.getPool(this.p.structuralPool);
    const reserve = world.ledger.getPool(this.p.reservePool);
    const water = world.ledger.getPool(this.p.waterPool);

    if (dyingShare > 0) {
      const structuralLoss = scaleMaterial(structural, dyingShare);
      if (
        structuralLoss.carbonMg > 0 ||
        structuralLoss.nitrogenMg > 0 ||
        structuralLoss.phosphorusMg > 0 ||
        structuralLoss.waterG > 0
      ) {
        world.ledger.transfer(
          this.p.structuralPool,
          this.p.litterPool,
          structuralLoss
        );
      }

      const reserveLoss = scaleMaterial(reserve, dyingShare);
      if (
        reserveLoss.carbonMg > 0 ||
        reserveLoss.nitrogenMg > 0 ||
        reserveLoss.phosphorusMg > 0 ||
        reserveLoss.waterG > 0
      ) {
        world.ledger.transfer(
          this.p.reservePool,
          this.p.litterPool,
          reserveLoss
        );
      }

      const waterLoss = scaleMaterial(water, dyingShare);
      if (waterLoss.waterG > 0) {
        world.ledger.transfer(
          this.p.waterPool,
          this.p.substratePool,
          waterLoss
        );
      }
    }

    for (const ramet of dying) {
      this.population.markDead(ramet.id, world.timeSeconds);
    }

    this.population.normalizeShares();
    this.population.assertShares();
  }
}

export function seedPlantRamets(count: number, ageDays = 0): PlantRametPopulation {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("Plant ramet count must be a positive integer");
  }
  const population = new PlantRametPopulation();
  const share = 1 / count;
  for (let i = 0; i < count; i++) {
    population.create({
      birthTimeSeconds: -ageDays * DAY,
      ageSeconds: ageDays * DAY,
      share
    });
  }
  population.assertShares();
  return population;
}

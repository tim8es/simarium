import type { BradysiaPopulation } from "./phase5.js";
import type { DalotiaPopulation } from "./phase6.js";
import type { FolsomiaPopulation } from "./phase3.js";
import type { TrichorhinaPopulation } from "./phase4.js";
import type { SimSystem } from "./systems.js";
import type { WorldState } from "./world.js";

export type HabitatLayer = "substrate" | "air";

export interface HabitatPosition {
  x: number;
  z: number;
  layer: HabitatLayer;
}

export interface LocalEncounterIndex {
  isLocal(predatorRef: string, preyRef: string, radiusCells?: number): boolean;
}

export class SpatialHabitat implements LocalEncounterIndex {
  private readonly positions = new Map<string, HabitatPosition>();

  constructor(
    readonly width: number,
    readonly depth: number
  ) {
    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(depth) || depth <= 0) {
      throw new Error("Spatial habitat dimensions must be positive integers");
    }
  }

  get(ref: string): HabitatPosition | undefined {
    const position = this.positions.get(ref);
    return position ? { ...position } : undefined;
  }

  set(ref: string, position: HabitatPosition): void {
    this.positions.set(ref, {
      x: this.wrap(position.x, this.width),
      z: this.wrap(position.z, this.depth),
      layer: position.layer
    });
  }

  ensure(
    ref: string,
    world: WorldState,
    layer: HabitatLayer,
    parentRef?: string
  ): HabitatPosition {
    const existing = this.positions.get(ref);
    if (existing) {
      if (existing.layer !== layer) existing.layer = layer;
      return existing;
    }

    const parent = parentRef ? this.positions.get(parentRef) : undefined;
    const position: HabitatPosition = parent
      ? { ...parent, layer }
      : {
          x: world.rng.nextInt(this.width),
          z: world.rng.nextInt(this.depth),
          layer
        };
    this.positions.set(ref, position);
    return position;
  }

  moveRandomNeighbor(ref: string, world: WorldState): void {
    const position = this.positions.get(ref);
    if (!position) return;
    const direction = world.rng.nextInt(5);
    if (direction === 0) position.x = this.wrap(position.x - 1, this.width);
    if (direction === 1) position.x = this.wrap(position.x + 1, this.width);
    if (direction === 2) position.z = this.wrap(position.z - 1, this.depth);
    if (direction === 3) position.z = this.wrap(position.z + 1, this.depth);
  }

  isLocal(
    predatorRef: string,
    preyRef: string,
    radiusCells = 1
  ): boolean {
    const a = this.positions.get(predatorRef);
    const b = this.positions.get(preyRef);
    if (!a || !b || a.layer !== b.layer) return false;

    const dxRaw = Math.abs(a.x - b.x);
    const dzRaw = Math.abs(a.z - b.z);
    const dx = Math.min(dxRaw, this.width - dxRaw);
    const dz = Math.min(dzRaw, this.depth - dzRaw);
    return Math.max(dx, dz) <= radiusCells;
  }

  entries(): Array<[string, HabitatPosition]> {
    return [...this.positions.entries()].map(([ref, position]) => [
      ref,
      { ...position }
    ]);
  }

  private wrap(value: number, size: number): number {
    return ((value % size) + size) % size;
  }
}

export interface SpatialEcologyPopulations {
  folsomia: FolsomiaPopulation;
  trichorhina: TrichorhinaPopulation;
  bradysia: BradysiaPopulation;
  dalotia: DalotiaPopulation;
}

export interface SpatialMovementRates {
  folsomiaPerSecond: number;
  trichorhinaPerSecond: number;
  bradysiaLarvaPerSecond: number;
  bradysiaAdultPerSecond: number;
  dalotiaLarvaPerSecond: number;
  dalotiaAdultPerSecond: number;
}

export class SpatialEcologySystem implements SimSystem {
  readonly name = "spatial-ecology";

  constructor(
    readonly habitat: SpatialHabitat,
    private readonly populations: SpatialEcologyPopulations,
    private readonly rates: SpatialMovementRates
  ) {}

  step(world: WorldState, dtSeconds: number): void {
    for (const individual of this.populations.folsomia.living()) {
      const ref = `folsomia_candida#${individual.id}`;
      const parentRef =
        individual.parentId !== undefined
          ? `folsomia_candida#${individual.parentId}`
          : undefined;
      this.habitat.ensure(ref, world, "substrate", parentRef);
      if (individual.stage !== "egg") {
        this.maybeMove(ref, world, this.rates.folsomiaPerSecond, dtSeconds);
      }
    }

    for (const individual of this.populations.trichorhina.living()) {
      const ref = `trichorhina_tomentosa#${individual.id}`;
      const parentRef =
        individual.parentId !== undefined
          ? `trichorhina_tomentosa#${individual.parentId}`
          : undefined;
      this.habitat.ensure(ref, world, "substrate", parentRef);
      if (individual.stage !== "manca") {
        this.maybeMove(ref, world, this.rates.trichorhinaPerSecond, dtSeconds);
      }
    }

    for (const individual of this.populations.bradysia.living()) {
      const ref = `bradysia_impatiens#${individual.id}`;
      const parentRef =
        individual.parentId !== undefined
          ? `bradysia_impatiens#${individual.parentId}`
          : undefined;
      const layer = individual.stage === "adult" ? "air" : "substrate";
      this.habitat.ensure(ref, world, layer, parentRef);
      if (individual.stage === "larva") {
        this.maybeMove(
          ref,
          world,
          this.rates.bradysiaLarvaPerSecond,
          dtSeconds
        );
      } else if (individual.stage === "adult") {
        this.maybeMove(
          ref,
          world,
          this.rates.bradysiaAdultPerSecond,
          dtSeconds
        );
      }
    }

    for (const individual of this.populations.dalotia.living()) {
      const ref = `dalotia_coriaria#${individual.id}`;
      const parentRef =
        individual.parentId !== undefined
          ? `dalotia_coriaria#${individual.parentId}`
          : undefined;
      this.habitat.ensure(ref, world, "substrate", parentRef);
      if (individual.stage === "larva") {
        this.maybeMove(
          ref,
          world,
          this.rates.dalotiaLarvaPerSecond,
          dtSeconds
        );
      } else if (individual.stage === "adult") {
        this.maybeMove(
          ref,
          world,
          this.rates.dalotiaAdultPerSecond,
          dtSeconds
        );
      }
    }
  }

  private maybeMove(
    ref: string,
    world: WorldState,
    ratePerSecond: number,
    dtSeconds: number
  ): void {
    if (ratePerSecond <= 0) return;
    const probability = 1 - Math.exp(-ratePerSecond * dtSeconds);
    if (world.rng.nextFloat() < probability) {
      this.habitat.moveRandomNeighbor(ref, world);
    }
  }
}

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
  nearbyRefs(observerRef: string, radiusCells?: number): string[];
}

export class SpatialHabitat implements LocalEncounterIndex {
  private readonly positions = new Map<string, HabitatPosition>();
  private readonly cellRefs = new Map<string, Set<string>>();

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
    const next = {
      x: this.reflect(position.x, this.width),
      z: this.reflect(position.z, this.depth),
      layer: position.layer
    };
    this.removeFromCell(ref);
    this.positions.set(ref, next);
    this.addToCell(ref, next);
  }

  remove(ref: string): void {
    this.removeFromCell(ref);
    this.positions.delete(ref);
  }

  ensure(
    ref: string,
    world: WorldState,
    layer: HabitatLayer,
    parentRef?: string
  ): HabitatPosition {
    const existing = this.positions.get(ref);
    if (existing) {
      if (existing.layer !== layer) {
        this.set(ref, { ...existing, layer });
      }
      return this.positions.get(ref)!;
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
    this.addToCell(ref, position);
    return position;
  }

  moveRandomNeighbor(ref: string, world: WorldState): void {
    const position = this.positions.get(ref);
    if (!position) return;
    let x = position.x;
    let z = position.z;
    const direction = world.rng.nextInt(5);
    if (direction === 0) x = this.reflect(x - 1, this.width);
    if (direction === 1) x = this.reflect(x + 1, this.width);
    if (direction === 2) z = this.reflect(z - 1, this.depth);
    if (direction === 3) z = this.reflect(z + 1, this.depth);
    if (x !== position.x || z !== position.z) {
      this.set(ref, { x, z, layer: position.layer });
    }
  }

  moveDiffusive(ref: string, world: WorldState, expectedEvents: number): void {
    const position = this.positions.get(ref);
    if (!position || expectedEvents <= 0) return;

    if (expectedEvents < 0.5) {
      const probability = 1 - Math.exp(-expectedEvents);
      if (world.rng.nextFloat() < probability) {
        this.moveRandomNeighbor(ref, world);
      }
      return;
    }

    // Each microscopic event historically chose one of ±x, ±z or no-op
    // with equal probability. Over a long ecological timestep the net
    // displacement therefore approaches a 2D normal random walk with
    // Var(dx) = Var(dz) = 0.4 * eventCount. Sampling the net displacement
    // avoids iterating thousands of invisible microsteps.
    const sigma = Math.sqrt(0.4 * expectedEvents);
    const u1 = Math.max(Number.EPSILON, world.rng.nextFloat());
    const u2 = world.rng.nextFloat();
    const radius = Math.sqrt(-2 * Math.log(u1));
    const angle = 2 * Math.PI * u2;
    const dx = Math.round(radius * Math.cos(angle) * sigma);
    const dz = Math.round(radius * Math.sin(angle) * sigma);

    const x = this.reflect(position.x + dx, this.width);
    const z = this.reflect(position.z + dz, this.depth);
    if (x !== position.x || z !== position.z) {
      this.set(ref, { x, z, layer: position.layer });
    }
  }

  nearbyRefs(observerRef: string, radiusCells = 1): string[] {
    const origin = this.positions.get(observerRef);
    if (!origin) return [];
    const radius = Math.max(0, Math.floor(radiusCells));
    const refs = new Set<string>();

    for (
      let x = Math.max(0, origin.x - radius);
      x <= Math.min(this.width - 1, origin.x + radius);
      x++
    ) {
      for (
        let z = Math.max(0, origin.z - radius);
        z <= Math.min(this.depth - 1, origin.z + radius);
        z++
      ) {
        const bucket = this.cellRefs.get(this.cellKey(x, z, origin.layer));
        if (!bucket) continue;
        for (const ref of bucket) refs.add(ref);
      }
    }

    return [...refs];
  }

  isLocal(
    predatorRef: string,
    preyRef: string,
    radiusCells = 1
  ): boolean {
    const a = this.positions.get(predatorRef);
    const b = this.positions.get(preyRef);
    if (!a || !b || a.layer !== b.layer) return false;

    const dx = Math.abs(a.x - b.x);
    const dz = Math.abs(a.z - b.z);
    return Math.max(dx, dz) <= radiusCells;
  }

  entries(): Array<[string, HabitatPosition]> {
    return [...this.positions.entries()].map(([ref, position]) => [
      ref,
      { ...position }
    ]);
  }

  private cellKey(x: number, z: number, layer: HabitatLayer): string {
    return `${layer}:${x}:${z}`;
  }

  private addToCell(ref: string, position: HabitatPosition): void {
    const key = this.cellKey(position.x, position.z, position.layer);
    let bucket = this.cellRefs.get(key);
    if (!bucket) {
      bucket = new Set<string>();
      this.cellRefs.set(key, bucket);
    }
    bucket.add(ref);
  }

  private removeFromCell(ref: string): void {
    const position = this.positions.get(ref);
    if (!position) return;
    const key = this.cellKey(position.x, position.z, position.layer);
    const bucket = this.cellRefs.get(key);
    if (!bucket) return;
    bucket.delete(ref);
    if (bucket.size === 0) this.cellRefs.delete(key);
  }

  private reflect(value: number, size: number): number {
    if (size <= 1) return 0;
    const edge = size - 1;
    const period = edge * 2;
    const normalized = ((value % period) + period) % period;
    return normalized <= edge ? normalized : period - normalized;
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
  private activeRefs = new Set<string>();

  constructor(
    readonly habitat: SpatialHabitat,
    private readonly populations: SpatialEcologyPopulations,
    private readonly rates: SpatialMovementRates
  ) {}

  step(world: WorldState, dtSeconds: number): void {
    const currentRefs = new Set<string>();

    for (const individual of this.populations.folsomia.living()) {
      const ref = `folsomia_candida#${individual.id}`;
      currentRefs.add(ref);
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
      currentRefs.add(ref);
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
      currentRefs.add(ref);
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
      currentRefs.add(ref);
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

    for (const staleRef of this.activeRefs) {
      if (!currentRefs.has(staleRef)) this.habitat.remove(staleRef);
    }
    this.activeRefs = currentRefs;
  }

  private maybeMove(
    ref: string,
    world: WorldState,
    ratePerSecond: number,
    dtSeconds: number
  ): void {
    if (ratePerSecond <= 0) return;
    this.habitat.moveDiffusive(ref, world, ratePerSecond * dtSeconds);
  }
}

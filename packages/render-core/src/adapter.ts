import type {
  RenderAdapterMetrics,
  RenderEntity,
  RenderWorldDelta,
  RenderWorldDimensions,
  RenderWorldSnapshot
} from "./types.js";

function cloneEntity(entity: RenderEntity): RenderEntity {
  if (!entity.id) throw new Error("Render entity id must be non-empty");
  if (!entity.speciesId) throw new Error(`Render entity ${entity.id} has no speciesId`);
  if (!Number.isFinite(entity.scale) || entity.scale <= 0) {
    throw new Error(`Render entity ${entity.id} has invalid scale ${entity.scale}`);
  }

  for (const value of [...entity.position, ...entity.orientation]) {
    if (!Number.isFinite(value)) throw new Error(`Render entity ${entity.id} has a non-finite transform`);
  }

  return {
    ...entity,
    position: [...entity.position],
    orientation: [...entity.orientation]
  };
}

function validateDimensions(dimensions: RenderWorldDimensions): void {
  if (
    !Number.isFinite(dimensions.width) || dimensions.width <= 0 ||
    !Number.isFinite(dimensions.depth) || dimensions.depth <= 0 ||
    !Number.isFinite(dimensions.height) || dimensions.height <= 0
  ) {
    throw new Error("Render world dimensions must be finite positive meters");
  }
}

/**
 * Owns a renderer-only projection of simulation state.
 * It deliberately has no dependency on sim-core or Three.js.
 */
export class RenderAdapter {
  private readonly entities = new Map<string, RenderEntity>();
  private sequence = -1;
  private simulationTime = 0;
  private dimensions: RenderWorldDimensions | null = null;

  applySnapshot(snapshot: RenderWorldSnapshot): void {
    if (!Number.isInteger(snapshot.sequence) || snapshot.sequence < 0) {
      throw new Error(`Invalid render snapshot sequence ${snapshot.sequence}`);
    }
    if (!Number.isFinite(snapshot.simulationTime) || snapshot.simulationTime < 0) {
      throw new Error(`Invalid render snapshot simulationTime ${snapshot.simulationTime}`);
    }
    validateDimensions(snapshot.dimensions);

    const next = new Map<string, RenderEntity>();
    for (const entity of snapshot.entities) {
      if (next.has(entity.id)) throw new Error(`Duplicate render entity id ${entity.id}`);
      next.set(entity.id, cloneEntity(entity));
    }

    this.entities.clear();
    for (const [id, entity] of next) this.entities.set(id, entity);
    this.sequence = snapshot.sequence;
    this.simulationTime = snapshot.simulationTime;
    this.dimensions = { ...snapshot.dimensions };
  }

  applyDelta(delta: RenderWorldDelta): void {
    if (this.dimensions === null) throw new Error("Cannot apply render delta before an initial snapshot");
    if (!Number.isInteger(delta.sequence) || delta.sequence <= this.sequence) {
      throw new Error(`Render delta sequence ${delta.sequence} must be newer than ${this.sequence}`);
    }
    if (!Number.isFinite(delta.simulationTime) || delta.simulationTime < this.simulationTime) {
      throw new Error(`Render delta simulationTime ${delta.simulationTime} regressed from ${this.simulationTime}`);
    }

    const removalSet = new Set(delta.removals);
    if (removalSet.size !== delta.removals.length) throw new Error("Render delta contains duplicate removals");

    const upsertIds = new Set<string>();
    const clonedUpserts: RenderEntity[] = [];
    for (const entity of delta.upserts) {
      if (upsertIds.has(entity.id)) throw new Error(`Render delta contains duplicate upsert ${entity.id}`);
      if (removalSet.has(entity.id)) throw new Error(`Render delta both removes and upserts ${entity.id}`);
      upsertIds.add(entity.id);
      clonedUpserts.push(cloneEntity(entity));
    }

    for (const id of removalSet) this.entities.delete(id);
    for (const entity of clonedUpserts) this.entities.set(entity.id, entity);

    this.sequence = delta.sequence;
    this.simulationTime = delta.simulationTime;
  }

  getDimensions(): RenderWorldDimensions {
    if (this.dimensions === null) throw new Error("RenderAdapter has not received a snapshot");
    return { ...this.dimensions };
  }

  getEntity(id: string): RenderEntity | undefined {
    const entity = this.entities.get(id);
    return entity ? cloneEntity(entity) : undefined;
  }

  getEntities(): readonly RenderEntity[] {
    return Array.from(this.entities.values(), cloneEntity);
  }

  getRenderableEntities(): readonly RenderEntity[] {
    const result: RenderEntity[] = [];
    for (const entity of this.entities.values()) {
      if (entity.alive && entity.visible) result.push(cloneEntity(entity));
    }
    return result;
  }

  /**
   * Allocation-free renderer hot path. The callback receives adapter-owned
   * render projection data, never authoritative simulation objects.
   */
  forEachRenderableEntity(visitor: (entity: Readonly<RenderEntity>) => void): void {
    for (const entity of this.entities.values()) {
      if (entity.alive && entity.visible) visitor(entity);
    }
  }

  getMetrics(): RenderAdapterMetrics {
    let aliveEntities = 0;
    let visibleEntities = 0;
    for (const entity of this.entities.values()) {
      if (entity.alive) aliveEntities++;
      if (entity.alive && entity.visible) visibleEntities++;
    }
    return {
      sequence: this.sequence,
      simulationTime: this.simulationTime,
      totalEntities: this.entities.size,
      aliveEntities,
      visibleEntities
    };
  }
}

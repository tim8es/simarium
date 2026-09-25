import type { JsonValue } from "./snapshot.js";

export interface Vec3Dto { x: number; y: number; z: number }
export interface QuaternionDto { x: number; y: number; z: number; w: number }

export interface RenderEntityDto {
  entityId: string;
  speciesId: string;
  lifeStage: string;
  position: Vec3Dto;
  orientation: QuaternionDto;
  displayScale: number;
  action: string;
  selected?: boolean;
  debugAttributes?: Record<string, JsonValue>;
}

export interface RenderWorldSnapshotDto {
  tick: number;
  virtualTime: number;
  entities: RenderEntityDto[];
  selectedEntityId?: string;
  environment?: Record<string, JsonValue>;
}

export interface RenderWorldDeltaDto {
  baseTick: number;
  tick: number;
  virtualTime: number;
  upserted: RenderEntityDto[];
  removedEntityIds: string[];
  selectedEntityId?: string;
  environment?: Record<string, JsonValue>;
}

function entityEqual(a: RenderEntityDto, b: RenderEntityDto): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function diffRenderSnapshots(
  previous: RenderWorldSnapshotDto,
  next: RenderWorldSnapshotDto
): RenderWorldDeltaDto {
  const before = new Map(previous.entities.map((entity) => [entity.entityId, entity]));
  const after = new Map(next.entities.map((entity) => [entity.entityId, entity]));
  const upserted: RenderEntityDto[] = [];
  const removedEntityIds: string[] = [];

  for (const [id, entity] of after) {
    const prior = before.get(id);
    if (!prior || !entityEqual(prior, entity)) upserted.push(structuredClone(entity));
  }
  for (const id of before.keys()) {
    if (!after.has(id)) removedEntityIds.push(id);
  }

  const delta: RenderWorldDeltaDto = {
    baseTick: previous.tick,
    tick: next.tick,
    virtualTime: next.virtualTime,
    upserted,
    removedEntityIds
  };
  if (next.selectedEntityId !== undefined) delta.selectedEntityId = next.selectedEntityId;
  if (next.environment !== undefined) delta.environment = structuredClone(next.environment);
  return delta;
}

export function applyRenderDelta(
  base: RenderWorldSnapshotDto,
  delta: RenderWorldDeltaDto
): RenderWorldSnapshotDto {
  if (base.tick !== delta.baseTick) {
    throw new Error(`Render delta base mismatch: have ${base.tick}, need ${delta.baseTick}`);
  }
  const entities = new Map(base.entities.map((entity) => [entity.entityId, structuredClone(entity)]));
  for (const id of delta.removedEntityIds) entities.delete(id);
  for (const entity of delta.upserted) entities.set(entity.entityId, structuredClone(entity));
  const next: RenderWorldSnapshotDto = {
    tick: delta.tick,
    virtualTime: delta.virtualTime,
    entities: [...entities.values()]
  };
  if (delta.selectedEntityId !== undefined) next.selectedEntityId = delta.selectedEntityId;
  else if (base.selectedEntityId !== undefined) next.selectedEntityId = base.selectedEntityId;
  if (delta.environment !== undefined) next.environment = structuredClone(delta.environment);
  else if (base.environment !== undefined) next.environment = structuredClone(base.environment);
  return next;
}

function lerp(a: number, b: number, alpha: number): number {
  return a + (b - a) * alpha;
}

function normalizeQuaternion(value: QuaternionDto): QuaternionDto {
  const length = Math.hypot(value.x, value.y, value.z, value.w);
  if (length === 0) return { x: 0, y: 0, z: 0, w: 1 };
  return { x: value.x / length, y: value.y / length, z: value.z / length, w: value.w / length };
}

function interpolateQuaternion(a: QuaternionDto, b: QuaternionDto, alpha: number): QuaternionDto {
  const dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
  const sign = dot < 0 ? -1 : 1;
  return normalizeQuaternion({
    x: lerp(a.x, b.x * sign, alpha),
    y: lerp(a.y, b.y * sign, alpha),
    z: lerp(a.z, b.z * sign, alpha),
    w: lerp(a.w, b.w * sign, alpha)
  });
}

export function interpolateRenderSnapshots(
  previous: RenderWorldSnapshotDto,
  next: RenderWorldSnapshotDto,
  alpha: number
): RenderWorldSnapshotDto {
  const t = Math.max(0, Math.min(1, alpha));
  const before = new Map(previous.entities.map((entity) => [entity.entityId, entity]));
  const entities = next.entities.map((entity) => {
    const prior = before.get(entity.entityId);
    if (!prior) return structuredClone(entity);
    return {
      ...structuredClone(entity),
      position: {
        x: lerp(prior.position.x, entity.position.x, t),
        y: lerp(prior.position.y, entity.position.y, t),
        z: lerp(prior.position.z, entity.position.z, t)
      },
      orientation: interpolateQuaternion(prior.orientation, entity.orientation, t),
      displayScale: lerp(prior.displayScale, entity.displayScale, t)
    };
  });

  const result: RenderWorldSnapshotDto = {
    tick: next.tick,
    virtualTime: lerp(previous.virtualTime, next.virtualTime, t),
    entities
  };
  if (next.selectedEntityId !== undefined) result.selectedEntityId = next.selectedEntityId;
  if (next.environment !== undefined) result.environment = structuredClone(next.environment);
  return result;
}

export class RenderSnapshotBuffer {
  private previous: RenderWorldSnapshotDto | undefined;
  private current: RenderWorldSnapshotDto | undefined;

  push(snapshot: RenderWorldSnapshotDto): void {
    if (this.current && snapshot.tick < this.current.tick) {
      throw new Error("Render snapshots must arrive in non-decreasing tick order");
    }
    this.previous = this.current;
    this.current = structuredClone(snapshot);
  }

  apply(delta: RenderWorldDeltaDto): void {
    if (!this.current) throw new Error("Cannot apply a render delta before a full snapshot");
    this.push(applyRenderDelta(this.current, delta));
  }

  sample(alpha: number): RenderWorldSnapshotDto | undefined {
    if (!this.current) return undefined;
    if (!this.previous) return structuredClone(this.current);
    return interpolateRenderSnapshots(this.previous, this.current, alpha);
  }
}

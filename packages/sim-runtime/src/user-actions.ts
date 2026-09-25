import type { JsonValue } from "./snapshot.js";

export type UserAction =
  | { type: "add_water"; waterG: number; targetPool?: string }
  | { type: "add_litter"; material: { carbonMg: number; nitrogenMg: number; phosphorusMg: number; waterG: number }; targetPool?: string }
  | { type: "introduce_organisms"; speciesId: string; count: number; lifeStage?: string; attributes?: JsonValue }
  | { type: "remove_organisms"; entityIds: string[] }
  | { type: "set_light"; intensity: number; scheduleId?: string }
  | { type: "set_ventilation"; ratePerSecond: number }
  | { type: "add_hardscape"; hardscapeId: string; kind: string; position: { x: number; y: number; z: number }; orientation?: { x: number; y: number; z: number; w: number }; attributes?: JsonValue }
  | { type: "remove_hardscape"; hardscapeId: string };

export interface UserActionEnvelope {
  sequence: number;
  targetTick: number;
  action: UserAction;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function isUserAction(value: unknown): value is UserAction {
  if (!isRecord(value) || !nonEmpty(value.type)) return false;
  switch (value.type) {
    case "add_water":
      return finiteNonNegative(value.waterG) && (value.targetPool === undefined || nonEmpty(value.targetPool));
    case "add_litter": {
      if (!isRecord(value.material)) return false;
      const material = value.material;
      return ["carbonMg", "nitrogenMg", "phosphorusMg", "waterG"].every((key) => finiteNonNegative(material[key])) &&
        (value.targetPool === undefined || nonEmpty(value.targetPool));
    }
    case "introduce_organisms":
      return nonEmpty(value.speciesId) && Number.isInteger(value.count) && (value.count as number) > 0 &&
        (value.lifeStage === undefined || nonEmpty(value.lifeStage));
    case "remove_organisms":
      return Array.isArray(value.entityIds) && value.entityIds.length > 0 && value.entityIds.every(nonEmpty);
    case "set_light":
      return finiteNonNegative(value.intensity) && (value.scheduleId === undefined || nonEmpty(value.scheduleId));
    case "set_ventilation":
      return finiteNonNegative(value.ratePerSecond);
    case "add_hardscape": {
      if (!nonEmpty(value.hardscapeId) || !nonEmpty(value.kind) || !isRecord(value.position)) return false;
      if (![value.position.x, value.position.y, value.position.z].every(finite)) return false;
      if (value.orientation !== undefined) {
        if (!isRecord(value.orientation)) return false;
        if (![value.orientation.x, value.orientation.y, value.orientation.z, value.orientation.w].every(finite)) return false;
      }
      return true;
    }
    case "remove_hardscape":
      return nonEmpty(value.hardscapeId);
    default:
      return false;
  }
}

export function isUserActionEnvelope(value: unknown): value is UserActionEnvelope {
  if (!isRecord(value)) return false;
  return Number.isInteger(value.sequence) && (value.sequence as number) >= 0 &&
    Number.isInteger(value.targetTick) && (value.targetTick as number) >= 0 &&
    isUserAction(value.action);
}

export class DeterministicUserActionQueue {
  private readonly pending: UserActionEnvelope[] = [];
  private lastSequence = -1;
  private lastTargetTick = -1;

  enqueue(envelope: UserActionEnvelope): void {
    if (!isUserActionEnvelope(envelope)) throw new Error("Invalid user action envelope");
    if (envelope.sequence <= this.lastSequence) {
      throw new Error(`User action sequence must increase monotonically: ${envelope.sequence} <= ${this.lastSequence}`);
    }
    if (envelope.targetTick < this.lastTargetTick) {
      throw new Error(`User action targetTick must be non-decreasing: ${envelope.targetTick} < ${this.lastTargetTick}`);
    }
    this.lastSequence = envelope.sequence;
    this.lastTargetTick = envelope.targetTick;
    this.pending.push(structuredClone(envelope));
  }

  takeForTick(tick: number): UserActionEnvelope[] {
    if (!Number.isInteger(tick) || tick < 0) throw new Error("tick must be a non-negative integer");
    let count = 0;
    while (count < this.pending.length && this.pending[count]!.targetTick <= tick) count++;
    return this.pending.splice(0, count);
  }

  snapshot(): UserActionEnvelope[] {
    return structuredClone(this.pending);
  }
}

export function replayUserActions(
  actions: readonly UserActionEnvelope[],
  apply: (envelope: UserActionEnvelope) => void
): void {
  let previous = -1;
  for (const action of actions) {
    if (!isUserActionEnvelope(action)) throw new Error("Invalid user action replay entry");
    if (action.sequence <= previous) throw new Error("Replay sequence must be strictly increasing");
    previous = action.sequence;
    apply(structuredClone(action));
  }
}

import type { RenderWorldDeltaDto, RenderWorldSnapshotDto } from "./render-dto.js";
import { isUserActionEnvelope, type UserActionEnvelope } from "./user-actions.js";
import { parseRuntimeSnapshot, type JsonValue, type RuntimeSnapshotV2 } from "./snapshot.js";

export const SIMULATION_SPEEDS = [1, 5, 20, 100] as const;
export type SimulationSpeed = (typeof SIMULATION_SPEEDS)[number];

export type UiToWorkerMessage =
  | { type: "INIT"; requestId: string; seed: number; simulationVersion: string; speciesDataVersion: string; presetVersion?: string; config?: JsonValue }
  | { type: "LOAD_WORLD"; requestId: string; snapshot: RuntimeSnapshotV2 }
  | { type: "START"; requestId: string }
  | { type: "PAUSE"; requestId: string }
  | { type: "SET_SPEED"; requestId: string; speed: SimulationSpeed }
  | { type: "STEP"; requestId: string; ticks: number }
  | { type: "USER_ACTION"; requestId: string; action: UserActionEnvelope }
  | { type: "REQUEST_ENTITY"; requestId: string; entityId: string }
  | { type: "REQUEST_STATS"; requestId: string }
  | { type: "SAVE_SNAPSHOT"; requestId: string; title?: string };

export type WorkerToUiMessage =
  | { type: "READY"; requestId?: string }
  | { type: "WORLD_SNAPSHOT"; snapshot: RenderWorldSnapshotDto }
  | { type: "WORLD_DELTA"; delta: RenderWorldDeltaDto }
  | { type: "ENTITY_DETAILS"; requestId: string; entityId: string; details: JsonValue }
  | { type: "STATS"; requestId: string; stats: JsonValue }
  | { type: "EVENT"; event: JsonValue }
  | { type: "ERROR"; requestId?: string; code: string; message: string; recoverable: boolean }
  | { type: "SAVE_RESULT"; requestId: string; snapshot: RuntimeSnapshotV2; title?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
function isSimulationSpeed(value: unknown): value is SimulationSpeed {
  return SIMULATION_SPEEDS.some((speed) => speed === value);
}

export function parseUiToWorkerMessage(value: unknown): UiToWorkerMessage {
  if (!isRecord(value) || !nonEmpty(value.type) || !nonEmpty(value.requestId)) {
    throw new Error("Worker command requires type and requestId");
  }
  switch (value.type) {
    case "INIT": {
      if (!Number.isInteger(value.seed)) throw new Error("INIT.seed must be an integer");
      if (!nonEmpty(value.simulationVersion) || !nonEmpty(value.speciesDataVersion)) {
        throw new Error("INIT version fields are required");
      }
      const message: Extract<UiToWorkerMessage, { type: "INIT" }> = {
        type: "INIT",
        requestId: value.requestId,
        seed: value.seed as number,
        simulationVersion: value.simulationVersion,
        speciesDataVersion: value.speciesDataVersion
      };
      if (value.presetVersion !== undefined) {
        if (!nonEmpty(value.presetVersion)) throw new Error("INIT.presetVersion must be non-empty");
        message.presetVersion = value.presetVersion;
      }
      if (value.config !== undefined) message.config = value.config as JsonValue;
      return message;
    }
    case "LOAD_WORLD":
      return { type: "LOAD_WORLD", requestId: value.requestId, snapshot: parseRuntimeSnapshot(value.snapshot) };
    case "START":
    case "PAUSE":
    case "REQUEST_STATS":
      return { type: value.type, requestId: value.requestId };
    case "SET_SPEED":
      if (!isSimulationSpeed(value.speed)) {
        throw new Error("SET_SPEED.speed must be one of 1, 5, 20, 100");
      }
      return { type: "SET_SPEED", requestId: value.requestId, speed: value.speed };
    case "STEP":
      if (!Number.isInteger(value.ticks) || (value.ticks as number) <= 0) throw new Error("STEP.ticks must be a positive integer");
      return { type: "STEP", requestId: value.requestId, ticks: value.ticks as number };
    case "USER_ACTION":
      if (!isUserActionEnvelope(value.action)) throw new Error("USER_ACTION.action is invalid");
      return { type: "USER_ACTION", requestId: value.requestId, action: structuredClone(value.action) };
    case "REQUEST_ENTITY":
      if (!nonEmpty(value.entityId)) throw new Error("REQUEST_ENTITY.entityId is required");
      return { type: "REQUEST_ENTITY", requestId: value.requestId, entityId: value.entityId };
    case "SAVE_SNAPSHOT": {
      const result: Extract<UiToWorkerMessage, { type: "SAVE_SNAPSHOT" }> = { type: "SAVE_SNAPSHOT", requestId: value.requestId };
      if (value.title !== undefined) {
        if (typeof value.title !== "string") throw new Error("SAVE_SNAPSHOT.title must be a string");
        result.title = value.title;
      }
      return result;
    }
    default:
      throw new Error(`Unknown worker command: ${value.type}`);
  }
}

export function parseWorkerToUiMessage(value: unknown): WorkerToUiMessage {
  if (!isRecord(value) || !nonEmpty(value.type)) throw new Error("Worker response requires type");
  switch (value.type) {
    case "READY": {
      const result: Extract<WorkerToUiMessage, { type: "READY" }> = { type: "READY" };
      if (value.requestId !== undefined) {
        if (!nonEmpty(value.requestId)) throw new Error("READY.requestId must be non-empty");
        result.requestId = value.requestId;
      }
      return result;
    }
    case "WORLD_SNAPSHOT":
      if (!isRecord(value.snapshot)) throw new Error("WORLD_SNAPSHOT.snapshot is required");
      return value as unknown as WorkerToUiMessage;
    case "WORLD_DELTA":
      if (!isRecord(value.delta)) throw new Error("WORLD_DELTA.delta is required");
      return value as unknown as WorkerToUiMessage;
    case "ENTITY_DETAILS":
      if (!nonEmpty(value.requestId) || !nonEmpty(value.entityId)) throw new Error("ENTITY_DETAILS identifiers are required");
      return value as unknown as WorkerToUiMessage;
    case "STATS":
      if (!nonEmpty(value.requestId)) throw new Error("STATS.requestId is required");
      return value as unknown as WorkerToUiMessage;
    case "EVENT":
      if (value.event === undefined) throw new Error("EVENT.event is required");
      return value as unknown as WorkerToUiMessage;
    case "ERROR":
      if (!nonEmpty(value.code) || !nonEmpty(value.message) || typeof value.recoverable !== "boolean") {
        throw new Error("ERROR payload is invalid");
      }
      return value as unknown as WorkerToUiMessage;
    case "SAVE_RESULT":
      if (!nonEmpty(value.requestId)) throw new Error("SAVE_RESULT.requestId is required");
      return { ...(value as unknown as Extract<WorkerToUiMessage, { type: "SAVE_RESULT" }>), snapshot: parseRuntimeSnapshot(value.snapshot) };
    default:
      throw new Error(`Unknown worker response: ${value.type}`);
  }
}

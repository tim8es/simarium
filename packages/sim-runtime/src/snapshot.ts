export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type SerializedRngState = readonly [number, number, number, number];

export interface DeterministicStateSections {
  materialPools: JsonValue;
  organisms: JsonValue;
  genealogy: JsonValue;
  plants: JsonValue;
  microbeFields: JsonValue;
  spatialState: JsonValue;
  stats: JsonValue;
}

export interface RuntimeSnapshotV1 {
  schemaVersion: 1;
  simulationVersion: string;
  speciesDataVersion: string;
  seed: number;
  virtualTime: number;
  tick: number;
  rngState: SerializedRngState;
  state: JsonValue;
}

export interface RuntimeSnapshotV2 {
  schemaVersion: 2;
  simulationVersion: string;
  speciesDataVersion: string;
  presetVersion?: string;
  seed: number;
  virtualTime: number;
  tick: number;
  createdAt: string;
  rngState: SerializedRngState;
  coreState: JsonValue;
  sections: DeterministicStateSections;
}

export type RuntimeSnapshot = RuntimeSnapshotV1 | RuntimeSnapshotV2;
export const CURRENT_RUNTIME_SCHEMA_VERSION = 2 as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertFiniteNumber(value: unknown, name: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
}

function assertNonNegativeInteger(value: unknown, name: string): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
}

function assertNonEmptyString(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
}

function assertJsonValue(value: unknown, path = "value"): asserts value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${path} contains a non-finite number`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, `${path}[${index}]`));
    return;
  }
  if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) throw new Error(`${path}.${key} must not be undefined`);
      assertJsonValue(item, `${path}.${key}`);
    }
    return;
  }
  throw new Error(`${path} is not JSON-serializable`);
}

function parseRngState(value: unknown): SerializedRngState {
  if (!Array.isArray(value) || value.length !== 4) {
    throw new Error("rngState must contain four uint32 values");
  }
  const words = value.map((word) => {
    if (typeof word !== "number" || !Number.isInteger(word) || word < 0 || word > 0xffffffff) {
      throw new Error("rngState must contain four uint32 values");
    }
    return word;
  });
  if (words.every((word) => word === 0)) throw new Error("rngState cannot be all zero");
  return words as [number, number, number, number];
}

function emptySections(materialPools: JsonValue = null): DeterministicStateSections {
  return {
    materialPools,
    organisms: null,
    genealogy: null,
    plants: null,
    microbeFields: null,
    spatialState: null,
    stats: null
  };
}

function inferMaterialPools(state: JsonValue): JsonValue {
  if (!isRecord(state)) return null;
  const ledger = state.ledger;
  if (!isRecord(ledger)) return null;
  const pools = ledger.pools;
  if (pools === undefined) return null;
  assertJsonValue(pools, "state.ledger.pools");
  return pools;
}

function parseSections(value: unknown): DeterministicStateSections {
  if (!isRecord(value)) throw new Error("sections must be an object");
  const keys = [
    "materialPools",
    "organisms",
    "genealogy",
    "plants",
    "microbeFields",
    "spatialState",
    "stats"
  ] as const;
  for (const key of keys) {
    if (!(key in value)) throw new Error(`sections.${key} is required`);
    assertJsonValue(value[key], `sections.${key}`);
  }
  return {
    materialPools: value.materialPools as JsonValue,
    organisms: value.organisms as JsonValue,
    genealogy: value.genealogy as JsonValue,
    plants: value.plants as JsonValue,
    microbeFields: value.microbeFields as JsonValue,
    spatialState: value.spatialState as JsonValue,
    stats: value.stats as JsonValue
  };
}

function validateV2(value: Record<string, unknown>): RuntimeSnapshotV2 {
  assertNonEmptyString(value.simulationVersion, "simulationVersion");
  assertNonEmptyString(value.speciesDataVersion, "speciesDataVersion");
  if (value.presetVersion !== undefined) assertNonEmptyString(value.presetVersion, "presetVersion");
  assertFiniteNumber(value.seed, "seed");
  if (!Number.isInteger(value.seed)) throw new Error("seed must be an integer");
  assertFiniteNumber(value.virtualTime, "virtualTime");
  if (value.virtualTime < 0) throw new Error("virtualTime must be non-negative");
  assertNonNegativeInteger(value.tick, "tick");
  assertNonEmptyString(value.createdAt, "createdAt");
  if (Number.isNaN(Date.parse(value.createdAt))) throw new Error("createdAt must be an ISO date string");
  const rngState = parseRngState(value.rngState);
  assertJsonValue(value.coreState, "coreState");
  const sections = parseSections(value.sections);

  const snapshot: RuntimeSnapshotV2 = {
    schemaVersion: 2,
    simulationVersion: value.simulationVersion,
    speciesDataVersion: value.speciesDataVersion,
    seed: value.seed,
    virtualTime: value.virtualTime,
    tick: value.tick,
    createdAt: value.createdAt,
    rngState,
    coreState: value.coreState,
    sections
  };
  if (value.presetVersion !== undefined) snapshot.presetVersion = value.presetVersion;
  return snapshot;
}

function migrateV1(value: Record<string, unknown>): RuntimeSnapshotV2 {
  assertNonEmptyString(value.simulationVersion, "simulationVersion");
  assertNonEmptyString(value.speciesDataVersion, "speciesDataVersion");
  assertFiniteNumber(value.seed, "seed");
  if (!Number.isInteger(value.seed)) throw new Error("seed must be an integer");
  assertFiniteNumber(value.virtualTime, "virtualTime");
  if (value.virtualTime < 0) throw new Error("virtualTime must be non-negative");
  assertNonNegativeInteger(value.tick, "tick");
  const rngState = parseRngState(value.rngState);
  assertJsonValue(value.state, "state");

  return {
    schemaVersion: 2,
    simulationVersion: value.simulationVersion,
    speciesDataVersion: value.speciesDataVersion,
    seed: value.seed,
    virtualTime: value.virtualTime,
    tick: value.tick,
    createdAt: new Date(0).toISOString(),
    rngState,
    coreState: value.state,
    sections: emptySections(inferMaterialPools(value.state))
  };
}

export function parseRuntimeSnapshot(value: unknown): RuntimeSnapshotV2 {
  if (!isRecord(value)) throw new Error("Snapshot must be an object");
  const schemaVersion = value.schemaVersion;
  if (schemaVersion === 1) return migrateV1(value);
  if (schemaVersion === 2) return validateV2(value);
  if (typeof schemaVersion === "number" && schemaVersion > CURRENT_RUNTIME_SCHEMA_VERSION) {
    throw new Error(`Unsupported future snapshot schema version: ${schemaVersion}`);
  }
  throw new Error(`Unsupported snapshot schema version: ${String(schemaVersion)}`);
}

export interface CreateRuntimeSnapshotInput {
  simulationVersion: string;
  speciesDataVersion: string;
  presetVersion?: string;
  seed: number;
  virtualTime: number;
  tick: number;
  rngState: SerializedRngState;
  coreState: JsonValue;
  sections: DeterministicStateSections;
  createdAt?: string;
}

export function createRuntimeSnapshot(input: CreateRuntimeSnapshotInput): RuntimeSnapshotV2 {
  const candidate: Record<string, unknown> = {
    schemaVersion: 2,
    simulationVersion: input.simulationVersion,
    speciesDataVersion: input.speciesDataVersion,
    seed: input.seed,
    virtualTime: input.virtualTime,
    tick: input.tick,
    createdAt: input.createdAt ?? new Date().toISOString(),
    rngState: [...input.rngState],
    coreState: input.coreState,
    sections: input.sections
  };
  if (input.presetVersion !== undefined) candidate.presetVersion = input.presetVersion;
  return parseRuntimeSnapshot(candidate);
}

export function serializeRuntimeSnapshot(snapshot: RuntimeSnapshotV2): string {
  return JSON.stringify(parseRuntimeSnapshot(snapshot));
}

export function deserializeRuntimeSnapshot(serialized: string): RuntimeSnapshotV2 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch (error) {
    throw new Error(`Malformed snapshot JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  return parseRuntimeSnapshot(parsed);
}

export function toJsonValue(value: unknown): JsonValue {
  const normalized = JSON.parse(JSON.stringify(value)) as unknown;
  assertJsonValue(normalized);
  return normalized;
}

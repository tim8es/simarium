import {
  createRuntimeSnapshot,
  measureSnapshotEncoding,
  type DeterministicStateSections,
  type JsonValue
} from "../packages/sim-runtime/src/index.js";

const organisms = Array.from({ length: 1000 }, (_, index) => ({
  id: `synthetic#${index + 1}`,
  speciesId: index % 4,
  stage: index % 3,
  x: index % 32,
  z: Math.floor(index / 32),
  energy: 0.5
})) as unknown as JsonValue;

const sections: DeterministicStateSections = {
  materialPools: { atmosphere: { carbonMg: 5000, waterG: 50 }, substrate: { carbonMg: 100000, waterG: 50000 } },
  organisms,
  genealogy: null,
  plants: { ramets: Array.from({ length: 120 }, (_, id) => ({ id, share: 1 / 120 })) } as unknown as JsonValue,
  microbeFields: { fungal: Array.from({ length: 1536 }, () => 0.125) } as unknown as JsonValue,
  spatialState: { width: 32, depth: 32 },
  stats: { population: 1000 }
};

const snapshot = createRuntimeSnapshot({
  simulationVersion: "benchmark",
  speciesDataVersion: "benchmark",
  seed: 1,
  virtualTime: 86400,
  tick: 1440,
  rngState: [1, 2, 3, 4],
  coreState: { benchmark: true },
  sections,
  createdAt: "2026-09-25T00:00:00.000Z"
});

const metrics = await measureSnapshotEncoding(snapshot);
console.log(JSON.stringify(metrics, null, 2));

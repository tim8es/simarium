# Simarium — Technical architecture

Status: normative design specification

## 1. Stack

Baseline:
- TypeScript;
- Vite;
- Three.js;
- WebGL2;
- Web Worker;
- IndexedDB;
- Vitest;
- Node.js headless runner.

Optional later:
- WebGPU renderer after baseline stability;
- WASM only for profiler-proven bottlenecks.

No backend is required for MVP.

## 2. Architectural rule

The simulation must run without browser rendering.

```text
packages/sim-core
      |
      +---- apps/headless
      |
      +---- workers/sim-worker
                    |
                    v
             snapshot protocol
                    |
                    v
                apps/web
                    |
                    v
               Three.js
```

Three.js objects never own authoritative ecological state.

## 3. Proposed repository layout

```text
src/
  app/
  render/
  ui/
  worker/

packages/
  sim-core/
    world/
    species/
    systems/
    behavior/
    navigation/
    math/
    rng/
    invariants/
    telemetry/
    serialization/

  sim-data/
    species/
    presets/
    sources/

tools/
  headless/
  calibration/
  benchmark/
  data-validation/

tests/
  unit/
  invariants/
  ecology/
  regression/
  performance/
```

Exact monorepo tooling may remain lightweight; folder separation matters more than package manager complexity.

## 4. Simulation data layout

Prefer data-oriented storage for high-cardinality entities.

Example:

```ts
type AnimalStore = {
  alive: Uint8Array
  speciesId: Uint16Array
  stage: Uint8Array

  posX: Float32Array
  posY: Float32Array
  posZ: Float32Array

  structuralC: Float32Array
  reserveC: Float32Array
  bodyWater: Float32Array

  health: Float32Array
  age: Float32Array
}
```

Sparse metadata such as genealogy can live in maps/records keyed by entity ID.

Do not prematurely force every system into one ECS framework; use compact typed stores where they materially improve iteration cost.

## 5. Entity categories

### Individual entities
Use IDs for:
- macroscopic animals;
- eggs/pupae where spatially meaningful;
- plant ramets/individuals;
- major litter/corpse objects when visible.

### Field entities
Use grids/fields for:
- fungi;
- bacteria;
- humidity;
- gases;
- substrate nutrients;
- microscopic detritus.

## 6. System order

One ecology tick has deterministic ordering.

Recommended:

1. boundary inputs;
2. climate diffusion;
3. water flux;
4. plant photosynthesis/respiration;
5. plant uptake/allocation;
6. microbial decomposition;
7. animal metabolism;
8. sensing;
9. behavior decisions when due;
10. movement/navigation;
11. feeding/predation;
12. reproduction/development;
13. senescence/mortality;
14. detritus updates;
15. statistics;
16. invariants.

If systems write the same pool, define ownership or transactional flow buffers.

## 7. Flow transactions

Prefer explicit transfer operations:

```ts
transferMass({
  from,
  to,
  carbon,
  nitrogen,
  phosphorus,
  water,
  reason
})
```

The implementation may optimize later, but conceptual transfers must remain auditable.

This enables:
- invariant debugging;
- food-web metrics;
- lineage/resource history;
- replay diagnostics.

## 8. RNG

Use a deterministic seeded PRNG owned by sim-core.

Rules:
- no Math.random() in sim-core;
- systems use named RNG streams or deterministic substreams;
- ordering changes should not silently scramble all stochastic behavior where avoidable.

A reproducibility test records a hash of world state at checkpoints.

## 9. Worker protocol

Main thread -> worker:
- INIT;
- START;
- PAUSE;
- SET_SPEED;
- USER_ACTION;
- REQUEST_INSPECTION;
- SAVE;
- LOAD.

Worker -> main:
- READY;
- FRAME_SNAPSHOT;
- EVENT_BATCH;
- METRICS;
- INSPECTION_RESULT;
- SAVE_RESULT;
- ERROR.

High-frequency snapshots:
- typed arrays;
- transferable ArrayBuffer;
- double/triple buffering.

Low-frequency metadata can use structured objects.

## 10. Render snapshot

Renderer receives only what it needs:

- entity IDs;
- species/stage;
- transform;
- animation state;
- selected visual state;
- plant visual state;
- environment visual fields.

Do not transmit entire biological records every frame.

## 11. Spatial indexing

Use uniform spatial hash/grid for:
- nearby prey;
- mates;
- food;
- threat queries;
- collision candidates.

Airborne and surface/substrate agents may use different indices.

Avoid O(N^2) global neighbor scans.

## 12. Navigation

MVP navigation layers:

- substrate/litter graph or local steering field;
- surface attachments for leaves/stems/wood;
- flight volume for fungus gnat adults and limited beetle flight.

Pathfinding may combine:
- coarse graph route;
- local steering;
- collision avoidance.

No full navmesh rebuild every frame as plants grow.

## 13. Persistence

IndexedDB stores a versioned binary/structured world snapshot.

Persist:
- sim version;
- species-data version;
- preset version;
- seed;
- clock;
- all conserved pools;
- entity stores;
- grids;
- genealogy;
- statistics.

Save serialization must also be used by headless regression fixtures where practical.

## 14. Telemetry

Simulation telemetry is first-class.

At configurable intervals:
- population/stage counts;
- biomass by species;
- births/deaths;
- predation events;
- plant productivity;
- decomposition;
- C/N/P/H2O totals;
- invariant residuals;
- CPU time by system.

The profiler must distinguish render cost from simulation cost.

## 15. Error policy

Fatal simulation errors:
- NaN/Infinity;
- negative conserved pool beyond epsilon;
- invalid entity lifecycle;
- incompatible schema;
- impossible transfer.

Do not auto-heal these errors in development/test.

Production UI may stop simulation and provide a diagnostic export.

## 16. Performance strategy

Order of optimization:
1. benchmark;
2. reduce algorithmic complexity;
3. data layout;
4. update frequency/LOD;
5. transfer reduction;
6. rendering instancing;
7. only then consider WASM/WebGPU.

Do not introduce WASM or GPU compute before a profiler identifies a bottleneck.

## 17. Security / browser constraints

MVP has no secrets.
No remote code execution.
No server authority required.
All imported presets/species files are schema-validated before use.

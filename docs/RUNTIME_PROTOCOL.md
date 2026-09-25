# Simarium runtime / worker protocol

Status: platform contract for the browser runtime.

## Goals

The authoritative simulation runs outside the browser main thread. The renderer and UI consume transport DTOs only; they never own ecological state and never mutate the mass ledger directly.

```text
UI actions / time controls
        |
        v
  sim Web Worker
        |
        +--> authoritative sim-core state
        |        |
        |        +--> versioned deterministic snapshot
        |
        +--> render snapshot / render delta
                     |
                     v
             renderer interpolation
```

The worker bridge is intentionally independent from Three.js. `packages/sim-runtime` contains protocol, persistence, snapshot, sharing and render-transport contracts. An integration adapter connects those contracts to the active ecosystem implementation.

## UI -> Worker

Every command carries a `requestId` so request/response operations can be correlated.

- `INIT` — initialize a new world from seed/config/version identifiers.
- `LOAD_WORLD` — restore a validated versioned runtime snapshot.
- `START` — start worker-side stepping.
- `PAUSE` — stop automatic stepping.
- `SET_SPEED` — change the worker tick multiplier.
- `STEP` — advance an exact number of simulation ticks while paused.
- `USER_ACTION` — enqueue an ordered simulation action.
- `REQUEST_ENTITY` — request inspection data for one entity.
- `REQUEST_STATS` — request low-frequency simulation statistics.
- `SAVE_SNAPSHOT` — obtain a deterministic versioned save snapshot.

Runtime validation happens before commands reach the simulation adapter. Malformed messages produce `ERROR` and do not mutate state.

## Worker -> UI

- `READY` — initialization/load completed.
- `WORLD_SNAPSHOT` — full render-only snapshot; sent on initialization and periodically as a resync point.
- `WORLD_DELTA` — changed/removed render entities since the previous transport frame.
- `ENTITY_DETAILS` — low-frequency inspection payload.
- `STATS` — low-frequency statistics payload.
- `EVENT` — runtime or simulation event suitable for UI history/notifications.
- `ERROR` — protocol/runtime failure.
- `SAVE_RESULT` — deterministic snapshot returned by an explicit save request.

A full world save is never emitted every render frame.

## Render DTO

`RenderEntityDto` is a stable structured-clone-safe transport shape:

- `entityId`;
- `speciesId`;
- `lifeStage`;
- position `{x,y,z}`;
- orientation quaternion `{x,y,z,w}`;
- `displayScale`;
- `action` / animation state;
- optional selected/debug attributes.

No Three.js classes cross the worker boundary.

The normal stream is:

```text
simulation tick(s)
  -> render snapshot generated inside worker adapter
  -> WORLD_DELTA for ordinary updates
  -> periodic WORLD_SNAPSHOT resync
  -> RenderSnapshotBuffer on main thread
  -> interpolation between last two snapshots
```

This keeps simulation cadence independent from browser render cadence.

## User actions

Supported action contracts:

- add water;
- add litter;
- introduce organisms;
- remove organisms;
- set light;
- set ventilation;
- add hardscape;
- remove hardscape.

A `USER_ACTION` contains `sequence` and `targetTick`. Sequence numbers are strictly increasing and target ticks are non-decreasing so replay order is deterministic.

The UI must not call `MassLedger` or mutate organism stores. The simulation adapter/core handles an accepted action at the deterministic boundary-input stage. Material additions/removals must be represented as `applyBoundaryFlux` and/or auditable material transfers owned by sim-core. Unsupported actions must fail explicitly rather than being emulated in the UI.

## Deterministic snapshot

Runtime schema is currently `schemaVersion: 2`.

Top-level identity/state:

- simulation version;
- species-data version;
- optional preset version;
- seed;
- virtual time;
- tick;
- RNG state;
- authoritative core snapshot;
- creation timestamp.

`sections` is the integration contract for deterministic domains that are not currently part of the Phase-1 `WorldState` serializer:

- material pools;
- organisms;
- genealogy;
- plants;
- microbe fields;
- spatial state;
- relevant statistics.

All section keys are mandatory in schema v2. A domain that does not exist in a specific adapter uses `null`; an integrated ecosystem adapter must populate all domains that affect future behavior or required history.

### Migration strategy

Loading always goes through `parseRuntimeSnapshot`.

- schema v2 is validated directly;
- schema v1 is explicitly migrated to v2;
- malformed snapshots are rejected;
- unknown older versions are rejected unless a migration is added;
- future versions are rejected with a clear error.

Migrations are explicit pure transforms. Never silently reinterpret incompatible state.

## Persistence

`WorldPersistenceProvider` is the storage boundary. Implementations include:

- `IndexedDbWorldPersistence` for browser storage;
- `InMemoryWorldPersistence` for tests/local adapters.

IndexedDB stores one record containing metadata plus encoded snapshot bytes.

Metadata:

- save ID;
- schema version;
- seed;
- simulation version;
- species-data version;
- `createdAt`;
- `updatedAt`;
- `virtualTime`;
- optional user title.

Snapshot payloads are JSON or gzip-compressed JSON. Compression is a persistence/share optimization, not a render-stream mechanism.

## Compression benchmark

`tools/runtime-snapshot-benchmark.ts` builds a synthetic transport snapshot (1000 entities plus representative plant/microbial arrays) and reports:

- raw JSON bytes;
- compressed bytes;
- serialization time;
- compression time;
- decode/deserialization time.

A local Node 22 benchmark during implementation measured approximately:

```text
raw JSON:       87,647 bytes
compressed:      6,065 bytes
gain:            ~14.5x smaller
serialization:   ~2.1 ms
compression:     ~30.7 ms
decode+parse:    ~5.7 ms
```

These numbers are machine/runtime dependent. They justify gzip for explicit save/share operations, not per-frame worker traffic.

## Sharing

Two formats are separated.

### Share preset

`SharePresetV1` contains only seed + preset/config and is base64url encoded for URL-safe use. It reconstructs a new deterministic world from the same inputs; it is not a living save.

### Share living world

A living world is the versioned runtime snapshot, normally gzip-compressed. No backend is required now.

Future backend contract:

```ts
interface WorldShareProvider {
  upload(snapshot: RuntimeSnapshotV2): Promise<WorldShareId>
  download(id: WorldShareId): Promise<RuntimeSnapshotV2>
}
```

The local `InMemoryWorldShareProvider` satisfies this contract. A future server implementation can map upload to `POST snapshot -> short world ID` and download to `/world/{id}` without changing UI/runtime callers.

## Integration requirement for Phase 7+

The current `main` serializer covers Phase-1 world state only. The full ecosystem integration adapter must therefore populate and restore the deterministic `sections` for animal populations/life records, plant ramets/lineage, microbe fields, spatial habitat positions and required stats before browser persistence is considered complete for the integrated ecosystem.

This platform work deliberately does not change biology coefficients, lifecycle rules or ecological calibration.

import { ScalarGrid3D, type GridSnapshot } from "./grid.js";
import { MassLedger, type LedgerSnapshot } from "./ledger.js";
import { DeterministicRng, type RngState } from "./rng.js";
import { WorldState, type WorldConfig } from "./world.js";

export interface WorldSnapshotV1 {
  schemaVersion: 1;
  config: WorldConfig;
  timeSeconds: number;
  tick: number;
  rngState: RngState;
  ledger: LedgerSnapshot;
  environment: {
    temperatureC: GridSnapshot;
  };
}

export function worldToSnapshot(world: WorldState): WorldSnapshotV1 {
  return {
    schemaVersion: 1,
    config: { ...world.config },
    timeSeconds: world.timeSeconds,
    tick: world.tick,
    rngState: world.rng.getState(),
    ledger: world.ledger.snapshot(),
    environment: {
      temperatureC: world.environment.temperatureC.snapshot()
    }
  };
}

export function worldFromSnapshot(snapshot: WorldSnapshotV1): WorldState {
  if (snapshot.schemaVersion !== 1) {
    throw new Error(`Unsupported world schema version: ${snapshot.schemaVersion}`);
  }

  return new WorldState(
    { ...snapshot.config },
    new MassLedger(snapshot.ledger.pools, snapshot.ledger.cumulativeBoundaryFlux),
    { temperatureC: ScalarGrid3D.fromSnapshot(snapshot.environment.temperatureC) },
    new DeterministicRng(snapshot.config.seed, snapshot.rngState),
    snapshot.timeSeconds,
    snapshot.tick
  );
}

export function serializeWorld(world: WorldState): string {
  return JSON.stringify(worldToSnapshot(world));
}

export function deserializeWorld(serialized: string): WorldState {
  return worldFromSnapshot(JSON.parse(serialized) as WorldSnapshotV1);
}

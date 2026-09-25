import {
  FixedStepScheduler,
  TemperatureBoundarySystem,
  TemperatureDiffusionSystem,
  WaterCycleSystem,
  createPhase1World,
  deserializeWorld,
  type WorldState
} from "../../sim-core/src/index.js";
import type { RenderWorldSnapshotDto } from "./render-dto.js";
import type { SimulationRuntimeAdapter } from "./worker-runtime.js";
import {
  createRuntimeSnapshot,
  toJsonValue,
  type JsonValue,
  type RuntimeSnapshotV2
} from "./snapshot.js";
import {
  DeterministicUserActionQueue,
  type UserActionEnvelope
} from "./user-actions.js";
import type { UiToWorkerMessage } from "./protocol.js";

const DEFAULT_SIMULATION_VERSION = "0.1.0";
const DEFAULT_SPECIES_DATA_VERSION = "unknown";

function objectValue(value: JsonValue | undefined): Record<string, JsonValue> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return value;
}

function numberValue(record: Record<string, JsonValue> | undefined, key: string): number | undefined {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function materialOnly(input: {
  carbonMg?: number;
  nitrogenMg?: number;
  phosphorusMg?: number;
  waterG?: number;
}) {
  return {
    carbonMg: input.carbonMg ?? 0,
    nitrogenMg: input.nitrogenMg ?? 0,
    phosphorusMg: input.phosphorusMg ?? 0,
    waterG: input.waterG ?? 0
  };
}

export class Phase1SimulationRuntimeAdapter implements SimulationRuntimeAdapter {
  private world: WorldState | undefined;
  private scheduler: FixedStepScheduler | undefined;
  private readonly actions = new DeterministicUserActionQueue();
  private simulationVersion = DEFAULT_SIMULATION_VERSION;
  private speciesDataVersion = DEFAULT_SPECIES_DATA_VERSION;
  private presetVersion: string | undefined;

  init(message: Extract<UiToWorkerMessage, { type: "INIT" }>): void {
    const config = objectValue(message.config);
    const fixedDtSeconds = numberValue(config, "fixedDtSeconds");
    const roomTemperatureC = numberValue(config, "roomTemperatureC");

    this.world = createPhase1World({
      seed: message.seed,
      ...(fixedDtSeconds !== undefined ? { fixedDtSeconds } : {}),
      ...(roomTemperatureC !== undefined ? { roomTemperatureC } : {})
    });
    this.scheduler = this.createScheduler(this.world);
    this.simulationVersion = message.simulationVersion;
    this.speciesDataVersion = message.speciesDataVersion;
    this.presetVersion = message.presetVersion;
  }

  loadSnapshot(snapshot: RuntimeSnapshotV2): void {
    const world = deserializeWorld(JSON.stringify(snapshot.coreState));
    if (world.tick !== snapshot.tick || world.timeSeconds !== snapshot.virtualTime) {
      throw new Error("Runtime snapshot identity does not match authoritative coreState clock");
    }
    const rng = world.rng.getState();
    if (rng.some((word, index) => word !== snapshot.rngState[index])) {
      throw new Error("Runtime snapshot RNG state does not match authoritative coreState");
    }

    this.world = world;
    this.scheduler = this.createScheduler(world);
    this.simulationVersion = snapshot.simulationVersion;
    this.speciesDataVersion = snapshot.speciesDataVersion;
    this.presetVersion = snapshot.presetVersion;
  }

  step(ticks: number): void {
    const world = this.requireWorld();
    const scheduler = this.requireScheduler();
    for (let i = 0; i < ticks; i++) {
      for (const envelope of this.actions.takeForTick(world.tick)) {
        this.applyAtBoundary(envelope);
      }
      scheduler.step(1);
    }
  }

  applyUserAction(action: UserActionEnvelope): void {
    const world = this.requireWorld();
    if (action.targetTick < world.tick) {
      throw new Error(`USER_ACTION targetTick ${action.targetTick} is behind current tick ${world.tick}`);
    }
    this.actions.enqueue(action);
  }

  renderSnapshot(): RenderWorldSnapshotDto {
    const world = this.requireWorld();
    return {
      tick: world.tick,
      virtualTime: world.timeSeconds,
      entities: [],
      environment: {
        temperatureC: {
          min: world.environment.temperatureC.min(),
          mean: world.environment.temperatureC.mean(),
          max: world.environment.temperatureC.max()
        }
      }
    };
  }

  entityDetails(entityId: string): JsonValue {
    throw new Error(`Phase-1 world has no inspectable organism entity: ${entityId}`);
  }

  stats(): JsonValue {
    const world = this.requireWorld();
    return toJsonValue({
      tick: world.tick,
      virtualTime: world.timeSeconds,
      materialTotals: world.ledger.totals(),
      pools: world.ledger.snapshot().pools,
      temperatureC: {
        min: world.environment.temperatureC.min(),
        mean: world.environment.temperatureC.mean(),
        max: world.environment.temperatureC.max()
      }
    });
  }

  saveSnapshot(): RuntimeSnapshotV2 {
    const world = this.requireWorld();
    const coreState = JSON.parse(JSON.stringify({
      schemaVersion: 1,
      config: { ...world.config },
      timeSeconds: world.timeSeconds,
      tick: world.tick,
      rngState: world.rng.getState(),
      ledger: world.ledger.snapshot(),
      environment: {
        temperatureC: world.environment.temperatureC.snapshot()
      }
    })) as JsonValue;

    return createRuntimeSnapshot({
      simulationVersion: this.simulationVersion,
      speciesDataVersion: this.speciesDataVersion,
      ...(this.presetVersion !== undefined ? { presetVersion: this.presetVersion } : {}),
      seed: world.config.seed,
      virtualTime: world.timeSeconds,
      tick: world.tick,
      rngState: world.rng.getState(),
      coreState,
      sections: {
        materialPools: toJsonValue(world.ledger.snapshot().pools),
        organisms: null,
        genealogy: null,
        plants: null,
        microbeFields: null,
        spatialState: null,
        stats: this.stats()
      }
    });
  }

  private applyAtBoundary(envelope: UserActionEnvelope): void {
    const world = this.requireWorld();
    const action = envelope.action;

    switch (action.type) {
      case "add_water": {
        const target = action.targetPool ?? "surface_water";
        world.ledger.applyBoundaryFlux(target, materialOnly({ waterG: action.waterG }));
        return;
      }
      case "add_litter": {
        const target = action.targetPool ?? "litter";
        if (!world.ledger.hasPool(target)) {
          throw new Error(`Cannot add litter: material pool ${target} does not exist in this simulation adapter`);
        }
        world.ledger.applyBoundaryFlux(target, materialOnly(action.material));
        return;
      }
      case "introduce_organisms":
      case "remove_organisms":
      case "set_light":
      case "set_ventilation":
      case "add_hardscape":
      case "remove_hardscape":
        throw new Error(`User action ${action.type} requires the integrated ecosystem runtime adapter`);
    }
  }

  private createScheduler(world: WorldState): FixedStepScheduler {
    return new FixedStepScheduler(world, [
      new TemperatureBoundarySystem(0.00001),
      new TemperatureDiffusionSystem(0.0005),
      new WaterCycleSystem({
        infiltrationPerSecond: 0.00002,
        evaporationPerSecond: 0.000005,
        condensationPerSecond: 0.000002
      })
    ]);
  }

  private requireWorld(): WorldState {
    if (!this.world) throw new Error("Simulation runtime is not initialized");
    return this.world;
  }

  private requireScheduler(): FixedStepScheduler {
    if (!this.scheduler) throw new Error("Simulation runtime is not initialized");
    return this.scheduler;
  }
}

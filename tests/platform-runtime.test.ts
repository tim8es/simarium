import { describe, expect, it, vi } from "vitest";
import { indexedDB } from "fake-indexeddb";
import {
  FixedStepScheduler,
  TemperatureBoundarySystem,
  TemperatureDiffusionSystem,
  WaterCycleSystem,
  createPhase1World,
  deserializeWorld,
  serializeWorld,
  worldToSnapshot
} from "../packages/sim-core/src/index.ts";
import {
  DeterministicUserActionQueue,
  InMemoryWorldPersistence,
  InMemoryWorldShareProvider,
  IndexedDbWorldPersistence,
  RenderSnapshotBuffer,
  SimulationWorkerRuntime,
  createRuntimeSnapshot,
  decodeSharePreset,
  diffRenderSnapshots,
  encodeSharePreset,
  measureSnapshotEncoding,
  parseRuntimeSnapshot,
  parseUiToWorkerMessage,
  toJsonValue,
  type DeterministicStateSections,
  type JsonValue,
  type RenderWorldSnapshotDto,
  type RuntimeSnapshotV2,
  type SimulationRuntimeAdapter,
  type UiToWorkerMessage,
  type UserActionEnvelope,
  type WorkerToUiMessage
} from "../packages/sim-runtime/src/index.ts";

function schedulerFor(world: ReturnType<typeof createPhase1World>): FixedStepScheduler {
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

function sectionsForWorld(world: ReturnType<typeof createPhase1World>, stats: JsonValue = null): DeterministicStateSections {
  return {
    materialPools: toJsonValue(world.ledger.snapshot().pools),
    organisms: null,
    genealogy: null,
    plants: null,
    microbeFields: null,
    spatialState: null,
    stats
  };
}

function snapshotForWorld(world: ReturnType<typeof createPhase1World>, stats: JsonValue = null): RuntimeSnapshotV2 {
  return createRuntimeSnapshot({
    simulationVersion: "0.1.0-test",
    speciesDataVersion: "species-test-1",
    presetVersion: "preset-test-1",
    seed: world.config.seed,
    virtualTime: world.timeSeconds,
    tick: world.tick,
    rngState: world.rng.getState(),
    coreState: toJsonValue(worldToSnapshot(world)),
    sections: sectionsForWorld(world, stats),
    createdAt: "2026-09-25T00:00:00.000Z"
  });
}

function renderSnapshot(tick: number, x: number): RenderWorldSnapshotDto {
  return {
    tick,
    virtualTime: tick * 60,
    entities: [{
      entityId: "folsomia_candida#1",
      speciesId: "folsomia_candida",
      lifeStage: "adult",
      position: { x, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      displayScale: 1,
      action: "walk"
    }]
  };
}

describe("platform runtime snapshots", () => {
  it("round-trips a versioned snapshot and migrates schema v1", () => {
    const world = createPhase1World({ seed: 77 });
    schedulerFor(world).step(20);
    const snapshot = snapshotForWorld(world);
    expect(parseRuntimeSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);

    const migrated = parseRuntimeSnapshot({
      schemaVersion: 1,
      simulationVersion: "0.1.0",
      speciesDataVersion: "species-1",
      seed: world.config.seed,
      virtualTime: world.timeSeconds,
      tick: world.tick,
      rngState: [...world.rng.getState()],
      state: toJsonValue(worldToSnapshot(world))
    });
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.sections.materialPools).toEqual(toJsonValue(world.ledger.snapshot().pools));
  });

  it("rejects malformed and unsupported snapshots", () => {
    expect(() => parseRuntimeSnapshot({ schemaVersion: 2 })).toThrow();
    expect(() => parseRuntimeSnapshot({ schemaVersion: 999 })).toThrow(/future snapshot schema/);
    expect(() => parseRuntimeSnapshot({
      schemaVersion: 1,
      simulationVersion: "x",
      speciesDataVersion: "x",
      seed: 1,
      virtualTime: 0,
      tick: 0,
      rngState: [0, 0, 0, 0],
      state: null
    })).toThrow(/all zero/);
  });

  it("preserves deterministic continuation and RNG continuity across save/load", () => {
    const direct = createPhase1World({ seed: 991, fixedDtSeconds: 60 });
    const directScheduler = schedulerFor(direct);
    directScheduler.step(75);
    for (let i = 0; i < 17; i++) direct.rng.nextUint32();
    const saved = snapshotForWorld(direct);

    directScheduler.step(125);
    const directRandom = Array.from({ length: 32 }, () => direct.rng.nextUint32());

    const restored = deserializeWorld(JSON.stringify(saved.coreState));
    const restoredScheduler = schedulerFor(restored);
    restoredScheduler.step(125);
    const restoredRandom = Array.from({ length: 32 }, () => restored.rng.nextUint32());

    expect(restoredRandom).toEqual(directRandom);
    expect(serializeWorld(restored)).toBe(serializeWorld(direct));
  });
});

describe("worker protocol and renderer transport", () => {
  it("validates commands and rejects malformed payloads", () => {
    expect(parseUiToWorkerMessage({ type: "SET_SPEED", requestId: "r1", speed: 20 })).toEqual({ type: "SET_SPEED", requestId: "r1", speed: 20 });
    expect(() => parseUiToWorkerMessage({ type: "SET_SPEED", requestId: "r1", speed: 0 })).toThrow();
    expect(() => parseUiToWorkerMessage({ type: "STEP", requestId: "r2", ticks: 1.5 })).toThrow();
    expect(() => parseUiToWorkerMessage({ type: "USER_ACTION", requestId: "r3", action: { sequence: 0, targetTick: 0, action: { type: "add_water", waterG: -1 } } })).toThrow();
  });

  it("produces deltas and renderer-side interpolation without Three.js objects", () => {
    const a = renderSnapshot(10, 0);
    const b = renderSnapshot(11, 2);
    const delta = diffRenderSnapshots(a, b);
    expect(delta.upserted).toHaveLength(1);
    expect(delta.removedEntityIds).toEqual([]);

    const buffer = new RenderSnapshotBuffer();
    buffer.push(a);
    buffer.apply(delta);
    const halfway = buffer.sample(0.5)!;
    expect(halfway.entities[0]!.position.x).toBe(1);
  });

  it("clears optional selected/environment state through deltas", () => {
    const a: RenderWorldSnapshotDto = {
      ...renderSnapshot(10, 0),
      selectedEntityId: "folsomia_candida#1",
      environment: { humidity: 0.9 }
    };
    const b = renderSnapshot(11, 1);
    const delta = diffRenderSnapshots(a, b);
    expect(delta.selectedEntityId).toBeNull();
    expect(delta.environment).toBeNull();

    const buffer = new RenderSnapshotBuffer();
    buffer.push(a);
    buffer.apply(delta);
    const applied = buffer.sample(1)!;
    expect(applied.selectedEntityId).toBeUndefined();
    expect(applied.environment).toBeUndefined();
  });

  it("emits full snapshots sparsely and deltas for ordinary steps", async () => {
    class FakeAdapter implements SimulationRuntimeAdapter {
      tick = 0;
      init(_message: Extract<UiToWorkerMessage, { type: "INIT" }>): void {}
      loadSnapshot(snapshot: RuntimeSnapshotV2): void { this.tick = snapshot.tick; }
      step(ticks: number): void { this.tick += ticks; }
      applyUserAction(_action: UserActionEnvelope): void {}
      renderSnapshot(): RenderWorldSnapshotDto { return renderSnapshot(this.tick, this.tick); }
      entityDetails(entityId: string): JsonValue { return { entityId }; }
      stats(): JsonValue { return { tick: this.tick }; }
      saveSnapshot(): RuntimeSnapshotV2 {
        const world = createPhase1World({ seed: 1 });
        world.tick = this.tick;
        world.timeSeconds = this.tick * 60;
        return snapshotForWorld(world);
      }
    }

    const emitted: WorkerToUiMessage[] = [];
    const runtime = new SimulationWorkerRuntime(new FakeAdapter(), (message) => emitted.push(message), { fullSnapshotEveryTicks: 10 });
    await runtime.handle({ type: "INIT", requestId: "init", seed: 1, simulationVersion: "0.1", speciesDataVersion: "1" });
    await runtime.handle({ type: "STEP", requestId: "step", ticks: 1 });
    expect(emitted.some((message) => message.type === "WORLD_SNAPSHOT")).toBe(true);
    expect(emitted.some((message) => message.type === "WORLD_DELTA")).toBe(true);
    runtime.dispose();
  });

  it("pauses before async LOAD_WORLD and serializes following commands", async () => {
    vi.useFakeTimers();
    let releaseLoad!: () => void;
    const loadGate = new Promise<void>((resolve) => { releaseLoad = resolve; });

    class AsyncLoadAdapter implements SimulationRuntimeAdapter {
      tick = 0;
      stepCalls = 0;
      init(_message: Extract<UiToWorkerMessage, { type: "INIT" }>): void {}
      async loadSnapshot(snapshot: RuntimeSnapshotV2): Promise<void> {
        await loadGate;
        this.tick = snapshot.tick;
      }
      step(ticks: number): void {
        this.stepCalls += 1;
        this.tick += ticks;
      }
      applyUserAction(_action: UserActionEnvelope): void {}
      renderSnapshot(): RenderWorldSnapshotDto { return renderSnapshot(this.tick, this.tick); }
      entityDetails(entityId: string): JsonValue { return { entityId }; }
      stats(): JsonValue { return { tick: this.tick }; }
      saveSnapshot(): RuntimeSnapshotV2 {
        const world = createPhase1World({ seed: 1 });
        world.tick = this.tick;
        world.timeSeconds = this.tick * 60;
        return snapshotForWorld(world);
      }
    }

    const adapter = new AsyncLoadAdapter();
    const runtime = new SimulationWorkerRuntime(adapter, () => {}, {
      ticksPerSecondAt1x: 100,
      pulseIntervalMs: 10
    });
    await runtime.handle({ type: "INIT", requestId: "init", seed: 1, simulationVersion: "0.1", speciesDataVersion: "1" });
    await runtime.handle({ type: "START", requestId: "start" });
    await vi.advanceTimersByTimeAsync(20);
    expect(adapter.stepCalls).toBeGreaterThan(0);

    const savedWorld = createPhase1World({ seed: 1 });
    savedWorld.tick = 50;
    savedWorld.timeSeconds = 3000;
    const loadPromise = runtime.handle({ type: "LOAD_WORLD", requestId: "load", snapshot: snapshotForWorld(savedWorld) });
    await Promise.resolve();
    const callsAtLoadStart = adapter.stepCalls;
    const stepPromise = runtime.handle({ type: "STEP", requestId: "step-after-load", ticks: 1 });

    await vi.advanceTimersByTimeAsync(50);
    expect(adapter.stepCalls).toBe(callsAtLoadStart);

    releaseLoad();
    await loadPromise;
    await stepPromise;
    expect(adapter.tick).toBe(51);

    runtime.dispose();
    vi.useRealTimers();
  });
});

describe("persistence, sharing and compression", () => {
  it("persists round-trip in memory and IndexedDB", async () => {
    const world = createPhase1World({ seed: 17 });
    schedulerFor(world).step(12);
    const snapshot = snapshotForWorld(world);

    const memory = new InMemoryWorldPersistence();
    const memoryMeta = await memory.save(snapshot, { id: "memory-world", title: "Memory test" });
    expect(memoryMeta.title).toBe("Memory test");
    expect(await memory.load("memory-world")).toEqual(snapshot);

    const db = new IndexedDbWorldPersistence(`simarium-test-${Date.now()}`, indexedDB);
    const metadata = await db.save(snapshot, { id: "idb-world", title: "IDB test" });
    expect(metadata.seed).toBe(17);
    expect(await db.load("idb-world")).toEqual(snapshot);
    expect((await db.list()).map((item) => item.id)).toContain("idb-world");
    await db.delete("idb-world");
    await expect(db.load("idb-world")).rejects.toThrow(/Unknown saved world/);
  });

  it("encodes share presets and living worlds", async () => {
    const encoded = encodeSharePreset({ version: 1, seed: 42, presetId: "tropical-default", config: { light: 1 } });
    expect(decodeSharePreset(encoded)).toEqual({ version: 1, seed: 42, presetId: "tropical-default", config: { light: 1 } });

    const provider = new InMemoryWorldShareProvider();
    const snapshot = snapshotForWorld(createPhase1World({ seed: 42 }));
    const id = await provider.upload(snapshot);
    expect(await provider.download(id)).toEqual(snapshot);
  });

  it("measures raw and compressed snapshot size and serialization cost", async () => {
    const world = createPhase1World({ seed: 5 });
    const snapshot = snapshotForWorld(world, { repeated: "substrate-litter-microbe-".repeat(2000) });
    const metrics = await measureSnapshotEncoding(snapshot);
    expect(metrics.rawJsonBytes).toBeGreaterThan(1000);
    expect(metrics.compressedBytes).toBeLessThan(metrics.rawJsonBytes);
    expect(metrics.serializationMs).toBeGreaterThanOrEqual(0);
    expect(metrics.deserializationMs).toBeGreaterThanOrEqual(0);
  });
});

describe("deterministic USER_ACTION replay", () => {
  const actions: UserActionEnvelope[] = [
    { sequence: 0, targetTick: 2, action: { type: "add_water", waterG: 10, targetPool: "surface_water" } },
    { sequence: 1, targetTick: 5, action: { type: "add_water", waterG: 3.5, targetPool: "surface_water" } }
  ];

  function run(): string {
    const world = createPhase1World({ seed: 123, fixedDtSeconds: 60 });
    const scheduler = schedulerFor(world);
    const queue = new DeterministicUserActionQueue();
    actions.forEach((action) => queue.enqueue(action));

    for (let i = 0; i < 10; i++) {
      for (const envelope of queue.takeForTick(world.tick)) {
        if (envelope.action.type === "add_water") {
          world.ledger.applyBoundaryFlux(envelope.action.targetPool ?? "surface_water", {
            carbonMg: 0,
            nitrogenMg: 0,
            phosphorusMg: 0,
            waterG: envelope.action.waterG
          });
        }
      }
      scheduler.step(1);
    }
    return serializeWorld(world);
  }

  it("replays identical action journals to identical state", () => {
    expect(run()).toBe(run());
  });
});

import type {
  JsonValue,
  RuntimeSnapshotV2,
  SimulationSpeed,
  UserAction,
  WorkerToUiMessage
} from "../../../../packages/sim-runtime/src/index.js";
import {
  IndexedDbWorldPersistence,
  parseWorkerToUiMessage
} from "../../../../packages/sim-runtime/src/index.js";
import type {
  RenderEntity,
  RenderWorldDelta,
  RenderWorldSnapshot
} from "@simarium/render-core";

const DIMENSIONS = { width: 1.2, depth: 0.6, height: 0.9 } as const;

function visualSpeciesId(speciesId: string): string {
  return speciesId.replaceAll("_", "-");
}

function convertEntity(entity: {
  entityId: string;
  speciesId: string;
  lifeStage: string;
  position: { x: number; y: number; z: number };
  orientation: { x: number; y: number; z: number; w: number };
  displayScale: number;
  action: string;
}): RenderEntity {
  return {
    id: entity.entityId,
    speciesId: visualSpeciesId(entity.speciesId),
    lifeStage: entity.lifeStage,
    position: [entity.position.x, entity.position.y, entity.position.z],
    orientation: [
      entity.orientation.x,
      entity.orientation.y,
      entity.orientation.z,
      entity.orientation.w
    ],
    scale: entity.displayScale,
    animationState: entity.action,
    alive: true,
    visible: true
  };
}

type ResolveMessage = (message: WorkerToUiMessage) => void;

export interface SimulationClientHooks {
  onSnapshot?: (snapshot: RenderWorldSnapshot) => void;
  onDelta?: (delta: RenderWorldDelta) => void;
  onStats?: (stats: JsonValue) => void;
  onEntityDetails?: (entityId: string, details: JsonValue) => void;
  onEvent?: (event: JsonValue) => void;
  onError?: (message: string) => void;
  onReady?: () => void;
}

export class SimulationClient {
  private readonly worker: Worker;
  private readonly persistence = new IndexedDbWorldPersistence();
  private readonly pending = new Map<string, ResolveMessage>();
  private requestCounter = 0;
  private renderSequence = -1;
  private currentTick = 0;
  private actionSequence = 0;
  private statsTimer = 0;
  private autosaveTimer = 0;
  private currentSaveId = "autosave";
  readonly hooks: SimulationClientHooks = {};

  constructor() {
    this.worker = new Worker(new URL("../sim-worker.ts", import.meta.url), {
      type: "module",
      name: "simarium-ecology"
    });
    this.worker.addEventListener("message", this.onMessage);
  }

  async initialize(seed: number): Promise<void> {
    await this.commandAndWait({
      type: "INIT",
      requestId: this.nextRequestId("init"),
      seed,
      simulationVersion: "0.1.0",
      speciesDataVersion: "species-v2",
      presetVersion: "phase7-integrated"
    });
    this.actionSequence = 0;
    this.start();
    this.startPolling();
  }

  async reset(seed: number): Promise<void> {
    this.stopPolling();
    await this.initialize(seed);
  }

  start(): void {
    this.post({
      type: "START",
      requestId: this.nextRequestId("start")
    });
  }

  pause(): void {
    this.post({
      type: "PAUSE",
      requestId: this.nextRequestId("pause")
    });
  }

  setSpeed(speed: SimulationSpeed): void {
    this.post({
      type: "SET_SPEED",
      requestId: this.nextRequestId("speed"),
      speed
    });
  }

  step(ticks = 1): void {
    this.post({
      type: "STEP",
      requestId: this.nextRequestId("step"),
      ticks
    });
  }

  requestStats(): void {
    this.post({
      type: "REQUEST_STATS",
      requestId: this.nextRequestId("stats")
    });
  }

  requestEntity(entityId: string): void {
    this.post({
      type: "REQUEST_ENTITY",
      requestId: this.nextRequestId("entity"),
      entityId
    });
  }

  userAction(action: UserAction): number {
    const sequence = this.actionSequence++;
    this.post({
      type: "USER_ACTION",
      requestId: this.nextRequestId("action"),
      action: {
        sequence,
        targetTick: this.currentTick,
        action
      }
    });
    return sequence;
  }

  async save(title = "Autosave", id = this.currentSaveId): Promise<string> {
    const requestId = this.nextRequestId("save");
    const message = await this.commandAndWait({
      type: "SAVE_SNAPSHOT",
      requestId,
      title
    });
    if (message.type !== "SAVE_RESULT") {
      throw new Error("Unexpected save response");
    }
    const metadata = await this.persistence.save(message.snapshot, {
      id,
      title,
      compress: true
    });
    this.currentSaveId = metadata.id;
    return metadata.id;
  }

  async listSaves() {
    return this.persistence.list();
  }

  probeInvalidProtocolForValidation(): void {
    this.post({
      type: "SET_SPEED",
      requestId: this.nextRequestId("validation-error"),
      speed: 0
    });
  }

  async load(id: string): Promise<RuntimeSnapshotV2> {
    const snapshot = await this.persistence.load(id);
    this.stopPolling();
    this.restoreActionSequence(snapshot);
    await this.commandAndWait({
      type: "LOAD_WORLD",
      requestId: this.nextRequestId("load"),
      snapshot
    });
    this.currentSaveId = id;
    this.start();
    this.startPolling();
    return snapshot;
  }

  async loadLatest(): Promise<RuntimeSnapshotV2 | null> {
    const saves = await this.persistence.list();
    const latest = saves[0];
    if (!latest) return null;
    return this.load(latest.id);
  }

  dispose(): void {
    this.stopPolling();
    this.worker.removeEventListener("message", this.onMessage);
    this.worker.terminate();
  }

  private readonly onMessage = (event: MessageEvent<unknown>): void => {
    let message: WorkerToUiMessage;
    try {
      message = parseWorkerToUiMessage(event.data);
    } catch (error) {
      this.hooks.onError?.(
        error instanceof Error ? error.message : String(error)
      );
      return;
    }

    const requestId = "requestId" in message ? message.requestId : undefined;
    if (requestId) {
      const resolve = this.pending.get(requestId);
      if (resolve) {
        this.pending.delete(requestId);
        resolve(message);
      }
    }

    switch (message.type) {
      case "READY":
        this.renderSequence = -1;
        this.hooks.onReady?.();
        return;
      case "WORLD_SNAPSHOT": {
        this.currentTick = message.snapshot.tick;
        const sequence = ++this.renderSequence;
        this.hooks.onSnapshot?.({
          sequence,
          simulationTime: message.snapshot.virtualTime,
          dimensions: DIMENSIONS,
          entities: message.snapshot.entities.map(convertEntity)
        });
        return;
      }
      case "WORLD_DELTA": {
        this.currentTick = message.delta.tick;
        const sequence = ++this.renderSequence;
        this.hooks.onDelta?.({
          sequence,
          simulationTime: message.delta.virtualTime,
          upserts: message.delta.upserted.map(convertEntity),
          removals: [...message.delta.removedEntityIds]
        });
        return;
      }
      case "STATS":
        this.hooks.onStats?.(message.stats);
        return;
      case "ENTITY_DETAILS":
        this.hooks.onEntityDetails?.(message.entityId, message.details);
        return;
      case "EVENT":
        this.hooks.onEvent?.(message.event);
        return;
      case "ERROR":
        this.hooks.onError?.(message.message);
        return;
      case "SAVE_RESULT":
        return;
    }
  };

  private post(message: object): void {
    this.worker.postMessage(message);
  }

  private commandAndWait(message: { requestId: string } & Record<string, unknown>): Promise<WorkerToUiMessage> {
    return new Promise((resolve, reject) => {
      const requestId = message.requestId;
      const timeout = window.setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Worker request timed out: ${requestId}`));
      }, 30_000);
      this.pending.set(requestId, (response) => {
        window.clearTimeout(timeout);
        if (response.type === "ERROR") {
          reject(new Error(response.message));
        } else {
          resolve(response);
        }
      });
      this.post(message);
    });
  }

  private nextRequestId(prefix: string): string {
    return `${prefix}-${++this.requestCounter}`;
  }

  private startPolling(): void {
    this.stopPolling();
    this.requestStats();
    this.statsTimer = window.setInterval(() => this.requestStats(), 1000);
    this.autosaveTimer = window.setInterval(() => {
      void this.save("Autosave", "autosave").catch((error) => {
        this.hooks.onError?.(
          error instanceof Error ? error.message : String(error)
        );
      });
    }, 30_000);
  }

  private stopPolling(): void {
    if (this.statsTimer) window.clearInterval(this.statsTimer);
    if (this.autosaveTimer) window.clearInterval(this.autosaveTimer);
    this.statsTimer = 0;
    this.autosaveTimer = 0;
  }

  private restoreActionSequence(snapshot: RuntimeSnapshotV2): void {
    let maxSequence = -1;
    if (
      snapshot.coreState &&
      typeof snapshot.coreState === "object" &&
      !Array.isArray(snapshot.coreState) &&
      snapshot.coreState.appliedActions &&
      Array.isArray(snapshot.coreState.appliedActions)
    ) {
      for (const entry of snapshot.coreState.appliedActions) {
        if (
          entry &&
          typeof entry === "object" &&
          !Array.isArray(entry) &&
          typeof entry.sequence === "number"
        ) {
          maxSequence = Math.max(maxSequence, entry.sequence);
        }
      }
    }
    if (
      snapshot.userActionQueue &&
      typeof snapshot.userActionQueue === "object" &&
      !Array.isArray(snapshot.userActionQueue) &&
      typeof snapshot.userActionQueue.lastSequence === "number"
    ) {
      maxSequence = Math.max(maxSequence, snapshot.userActionQueue.lastSequence);
    }
    this.actionSequence = maxSequence + 1;
  }
}

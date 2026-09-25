import { diffRenderSnapshots, type RenderWorldSnapshotDto } from "./render-dto.js";
import { parseUiToWorkerMessage, type UiToWorkerMessage, type WorkerToUiMessage } from "./protocol.js";
import type { JsonValue, RuntimeSnapshotV2 } from "./snapshot.js";
import type { UserActionEnvelope } from "./user-actions.js";

export interface SimulationRuntimeAdapter {
  init(message: Extract<UiToWorkerMessage, { type: "INIT" }>): void | Promise<void>;
  loadSnapshot(snapshot: RuntimeSnapshotV2): void | Promise<void>;
  step(ticks: number): void;
  applyUserAction(action: UserActionEnvelope): void;
  renderSnapshot(): RenderWorldSnapshotDto;
  entityDetails(entityId: string): JsonValue;
  stats(): JsonValue;
  saveSnapshot(): RuntimeSnapshotV2;
}

export interface WorkerRuntimeOptions {
  ticksPerSecondAt1x?: number;
  pulseIntervalMs?: number;
  fullSnapshotEveryTicks?: number;
  maxTicksPerPulse?: number;
}

export type WorkerEmitter = (message: WorkerToUiMessage) => void;

export class SimulationWorkerRuntime {
  private running = false;
  private speed = 1;
  private timer: ReturnType<typeof setInterval> | undefined;
  private lastPulseMs = 0;
  private tickAccumulator = 0;
  private lastRender: RenderWorldSnapshotDto | undefined;
  private lastFullSnapshotTick = -1;
  private commandChain: Promise<void> = Promise.resolve();
  private readonly ticksPerSecondAt1x: number;
  private readonly pulseIntervalMs: number;
  private readonly fullSnapshotEveryTicks: number;
  private readonly maxTicksPerPulse: number;

  constructor(
    private readonly adapter: SimulationRuntimeAdapter,
    private readonly emit: WorkerEmitter,
    options: WorkerRuntimeOptions = {}
  ) {
    this.ticksPerSecondAt1x = options.ticksPerSecondAt1x ?? 1;
    this.pulseIntervalMs = options.pulseIntervalMs ?? 50;
    this.fullSnapshotEveryTicks = options.fullSnapshotEveryTicks ?? 120;
    this.maxTicksPerPulse = options.maxTicksPerPulse ?? 500;
  }

  handle(raw: unknown): Promise<void> {
    const next = this.commandChain.then(() => this.handleSerial(raw));
    this.commandChain = next.catch(() => undefined);
    return next;
  }

  private async handleSerial(raw: unknown): Promise<void> {
    let message: UiToWorkerMessage;
    try {
      message = parseUiToWorkerMessage(raw);
    } catch (error) {
      this.emitError(undefined, "INVALID_PROTOCOL", error, true);
      return;
    }

    try {
      switch (message.type) {
        case "INIT":
          this.resetRenderStream();
          await this.adapter.init(message);
          this.emit({ type: "READY", requestId: message.requestId });
          this.emitFrame(true);
          break;
        case "LOAD_WORLD":
          this.resetRenderStream();
          await this.adapter.loadSnapshot(message.snapshot);
          this.emit({ type: "READY", requestId: message.requestId });
          this.emitFrame(true);
          break;
        case "START":
          this.start();
          this.emit({ type: "EVENT", event: { type: "runtime_started", requestId: message.requestId } });
          break;
        case "PAUSE":
          this.pause();
          this.emit({ type: "EVENT", event: { type: "runtime_paused", requestId: message.requestId } });
          break;
        case "SET_SPEED":
          this.speed = message.speed;
          this.emit({ type: "EVENT", event: { type: "speed_changed", speed: this.speed, requestId: message.requestId } });
          break;
        case "STEP":
          this.pause();
          this.adapter.step(message.ticks);
          this.emitFrame(false);
          break;
        case "USER_ACTION":
          this.adapter.applyUserAction(message.action);
          this.emit({ type: "EVENT", event: { type: "user_action_accepted", sequence: message.action.sequence, targetTick: message.action.targetTick } });
          break;
        case "REQUEST_ENTITY":
          this.emit({ type: "ENTITY_DETAILS", requestId: message.requestId, entityId: message.entityId, details: this.adapter.entityDetails(message.entityId) });
          break;
        case "REQUEST_STATS":
          this.emit({ type: "STATS", requestId: message.requestId, stats: this.adapter.stats() });
          break;
        case "SAVE_SNAPSHOT": {
          const result: Extract<WorkerToUiMessage, { type: "SAVE_RESULT" }> = {
            type: "SAVE_RESULT",
            requestId: message.requestId,
            snapshot: this.adapter.saveSnapshot()
          };
          if (message.title !== undefined) result.title = message.title;
          this.emit(result);
          break;
        }
      }
    } catch (error) {
      this.pause();
      this.emitError(message.requestId, "RUNTIME_ERROR", error, false);
    }
  }

  dispose(): void {
    this.pause();
  }

  private start(): void {
    if (this.running) return;
    this.running = true;
    this.lastPulseMs = this.now();
    this.timer = setInterval(() => this.pulse(), this.pulseIntervalMs);
  }

  private pause(): void {
    this.running = false;
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.tickAccumulator = 0;
  }

  private pulse(): void {
    if (!this.running) return;
    const now = this.now();
    const elapsedSeconds = Math.max(0, (now - this.lastPulseMs) / 1000);
    this.lastPulseMs = now;
    this.tickAccumulator += elapsedSeconds * this.ticksPerSecondAt1x * this.speed;
    const requested = Math.floor(this.tickAccumulator);
    if (requested <= 0) return;
    const ticks = Math.min(requested, this.maxTicksPerPulse);
    this.tickAccumulator -= ticks;
    try {
      this.adapter.step(ticks);
      this.emitFrame(false);
    } catch (error) {
      this.pause();
      this.emitError(undefined, "SIMULATION_STEP_FAILED", error, false);
    }
  }

  private emitFrame(forceFull: boolean): void {
    const next = this.adapter.renderSnapshot();
    const shouldFull = forceFull || !this.lastRender || next.tick - this.lastFullSnapshotTick >= this.fullSnapshotEveryTicks;
    if (shouldFull) {
      this.emit({ type: "WORLD_SNAPSHOT", snapshot: structuredClone(next) });
      this.lastFullSnapshotTick = next.tick;
    } else {
      this.emit({ type: "WORLD_DELTA", delta: diffRenderSnapshots(this.lastRender!, next) });
    }
    this.lastRender = structuredClone(next);
  }

  private resetRenderStream(): void {
    this.pause();
    this.lastRender = undefined;
    this.lastFullSnapshotTick = -1;
  }

  private emitError(requestId: string | undefined, code: string, error: unknown, recoverable: boolean): void {
    const message: Extract<WorkerToUiMessage, { type: "ERROR" }> = {
      type: "ERROR",
      code,
      message: error instanceof Error ? error.message : String(error),
      recoverable
    };
    if (requestId !== undefined) message.requestId = requestId;
    this.emit(message);
  }

  private now(): number {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
  }
}

export interface WorkerEndpoint {
  postMessage(message: WorkerToUiMessage): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
}

export function attachSimulationWorker(endpoint: WorkerEndpoint, adapter: SimulationRuntimeAdapter, options?: WorkerRuntimeOptions): SimulationWorkerRuntime {
  const runtime = new SimulationWorkerRuntime(adapter, (message) => endpoint.postMessage(message), options);
  endpoint.addEventListener("message", (event) => { void runtime.handle(event.data); });
  return runtime;
}

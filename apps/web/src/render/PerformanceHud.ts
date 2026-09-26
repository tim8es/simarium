import type { WebGLRenderer } from "three";
import type { RenderAdapterMetrics } from "@simarium/render-core";
import type { BenchmarkSceneMetrics } from "./BenchmarkScene";

const WARMUP_MS = 30_000;

export interface PerformanceSnapshot {
  fps: number;
  averageFrameMs: number;
  medianFrameMs: number;
  measuredFrames: number;
  measuredDurationMs: number;
  drawCalls: number;
  triangles: number;
  totalEntities: number;
  visibleEntities: number;
  animalMeshes: number;
  lod2Proxies: number;
  leafInstances: number;
  longTaskCount: number;
  maxLongTaskMs: number;
  measuring: boolean;
}

export class PerformanceHud {
  private readonly root: HTMLElement | null;
  private readonly note: HTMLElement | null;
  private readonly fields = new Map<string, HTMLElement>();
  private readonly frameSamples = new Float32Array(120);
  private frameCursor = 0;
  private frameCount = 0;
  private lastDomUpdate = 0;
  private longTaskCount = 0;
  private maxLongTaskMs = 0;
  private observer: PerformanceObserver | null = null;
  private readonly warmupEndsAt = performance.now() + WARMUP_MS;
  private measuring = false;
  private readonly measurementFrames: number[] = [];
  private measurementFrameSumMs = 0;
  private latestCounters = {
    drawCalls: 0,
    triangles: 0,
    totalEntities: 0,
    visibleEntities: 0,
    animalMeshes: 0,
    lod2Proxies: 0,
    leafInstances: 0
  };

  constructor(parent: HTMLElement | null) {
    this.root = parent ? document.createElement("section") : null;
    if (this.root) {
      this.root.className = "perf-hud";
      this.root.innerHTML = `<h1>Simarium Phase 8</h1><div class="perf-grid"></div><p class="perf-note">Synthetic renderer load · 30 s warm-up</p>`;
      parent!.appendChild(this.root);
    }
    this.note = this.root?.querySelector<HTMLElement>(".perf-note") ?? null;

    const grid = this.root?.querySelector(".perf-grid") ?? null;
    for (const key of [
      "FPS",
      "Frame",
      "Draw calls",
      "Triangles",
      "Entities",
      "Visible entities",
      "Animal meshes",
      "LOD2 proxies",
      "Leaf instances",
      "Long tasks"
    ]) {
      const row = document.createElement("div");
      const label = document.createElement("span");
      const value = document.createElement("strong");
      label.textContent = key;
      value.textContent = "—";
      row.append(label, value);
      grid?.appendChild(row);
      if (grid) this.fields.set(key, value);
    }

    if (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes.includes("longtask")) {
      this.observer = new PerformanceObserver((list) => {
        if (!this.measuring) return;
        for (const entry of list.getEntries()) {
          this.longTaskCount++;
          this.maxLongTaskMs = Math.max(this.maxLongTaskMs, entry.duration);
        }
      });
      this.observer.observe({ type: "longtask" });
    }
  }

  update(
    frameMs: number,
    renderer: WebGLRenderer,
    adapter: RenderAdapterMetrics,
    scene: BenchmarkSceneMetrics,
    nowMs: number
  ): void {
    if (!this.measuring && nowMs >= this.warmupEndsAt) {
      this.beginMeasurement();
    }

    this.frameSamples[this.frameCursor] = frameMs;
    this.frameCursor = (this.frameCursor + 1) % this.frameSamples.length;
    this.frameCount = Math.min(this.frameCount + 1, this.frameSamples.length);

    if (this.measuring) {
      this.measurementFrames.push(frameMs);
      this.measurementFrameSumMs += frameMs;
    }
    this.latestCounters = {
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      totalEntities: adapter.totalEntities,
      visibleEntities: scene.visibleEntityCount,
      animalMeshes: scene.visibleAnimalMeshCount,
      lod2Proxies: scene.farAnimalProxyCount,
      leafInstances: scene.plantLeafInstanceCount
    };

    if (nowMs - this.lastDomUpdate < 250) return;
    this.lastDomUpdate = nowMs;

    let sum = 0;
    for (let i = 0; i < this.frameCount; i++) sum += this.frameSamples[i]!;
    const averageFrameMs = this.frameCount > 0 ? sum / this.frameCount : 0;
    const fps = averageFrameMs > 0 ? 1000 / averageFrameMs : 0;

    this.set("FPS", fps.toFixed(1));
    this.set("Frame", `${averageFrameMs.toFixed(2)} ms`);
    this.set("Draw calls", String(renderer.info.render.calls));
    this.set("Triangles", renderer.info.render.triangles.toLocaleString());
    this.set("Entities", adapter.totalEntities.toLocaleString());
    this.set("Visible entities", scene.visibleEntityCount.toLocaleString());
    this.set("Animal meshes", scene.visibleAnimalMeshCount.toLocaleString());
    this.set("LOD2 proxies", scene.farAnimalProxyCount.toLocaleString());
    this.set("Leaf instances", scene.plantLeafInstanceCount.toLocaleString());

    if (this.measuring) {
      this.set("Long tasks", `${this.longTaskCount} · max ${this.maxLongTaskMs.toFixed(0)} ms`);
      if (this.note) {
        this.note.textContent = "Synthetic renderer load · steady-state measurement";
      }
    } else {
      const remainingSeconds = Math.max(0, Math.ceil((this.warmupEndsAt - nowMs) / 1000));
      this.set("Long tasks", "warm-up excluded");
      if (this.note) {
        this.note.textContent = `Synthetic renderer load · warm-up ${remainingSeconds}s`;
      }
    }
  }

  getSnapshot(): PerformanceSnapshot {
    const measuredFrames = this.measurementFrames.length;
    const averageFrameMs =
      measuredFrames > 0 ? this.measurementFrameSumMs / measuredFrames : 0;
    const sorted = measuredFrames > 0
      ? [...this.measurementFrames].sort((a, b) => a - b)
      : [];
    const middle = Math.floor(sorted.length / 2);
    const medianFrameMs =
      sorted.length === 0
        ? 0
        : sorted.length % 2 === 1
          ? sorted[middle]!
          : (sorted[middle - 1]! + sorted[middle]!) / 2;

    return {
      fps: averageFrameMs > 0 ? 1000 / averageFrameMs : 0,
      averageFrameMs,
      medianFrameMs,
      measuredFrames,
      measuredDurationMs: this.measurementFrameSumMs,
      ...this.latestCounters,
      longTaskCount: this.longTaskCount,
      maxLongTaskMs: this.maxLongTaskMs,
      measuring: this.measuring
    };
  }

  dispose(): void {
    this.observer?.disconnect();
    this.root?.remove();
  }

  private beginMeasurement(): void {
    this.measuring = true;
    this.frameSamples.fill(0);
    this.frameCursor = 0;
    this.frameCount = 0;
    this.longTaskCount = 0;
    this.maxLongTaskMs = 0;
    this.measurementFrames.splice(0, this.measurementFrames.length);
    this.measurementFrameSumMs = 0;
    this.lastDomUpdate = 0;
  }

  private set(key: string, value: string): void {
    const field = this.fields.get(key);
    if (field) field.textContent = value;
  }
}

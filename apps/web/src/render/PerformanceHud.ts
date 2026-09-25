import type { WebGLRenderer } from "three";
import type { RenderAdapterMetrics } from "@simarium/render-core";
import type { BenchmarkSceneMetrics } from "./BenchmarkScene";

export class PerformanceHud {
  private readonly root: HTMLElement;
  private readonly fields = new Map<string, HTMLElement>();
  private readonly frameSamples = new Float32Array(120);
  private frameCursor = 0;
  private frameCount = 0;
  private lastDomUpdate = 0;
  private longTaskCount = 0;
  private maxLongTaskMs = 0;
  private observer: PerformanceObserver | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("section");
    this.root.className = "perf-hud";
    this.root.innerHTML = `<h1>Simarium Phase 8</h1><div class="perf-grid"></div><p class="perf-note">Synthetic renderer load · WebGL2</p>`;
    parent.appendChild(this.root);

    const grid = this.root.querySelector(".perf-grid")!;
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
      grid.appendChild(row);
      this.fields.set(key, value);
    }

    if (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes.includes("longtask")) {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.longTaskCount++;
          this.maxLongTaskMs = Math.max(this.maxLongTaskMs, entry.duration);
        }
      });
      this.observer.observe({ type: "longtask", buffered: true });
    }
  }

  update(
    frameMs: number,
    renderer: WebGLRenderer,
    adapter: RenderAdapterMetrics,
    scene: BenchmarkSceneMetrics,
    nowMs: number
  ): void {
    this.frameSamples[this.frameCursor] = frameMs;
    this.frameCursor = (this.frameCursor + 1) % this.frameSamples.length;
    this.frameCount = Math.min(this.frameCount + 1, this.frameSamples.length);

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
    this.set("Long tasks", `${this.longTaskCount} · max ${this.maxLongTaskMs.toFixed(0)} ms`);
  }

  dispose(): void {
    this.observer?.disconnect();
    this.root.remove();
  }

  private set(key: string, value: string): void {
    const field = this.fields.get(key);
    if (field) field.textContent = value;
  }
}

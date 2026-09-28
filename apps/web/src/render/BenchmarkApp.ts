import {
  PCFSoftShadowMap,
  SRGBColorSpace,
  WebGLRenderer
} from "three";
import {
  RenderAdapter,
  type RenderWorldDelta,
  type RenderWorldSnapshot
} from "@simarium/render-core";
import {
  BenchmarkScene,
  type DynamicHardscapeEntry,
  type TemperatureGridProjection
} from "./BenchmarkScene";
import { CameraController, type CameraMode } from "./CameraController";
import { PerformanceHud } from "./PerformanceHud";
import { SyntheticBenchmarkSource } from "./SyntheticBenchmarkSource";

export interface BenchmarkAppOptions {
  showHud?: boolean;
  cameraMode?: CameraMode;
  sourceMode?: "synthetic" | "external";
  onEntitySelected?: (entityId: string) => void;
}

export class BenchmarkApp {
  private readonly renderer: WebGLRenderer;
  private readonly adapter = new RenderAdapter();
  private readonly source: SyntheticBenchmarkSource | null;
  private readonly benchmarkScene: BenchmarkScene;
  private readonly cameraController: CameraController;
  private readonly hud: PerformanceHud;
  private frameHandle = 0;
  private previousFrameMs = performance.now();
  private sourceAccumulator = 0;

  constructor(root: HTMLElement, options: BenchmarkAppOptions = {}) {
    const canvas = document.createElement("canvas");
    canvas.className = "benchmark-canvas";
    root.appendChild(canvas);

    const context = canvas.getContext("webgl2", {
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
    if (!context) throw new Error("Simarium rendering benchmark requires WebGL2");

    this.renderer = new WebGLRenderer({ canvas, context, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;

    this.source =
      options.sourceMode === "external" ? null : new SyntheticBenchmarkSource();
    if (this.source) this.adapter.applySnapshot(this.source.createSnapshot());
    this.benchmarkScene = new BenchmarkScene(this.adapter);
    if (this.source) this.benchmarkScene.initializeFromSnapshot();
    this.cameraController = new CameraController(canvas, this.adapter);
    if (this.source) {
      this.cameraController.setFollowTarget(this.source.focusTargetId);
    }
    this.cameraController.setMode(options.cameraMode ?? "orbit");
    this.hud = new PerformanceHud(options.showHud === false ? null : root);

    if (options.onEntitySelected) {
      canvas.addEventListener("click", (event) => {
        const entityId = this.benchmarkScene.pick(
          event.clientX,
          event.clientY,
          this.cameraController.camera,
          canvas
        );
        if (entityId) options.onEntitySelected?.(entityId);
      });
    }

    window.addEventListener("resize", this.onResize);
  }

  start(): void {
    this.previousFrameMs = performance.now();
    this.frameHandle = requestAnimationFrame(this.frame);
  }

  stop(): void {
    cancelAnimationFrame(this.frameHandle);
    window.removeEventListener("resize", this.onResize);
    this.hud.dispose();
    this.renderer.dispose();
  }

  setCameraMode(mode: CameraMode): void {
    this.cameraController.setMode(mode);
  }

  setFollowTarget(entityId: string): void {
    this.cameraController.setFollowTarget(entityId);
  }

  setDynamicHardscape(entries: readonly DynamicHardscapeEntry[]): void {
    this.benchmarkScene.setDynamicHardscape(entries);
  }

  setTemperatureGridOverlay(
    grid: TemperatureGridProjection | null,
    visible: boolean
  ): void {
    this.benchmarkScene.setTemperatureGridOverlay(grid, visible);
  }

  setBiologicalLight(lightPar: number, nightObservationAid: boolean): void {
    this.benchmarkScene.setBiologicalLight(lightPar, nightObservationAid);
  }

  setBioticGroundcover(
    litterCarbonMg: number,
    fungalCarbonMg: number,
    bacterialCarbonMg: number
  ): void {
    this.benchmarkScene.setBioticGroundcover(
      litterCarbonMg,
      fungalCarbonMg,
      bacterialCarbonMg
    );
  }

  applyExternalSnapshot(snapshot: RenderWorldSnapshot): void {
    if (this.source) {
      throw new Error("Cannot apply external snapshot in synthetic benchmark mode");
    }
    this.adapter.applySnapshot(snapshot);
    this.benchmarkScene.initializeFromSnapshot();
  }

  applyExternalDelta(delta: RenderWorldDelta): void {
    if (this.source) {
      throw new Error("Cannot apply external delta in synthetic benchmark mode");
    }
    this.adapter.applyDelta(delta);
  }

  getPerformanceSnapshot() {
    return this.hud.getSnapshot();
  }

  getRenderedEntityIds(): string[] {
    const ids: string[] = [];
    this.adapter.forEachRenderableEntity((entity) => ids.push(entity.id));
    return ids;
  }

  getAnimalPickTargets() {
    return this.benchmarkScene.getAnimalPickTargets(
      this.cameraController.camera,
      this.renderer.domElement
    );
  }

  private readonly onResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.cameraController.resize(width, height);
  };

  private readonly frame = (nowMs: number): void => {
    const rawFrameMs = Math.max(0, nowMs - this.previousFrameMs);
    const dtSeconds = Math.min(0.1, rawFrameMs / 1000);
    this.previousFrameMs = nowMs;

    if (this.source) {
      this.sourceAccumulator += dtSeconds;
      const sourceStep = 1 / 20;
      if (this.sourceAccumulator >= sourceStep) {
        this.adapter.applyDelta(this.source.step(this.sourceAccumulator));
        this.sourceAccumulator = 0;
      }
    }

    this.cameraController.update(dtSeconds);
    const sceneMetrics = this.benchmarkScene.update(
      this.cameraController.camera,
      dtSeconds
    );
    this.renderer.render(this.benchmarkScene.scene, this.cameraController.camera);
    this.hud.update(rawFrameMs, this.renderer, this.adapter.getMetrics(), sceneMetrics, nowMs);

    this.frameHandle = requestAnimationFrame(this.frame);
  };
}

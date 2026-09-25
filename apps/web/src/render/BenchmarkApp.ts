import {
  PCFSoftShadowMap,
  SRGBColorSpace,
  WebGLRenderer
} from "three";
import { RenderAdapter } from "@simarium/render-core";
import { BenchmarkScene } from "./BenchmarkScene";
import { CameraController, type CameraMode } from "./CameraController";
import { PerformanceHud } from "./PerformanceHud";
import { SyntheticBenchmarkSource } from "./SyntheticBenchmarkSource";

export class BenchmarkApp {
  private readonly renderer: WebGLRenderer;
  private readonly adapter = new RenderAdapter();
  private readonly source = new SyntheticBenchmarkSource();
  private readonly benchmarkScene: BenchmarkScene;
  private readonly cameraController: CameraController;
  private readonly hud: PerformanceHud;
  private frameHandle = 0;
  private previousFrameMs = performance.now();
  private sourceAccumulator = 0;

  constructor(root: HTMLElement) {
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

    this.adapter.applySnapshot(this.source.createSnapshot());
    this.benchmarkScene = new BenchmarkScene(this.adapter);
    this.benchmarkScene.initializeFromSnapshot();
    this.cameraController = new CameraController(canvas, this.adapter);
    this.cameraController.setFollowTarget(this.source.focusTargetId);
    this.cameraController.setMode("orbit");
    this.hud = new PerformanceHud(root);

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

    this.sourceAccumulator += dtSeconds;
    const sourceStep = 1 / 20;
    if (this.sourceAccumulator >= sourceStep) {
      this.adapter.applyDelta(this.source.step(this.sourceAccumulator));
      this.sourceAccumulator = 0;
    }

    this.cameraController.update(dtSeconds);
    const sceneMetrics = this.benchmarkScene.update(this.cameraController.camera);
    this.renderer.render(this.benchmarkScene.scene, this.cameraController.camera);
    this.hud.update(rawFrameMs, this.renderer, this.adapter.getMetrics(), sceneMetrics, nowMs);

    this.frameHandle = requestAnimationFrame(this.frame);
  };
}

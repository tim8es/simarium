import "./style.css";
import { BenchmarkApp } from "./render/BenchmarkApp";
import type { CameraMode } from "./render/CameraController";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app root");

const params = new URLSearchParams(window.location.search);
const recording = params.get("record") === "1";
const requestedCamera = params.get("camera");
const cameraMode: CameraMode =
  requestedCamera === "free" ||
  requestedCamera === "macro" ||
  requestedCamera === "follow"
    ? requestedCamera
    : "orbit";

const app = new BenchmarkApp(root, {
  showHud: !recording,
  cameraMode
});
app.start();

const controls = document.querySelector<HTMLElement>(".camera-controls");
if (recording && controls) controls.hidden = true;

Object.defineProperty(window, "__SIMARIUM_BENCHMARK_METRICS__", {
  configurable: true,
  get: () => app.getPerformanceSnapshot()
});

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-camera-mode]")) {
  if (recording) continue;
  button.addEventListener("click", () => {
    const mode = button.dataset.cameraMode as CameraMode | undefined;
    if (!mode) return;
    app.setCameraMode(mode);
    for (const peer of document.querySelectorAll<HTMLButtonElement>("[data-camera-mode]")) {
      peer.classList.toggle("active", peer === button);
    }
  });
}

window.addEventListener("beforeunload", () => app.stop(), { once: true });

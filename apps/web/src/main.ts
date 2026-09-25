import "./style.css";
import { BenchmarkApp } from "./render/BenchmarkApp";
import type { CameraMode } from "./render/CameraController";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app root");

const app = new BenchmarkApp(root);
app.start();

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-camera-mode]")) {
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

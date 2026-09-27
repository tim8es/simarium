import "./style.css";
import "./styles.css";
import { BenchmarkApp } from "./render/BenchmarkApp.js";
import type { CameraMode } from "./render/CameraController.js";
import { mockObservationSnapshot as snapshot } from "./mock-data.js";
import type {
  ObservationUiState,
  OverlayKey,
  UserActionType
} from "./contracts.js";
import {
  renderBottomPanel,
  renderEntityCard,
  renderGenealogy,
  renderOverlayPanel,
  renderTimeControls,
  renderViewport,
  renderWhyPanel
} from "./components.js";
import { createUserAction } from "./view-model.js";

const appRoot = document.querySelector<HTMLElement>("#app");
const renderRoot = document.querySelector<HTMLElement>("#render-layer");
const cameraControls = document.querySelector<HTMLElement>(
  "#benchmark-camera-controls"
);
if (!appRoot || !renderRoot || !cameraControls) {
  throw new Error("Missing Simarium application roots");
}

const params = new URLSearchParams(window.location.search);
const recording = params.get("record") === "1";
const benchmarkOnly = recording || params.get("benchmark") === "1";
const requestedCamera = params.get("camera");
const cameraMode: CameraMode =
  requestedCamera === "free" ||
  requestedCamera === "macro" ||
  requestedCamera === "follow"
    ? requestedCamera
    : "orbit";

const renderer = new BenchmarkApp(renderRoot, {
  showHud: benchmarkOnly && !recording,
  cameraMode
});
renderer.start();

Object.defineProperty(window, "__SIMARIUM_BENCHMARK_METRICS__", {
  configurable: true,
  get: () => renderer.getPerformanceSnapshot()
});

if (benchmarkOnly) {
  document.body.classList.add("benchmark-mode");
  appRoot.hidden = true;
  cameraControls.hidden = recording;

  for (const button of cameraControls.querySelectorAll<HTMLButtonElement>(
    "[data-camera-mode]"
  )) {
    if (recording) continue;
    button.classList.toggle("active", button.dataset.cameraMode === cameraMode);
    button.addEventListener("click", () => {
      const mode = button.dataset.cameraMode as CameraMode | undefined;
      if (!mode) return;
      renderer.setCameraMode(mode);
      for (const peer of cameraControls.querySelectorAll<HTMLButtonElement>(
        "[data-camera-mode]"
      )) {
        peer.classList.toggle("active", peer === button);
      }
    });
  }
} else {
  document.body.classList.add("integrated-mode");
  cameraControls.hidden = true;

  let state: ObservationUiState = {
    paused: false,
    speed: 1,
    selectedEntityId: 1042,
    activeOverlay: null,
    bottomPanel: "graphs",
    userActions: []
  };

  const selectedEntity = () =>
    snapshot.entities.find(entity => entity.id === state.selectedEntityId);

  const renderUi = (): void => {
    const selected = selectedEntity();
    const action =
      selected?.kind === "animal" ? selected.currentAction : "GROW";
    const inspection =
      selected !== undefined
        ? snapshot.inspectionByEntity[selected.id]
        : undefined;

    appRoot.innerHTML = `
      <div class="observation-shell">
        <header class="top-bar">
          <div class="brand">
            <div class="brand-mark">S</div>
            <div>
              <strong>SIMARIUM</strong>
              <span>Living terrarium · renderer benchmark + synthetic observation feed</span>
            </div>
          </div>
          ${renderTimeControls(state)}
          <div class="telemetry-strip">
            <span><small>TEMP</small><strong>${snapshot.environment.temperatureC.toFixed(1)}°</strong></span>
            <span><small>RH</small><strong>${Math.round(snapshot.environment.relativeHumidity * 100)}%</strong></span>
            <span><small>CO₂</small><strong>${snapshot.environment.co2Ppm.toFixed(0)}</strong></span>
          </div>
        </header>

        <div class="workspace">
          <aside class="left-rail">
            ${renderOverlayPanel(snapshot, state)}
          </aside>

          <div class="viewport-stack">
            ${renderViewport(snapshot, state)}
            ${renderBottomPanel(snapshot, state)}
          </div>

          <aside class="right-rail">
            ${renderEntityCard(selected)}
            ${renderWhyPanel(inspection?.why ?? [], action)}
            ${renderGenealogy(inspection?.genealogy ?? [])}
          </aside>
        </div>
      </div>
    `;
  };

  const setState = (patch: Partial<ObservationUiState>): void => {
    state = { ...state, ...patch };
    renderUi();
  };

  appRoot.addEventListener("click", event => {
    const target = event.target as HTMLElement;
    const entityButton = target.closest<HTMLElement>("[data-entity-id]");
    if (entityButton?.dataset.entityId) {
      setState({ selectedEntityId: Number(entityButton.dataset.entityId) });
      return;
    }

    if (target.closest<HTMLElement>("[data-command='pause']")) {
      setState({ paused: !state.paused });
      return;
    }

    const speedButton = target.closest<HTMLElement>("[data-speed]");
    if (speedButton?.dataset.speed) {
      const speed = Number(
        speedButton.dataset.speed
      ) as ObservationUiState["speed"];
      setState({ speed, paused: false });
      return;
    }

    const overlayButton = target.closest<HTMLElement>("[data-overlay]");
    if (overlayButton?.dataset.overlay) {
      const overlay = overlayButton.dataset.overlay as OverlayKey;
      setState({
        activeOverlay: state.activeOverlay === overlay ? null : overlay
      });
      return;
    }

    const tabButton = target.closest<HTMLElement>("[data-bottom-tab]");
    if (tabButton?.dataset.bottomTab) {
      setState({
        bottomPanel:
          tabButton.dataset.bottomTab as ObservationUiState["bottomPanel"]
      });
      return;
    }

    const actionButton = target.closest<HTMLElement>("[data-user-action]");
    if (actionButton?.dataset.userAction) {
      const type = actionButton.dataset.userAction as UserActionType;
      const userAction = createUserAction(type, {
        uiMode: "synthetic-demo"
      });
      setState({
        userActions: [...state.userActions, userAction]
      });
    }
  });

  renderUi();
}

window.addEventListener(
  "beforeunload",
  () => renderer.stop(),
  { once: true }
);

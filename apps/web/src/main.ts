import "./style.css";
import "./styles.css";
import type { JsonValue, SimulationSpeed, UserAction as RuntimeUserAction } from "../../../packages/sim-runtime/src/index.js";
import { BenchmarkApp } from "./render/BenchmarkApp.js";
import type { CameraMode } from "./render/CameraController.js";
import { SimulationClient } from "./runtime/SimulationClient.js";
import {
  emptyObservationSnapshot,
  entityDetailsToUi,
  hardscapeFromStats,
  statsToObservation
} from "./runtime/observation.js";
import type {
  EntityInspection,
  EntitySummary,
  ObservationSnapshot,
  ObservationUiState,
  OverlayKey,
  UserAction,
  UserActionType
} from "./contracts.js";
import {
  renderBottomPanel,
  renderEntityCard,
  renderEntityHistory,
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
const initialCameraMode: CameraMode =
  requestedCamera === "free" ||
  requestedCamera === "macro" ||
  requestedCamera === "follow"
    ? requestedCamera
    : "orbit";

if (benchmarkOnly) {
  document.body.classList.add("benchmark-mode");
  appRoot.hidden = true;
  cameraControls.hidden = recording;

  const renderer = new BenchmarkApp(renderRoot, {
    showHud: !recording,
    cameraMode: initialCameraMode,
    sourceMode: "synthetic"
  });
  renderer.start();

  Object.defineProperty(window, "__SIMARIUM_BENCHMARK_METRICS__", {
    configurable: true,
    get: () => renderer.getPerformanceSnapshot()
  });

  for (const button of cameraControls.querySelectorAll<HTMLButtonElement>(
    "[data-camera-mode]"
  )) {
    if (recording) continue;
    button.classList.toggle(
      "active",
      button.dataset.cameraMode === initialCameraMode
    );
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

  window.addEventListener(
    "beforeunload",
    () => renderer.stop(),
    { once: true }
  );
} else {
  document.body.classList.add("integrated-mode");
  cameraControls.hidden = true;

  const defaultSeed = Number(params.get("seed") ?? 7001);
  let snapshot: ObservationSnapshot = emptyObservationSnapshot();
  let selectedEntity: EntitySummary | undefined;
  let selectedInspection: EntityInspection | undefined;
  const runtimeActionIds = new Map<number, string>();

  let state: ObservationUiState = {
    paused: false,
    speed: 1,
    selectedEntityId: null,
    activeOverlay: null,
    bottomPanel: "graphs",
    userActions: [],
    cameraMode: initialCameraMode,
    seed: Number.isInteger(defaultSeed) ? defaultSeed : 7001,
    runtimeStatus: "starting",
    runtimeMessage: "Creating deterministic Phase 7 world…",
    nightObservationAid: false
  };

  const renderer = new BenchmarkApp(renderRoot, {
    showHud: false,
    cameraMode: state.cameraMode,
    sourceMode: "external",
    onEntitySelected: (entityId) => {
      selectEntity(entityId);
    }
  });
  renderer.start();

  const client = new SimulationClient();

  const setState = (
    patch: Partial<ObservationUiState>,
    rerender = true
  ): void => {
    state = { ...state, ...patch };
    if (rerender) renderUi();
  };

  const setActionStatus = (
    id: string,
    status: UserAction["status"]
  ): void => {
    setState({
      userActions: state.userActions.map((action) =>
        action.id === id ? { ...action, status } : action
      )
    });
  };

  const renderUi = (): void => {
    const currentAction =
      selectedEntity?.kind === "animal"
        ? selectedEntity.currentAction
        : selectedEntity
          ? "grow"
          : "observe";

    appRoot.innerHTML = `
      <div class="observation-shell">
        <header class="top-bar">
          <div class="brand">
            <div class="brand-mark">S</div>
            <div>
              <strong>SIMARIUM</strong>
              <span>Live deterministic Phase 7 ecosystem · seed ${state.seed}</span>
            </div>
          </div>
          ${renderTimeControls(state)}
          <div class="live-camera-controls" aria-label="Camera modes">
            ${(["orbit", "free", "macro", "follow"] as const).map(mode => `
              <button data-live-camera="${mode}" class="${state.cameraMode === mode ? "is-active" : ""}">${mode}</button>
            `).join("")}
          </div>
          <div class="world-actions">
            <button data-world-command="night-aid" class="${state.nightObservationAid ? "is-active" : ""}">Night aid</button>
            <button data-world-command="step">+1 tick</button>
            <button data-world-command="new">New</button>
            <button data-world-command="save">Save</button>
            <button data-world-command="load">Load latest</button>
            <button data-world-command="export">Export save</button>
            <button data-world-command="import">Import save</button>
            <button data-world-command="share">Share seed</button>
          </div>
          <div class="telemetry-strip">
            <span><small>TEMP</small><strong>${snapshot.environment.temperatureC.toFixed(1)}°</strong></span>
            <span><small>RH*</small><strong>${Math.round(snapshot.environment.relativeHumidity * 100)}%</strong></span>
            <span><small>CO₂*</small><strong>${snapshot.environment.co2Ppm.toFixed(0)}</strong></span>
          </div>
        </header>

        <div class="runtime-banner ${state.runtimeStatus}">
          <strong>${state.runtimeStatus.toUpperCase()}</strong>
          <span>${state.runtimeMessage ?? "Worker connected"}</span>
          ${state.saveMessage ? `<em>${state.saveMessage}</em>` : ""}
        </div>

        <div class="workspace">
          <aside class="left-rail">
            ${renderOverlayPanel(snapshot, state)}
          </aside>

          <div class="viewport-stack">
            ${renderViewport(snapshot, state)}
            ${renderBottomPanel(snapshot, state)}
          </div>

          <aside class="right-rail">
            ${renderEntityCard(selectedEntity)}
            ${renderWhyPanel(selectedInspection?.why ?? [], currentAction)}
            ${renderEntityHistory(selectedInspection?.history ?? [])}
            ${renderGenealogy(selectedInspection?.genealogy ?? [])}
          </aside>
        </div>
      </div>
    `;
  };

  function selectEntity(entityId: string): void {
    setState({ selectedEntityId: entityId }, false);
    renderer.setFollowTarget(entityId);
    client.requestEntity(entityId);
    renderUi();
  }

  function promptNumber(
    label: string,
    defaultValue: number,
    minimum = 0
  ): number | null {
    const raw = window.prompt(label, String(defaultValue));
    if (raw === null) return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < minimum) {
      setState({
        runtimeStatus: "error",
        runtimeMessage: `Invalid value: ${raw}`
      });
      return null;
    }
    return value;
  }

  function interventionFor(type: UserActionType): RuntimeUserAction | null {
    switch (type) {
      case "MIST_WATER": {
        const waterG = promptNumber("Water to add (g)", 5);
        return waterG === null ? null : { type: "add_water", waterG };
      }
      case "ADD_LITTER": {
        const carbonMg = promptNumber("Dry litter carbon input (mg C)", 100);
        if (carbonMg === null) return null;
        return {
          type: "add_litter",
          material: {
            carbonMg,
            nitrogenMg: carbonMg * 0.02,
            phosphorusMg: carbonMg * 0.002,
            waterG: carbonMg * 0.005
          }
        };
      }
      case "INTRODUCE_ORGANISM": {
        const speciesId = window.prompt(
          "Species ID",
          selectedEntity?.speciesId ?? "folsomia_candida"
        );
        if (!speciesId) return null;
        const count = promptNumber("Count", 1, 1);
        if (count === null) return null;
        return {
          type: "introduce_organisms",
          speciesId,
          count: Math.max(1, Math.floor(count))
        };
      }
      case "REMOVE_ORGANISM":
        if (!state.selectedEntityId) {
          setState({
            runtimeStatus: "error",
            runtimeMessage: "Select an organism before removing it."
          });
          return null;
        }
        return {
          type: "remove_organisms",
          entityIds: [state.selectedEntityId]
        };
      case "CHANGE_LIGHT": {
        const intensity = promptNumber(
          "Light multiplier (0 = dark, 1 = preset, 2 = double)",
          1
        );
        return intensity === null ? null : { type: "set_light", intensity };
      }
      case "CHANGE_VENTILATION": {
        const ratePerSecond = promptNumber(
          "Ventilation exchange rate per second (0 = sealed)",
          0.00001
        );
        return ratePerSecond === null
          ? null
          : { type: "set_ventilation", ratePerSecond };
      }
      case "PLACE_HARDSCAPE": {
        const kind = window.prompt("Hardscape kind", "wood");
        if (!kind) return null;
        const id = `hardscape-${Date.now().toString(36)}`;
        return {
          type: "add_hardscape",
          hardscapeId: id,
          kind,
          position: { x: 0, y: 0.14, z: 0 }
        };
      }
      case "REMOVE_HARDSCAPE": {
        const hardscapeId = window.prompt("Hardscape ID to remove");
        return hardscapeId
          ? { type: "remove_hardscape", hardscapeId }
          : null;
      }
      case "PLANT_RAMET": {
        const speciesId = window.prompt(
          "Plant species ID",
          selectedEntity?.kind === "plant"
            ? selectedEntity.speciesId
            : "fittonia_albivenis"
        );
        if (!speciesId) return null;
        return {
          type: "introduce_organisms",
          speciesId,
          count: 1,
          lifeStage: "ramet"
        };
      }
    }
  }

  function dispatchIntervention(type: UserActionType): void {
    const runtimeAction = interventionFor(type);
    if (!runtimeAction) return;
    const uiAction = createUserAction(type, {
      live: true,
      seed: state.seed
    });
    const sequence = client.userAction(runtimeAction);
    runtimeActionIds.set(sequence, uiAction.id);
    setState({
      userActions: [...state.userActions, uiAction],
      runtimeStatus: state.paused ? "paused" : "running",
      runtimeMessage: `Queued ${type} at current simulation tick`
    });
  }

  client.hooks.onSnapshot = (renderSnapshot) => {
    renderer.applyExternalSnapshot(renderSnapshot);
  };
  client.hooks.onDelta = (delta) => {
    renderer.applyExternalDelta(delta);
  };
  client.hooks.onStats = (stats: JsonValue) => {
    try {
      snapshot = statsToObservation(stats);
      renderer.setDynamicHardscape(hardscapeFromStats(stats));
      renderer.setBiologicalLight(
        snapshot.environment.lightPar,
        state.nightObservationAid
      );
      renderer.setTemperatureGridOverlay(
        snapshot.temperatureGrid,
        state.activeOverlay === "temperature"
      );
      if (state.selectedEntityId) {
        client.requestEntity(state.selectedEntityId);
      }
      renderUi();
    } catch (error) {
      setState({
        runtimeStatus: "error",
        runtimeMessage:
          error instanceof Error ? error.message : String(error)
      });
    }
  };
  client.hooks.onEntityDetails = (entityId, details) => {
    try {
      const projected = entityDetailsToUi(details);
      if (state.selectedEntityId === entityId) {
        selectedEntity = projected.entity;
        selectedInspection = projected.inspection;
        snapshot = {
          ...snapshot,
          entities: [projected.entity],
          inspectionByEntity: {
            [entityId]: projected.inspection
          }
        };
        renderUi();
      }
    } catch (error) {
      setState({
        runtimeStatus: "error",
        runtimeMessage:
          error instanceof Error ? error.message : String(error)
      });
    }
  };
  client.hooks.onEvent = (event) => {
    if (
      event &&
      typeof event === "object" &&
      !Array.isArray(event) &&
      event.type === "user_action_accepted" &&
      typeof event.sequence === "number"
    ) {
      const actionId = runtimeActionIds.get(event.sequence);
      if (actionId) {
        runtimeActionIds.delete(event.sequence);
        setActionStatus(actionId, "accepted");
      }
    }
  };
  client.hooks.onError = (message) => {
    setState({
      runtimeStatus: "error",
      runtimeMessage: message
    });
  };
  client.hooks.onReady = () => {
    setState({
      runtimeStatus: state.paused ? "paused" : "running",
      runtimeMessage: "Phase 7 worker ready"
    });
  };

  appRoot.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;

    if (target.closest<HTMLElement>("[data-command='pause']")) {
      if (state.paused) {
        client.start();
        setState({
          paused: false,
          runtimeStatus: "running",
          runtimeMessage: "Simulation running"
        });
      } else {
        client.pause();
        setState({
          paused: true,
          runtimeStatus: "paused",
          runtimeMessage: "Simulation paused"
        });
      }
      return;
    }

    const speedButton = target.closest<HTMLElement>("[data-speed]");
    if (speedButton?.dataset.speed) {
      const speed = Number(speedButton.dataset.speed) as SimulationSpeed;
      client.setSpeed(speed);
      if (state.paused) client.start();
      setState({
        speed,
        paused: false,
        runtimeStatus: "running",
        runtimeMessage: `Simulation speed ${speed}×`
      });
      return;
    }

    const cameraButton = target.closest<HTMLElement>("[data-live-camera]");
    if (cameraButton?.dataset.liveCamera) {
      const mode = cameraButton.dataset.liveCamera as CameraMode;
      renderer.setCameraMode(mode);
      setState({ cameraMode: mode });
      return;
    }

    const worldButton = target.closest<HTMLElement>("[data-world-command]");
    if (worldButton?.dataset.worldCommand) {
      const command = worldButton.dataset.worldCommand;
      if (command === "night-aid") {
        const nightObservationAid = !state.nightObservationAid;
        renderer.setBiologicalLight(
          snapshot.environment.lightPar,
          nightObservationAid
        );
        setState({
          nightObservationAid,
          runtimeMessage: nightObservationAid
            ? "Visual night observation aid enabled (no biological light added)"
            : "Visual night observation aid disabled"
        });
      } else if (command === "step") {
        client.step(1);
        setState({
          paused: true,
          runtimeStatus: "paused",
          runtimeMessage: "Advanced one 30-minute ecology tick"
        });
      } else if (command === "new") {
        const rawSeed = window.prompt("Deterministic seed", String(state.seed));
        if (rawSeed !== null) {
          const seed = Number(rawSeed);
          if (Number.isInteger(seed)) {
            selectedEntity = undefined;
            selectedInspection = undefined;
            snapshot = emptyObservationSnapshot();
            setState({
              seed,
              selectedEntityId: null,
              paused: false,
              speed: 1,
              runtimeStatus: "starting",
              runtimeMessage: "Creating new world at Day 0…"
            });
            void client.reset(seed).then(() => client.setSpeed(1)).catch(error => {
              setState({
                runtimeStatus: "error",
                runtimeMessage: error instanceof Error ? error.message : String(error)
              });
            });
          }
        }
      } else if (command === "save") {
        setState({ saveMessage: "Saving…" });
        void client.save("Manual save", `manual-${Date.now().toString(36)}`)
          .then(id => setState({ saveMessage: `Saved: ${id}` }))
          .catch(error => setState({
            runtimeStatus: "error",
            runtimeMessage: error instanceof Error ? error.message : String(error)
          }));
      } else if (command === "export") {
        setState({ saveMessage: "Exporting snapshot…" });
        void client.captureSnapshot("Portable export")
          .then(exported => {
            const blob = new Blob(
              [JSON.stringify(exported, null, 2)],
              { type: "application/json" }
            );
            const href = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = href;
            anchor.download = `simarium-seed-${exported.seed}-tick-${exported.tick}.json`;
            anchor.click();
            URL.revokeObjectURL(href);
            setState({ saveMessage: "Portable save exported" });
          })
          .catch(error => setState({
            runtimeStatus: "error",
            runtimeMessage: error instanceof Error ? error.message : String(error)
          }));
      } else if (command === "import") {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json,.json";
        input.addEventListener("change", () => {
          const file = input.files?.[0];
          if (!file) return;
          setState({ saveMessage: `Importing ${file.name}…` });
          void file.text()
            .then(text => JSON.parse(text) as unknown)
            .then(value => client.loadSnapshot(value, `import-${Date.now().toString(36)}`))
            .then(loaded => {
              selectedEntity = undefined;
              selectedInspection = undefined;
              setState({
                seed: loaded.seed,
                selectedEntityId: null,
                paused: false,
                runtimeStatus: "running",
                runtimeMessage: `Imported deterministic save at day ${(loaded.virtualTime / 86400).toFixed(1)}`,
                saveMessage: "Portable save imported"
              });
            })
            .catch(error => setState({
              runtimeStatus: "error",
              runtimeMessage: error instanceof Error ? error.message : String(error)
            }));
        }, { once: true });
        input.click();
      } else if (command === "share") {
        const url = new URL(window.location.href);
        url.search = "";
        url.searchParams.set("seed", String(state.seed));
        void navigator.clipboard.writeText(url.toString())
          .then(() => setState({ saveMessage: "Seed link copied" }))
          .catch(() => setState({ saveMessage: url.toString() }));
      } else if (command === "load") {
        setState({ saveMessage: "Loading latest save…" });
        void client.loadLatest()
          .then(loaded => {
            if (!loaded) {
              setState({ saveMessage: "No saved world found" });
              return;
            }
            selectedEntity = undefined;
            selectedInspection = undefined;
            setState({
              seed: loaded.seed,
              selectedEntityId: null,
              saveMessage: "Loaded latest save",
              runtimeStatus: "running",
              runtimeMessage: `Loaded deterministic save at day ${(loaded.virtualTime / 86400).toFixed(1)}`,
              paused: false
            });
          })
          .catch(error => setState({
            runtimeStatus: "error",
            runtimeMessage: error instanceof Error ? error.message : String(error)
          }));
      }
      return;
    }

    const overlayButton = target.closest<HTMLElement>("[data-overlay]");
    if (overlayButton?.dataset.overlay) {
      const overlay = overlayButton.dataset.overlay as OverlayKey;
      const activeOverlay = state.activeOverlay === overlay ? null : overlay;
      renderer.setTemperatureGridOverlay(
        snapshot.temperatureGrid,
        activeOverlay === "temperature"
      );
      setState({ activeOverlay });
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
      dispatchIntervention(
        actionButton.dataset.userAction as UserActionType
      );
    }
  });

  renderUi();
  void client.initialize(state.seed)
    .then(() => client.setSpeed(state.speed))
    .catch((error) => {
      setState({
        runtimeStatus: "error",
        runtimeMessage: error instanceof Error ? error.message : String(error)
      });
    });

  window.addEventListener(
    "beforeunload",
    () => {
      client.dispose();
      renderer.stop();
    },
    { once: true }
  );
}

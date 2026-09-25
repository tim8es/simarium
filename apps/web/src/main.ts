import { mockObservationSnapshot as snapshot } from "./mock-data.js";
import type { ObservationUiState, OverlayKey, UserActionType } from "./contracts.js";
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

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app");
const app: HTMLElement = root;

let state: ObservationUiState = {
  paused: false,
  speed: 1,
  selectedEntityId: 1042,
  activeOverlay: null,
  bottomPanel: "graphs",
  userActions: []
};

function selectedEntity() {
  return snapshot.entities.find(entity => entity.id === state.selectedEntityId);
}

function render(): void {
  const selected = selectedEntity();
  const action = selected?.kind === "animal" ? selected.currentAction : "GROW";
  app.innerHTML = `
    <div class="observation-shell">
      <header class="top-bar">
        <div class="brand">
          <div class="brand-mark">S</div>
          <div><strong>SIMARIUM</strong><span>Living terrarium · synthetic observation feed</span></div>
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
          ${renderWhyPanel(snapshot.why, action)}
          ${renderGenealogy(snapshot.genealogy)}
        </aside>
      </div>
    </div>
  `;
}

function setState(patch: Partial<ObservationUiState>): void {
  state = { ...state, ...patch };
  render();
}

app.addEventListener("click", event => {
  const target = event.target as HTMLElement;
  const entityButton = target.closest<HTMLElement>("[data-entity-id]");
  if (entityButton?.dataset.entityId) {
    setState({ selectedEntityId: Number(entityButton.dataset.entityId) });
    return;
  }

  const pauseButton = target.closest<HTMLElement>("[data-command='pause']");
  if (pauseButton) {
    setState({ paused: !state.paused });
    return;
  }

  const speedButton = target.closest<HTMLElement>("[data-speed]");
  if (speedButton?.dataset.speed) {
    const speed = Number(speedButton.dataset.speed) as ObservationUiState["speed"];
    setState({ speed, paused: false });
    return;
  }

  const overlayButton = target.closest<HTMLElement>("[data-overlay]");
  if (overlayButton?.dataset.overlay) {
    const overlay = overlayButton.dataset.overlay as OverlayKey;
    setState({ activeOverlay: state.activeOverlay === overlay ? null : overlay });
    return;
  }

  const tabButton = target.closest<HTMLElement>("[data-bottom-tab]");
  if (tabButton?.dataset.bottomTab) {
    setState({ bottomPanel: tabButton.dataset.bottomTab as ObservationUiState["bottomPanel"] });
    return;
  }

  const actionButton = target.closest<HTMLElement>("[data-user-action]");
  if (actionButton?.dataset.userAction) {
    const type = actionButton.dataset.userAction as UserActionType;
    const action = createUserAction(type, { uiMode: "synthetic-demo" });
    setState({ userActions: [...state.userActions, action] });
  }
});

render();

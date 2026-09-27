import type {
  BehaviorReason,
  CausalHistoryEvent,
  EntitySummary,
  GenealogyNode,
  ObservationSnapshot,
  ObservationUiState,
  OverlayKey,
  PopulationSeries,
  UserActionType
} from "./contracts.js";
import { formatAge, formatPercent, getEntityAgeSeconds, getOverlayValue } from "./view-model.js";

const overlayLabels: ReadonlyArray<[OverlayKey, string]> = [
  ["temperature", "Temperature"],
  ["humidity", "Humidity"],
  ["soilWater", "Soil water"],
  ["light", "Light"],
  ["co2", "CO₂"],
  ["o2", "O₂"],
  ["nh4", "NH₄"],
  ["no3", "NO₃"],
  ["availableP", "Available P"],
  ["fungalBiomass", "Fungal biomass"],
  ["bacterialBiomass", "Bacterial biomass"],
  ["litter", "Litter"]
];

const actionLabels: ReadonlyArray<[UserActionType, string, string]> = [
  ["MIST_WATER", "Mist / water", "Boundary intervention"],
  ["ADD_LITTER", "Add litter", "Material input"],
  ["INTRODUCE_ORGANISM", "Introduce organism", "Population intervention"],
  ["REMOVE_ORGANISM", "Remove organism", "Population intervention"],
  ["CHANGE_LIGHT", "Change light", "Boundary condition"],
  ["CHANGE_VENTILATION", "Change ventilation", "Boundary condition"],
  ["PLACE_HARDSCAPE", "Place hardscape", "Habitat geometry"],
  ["REMOVE_HARDSCAPE", "Remove hardscape", "Habitat geometry"],
  ["PLANT_RAMET", "Plant new ramet", "Population intervention"]
];

export function renderTimeControls(state: ObservationUiState): string {
  const speeds = [1, 5, 20, 100] as const;
  return `
    <div class="time-controls" aria-label="Simulation time controls">
      <button class="control-button pause-button ${state.paused ? "is-active" : ""}" data-command="pause" aria-pressed="${state.paused}">
        ${state.paused ? "▶" : "Ⅱ"}
      </button>
      ${speeds.map(speed => `
        <button class="control-button ${!state.paused && state.speed === speed ? "is-active" : ""}" data-speed="${speed}" aria-pressed="${!state.paused && state.speed === speed}">
          ${speed}×
        </button>
      `).join("")}
    </div>
  `;
}

export function renderOverlayPanel(snapshot: ObservationSnapshot, state: ObservationUiState): string {
  return `
    <section class="glass-panel overlay-panel" aria-label="Scientific overlays">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">ENVIRONMENT</span>
          <h2>Scientific overlays</h2>
        </div>
        <span class="status-dot" title="Live worker simulation state"></span>
      </div>
      <div class="overlay-grid">
        ${overlayLabels.map(([key, label]) => `
          <button class="overlay-chip ${state.activeOverlay === key ? "is-active" : ""}" data-overlay="${key}">
            <span>${label}</span>
            <strong>${getOverlayValue(snapshot.environment, key)}</strong>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function metric(label: string, value: string): string {
  return `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`;
}

function displayEntityId(id: string): string {
  const index = id.lastIndexOf("#");
  return index >= 0 ? id.slice(index + 1) : id;
}

export function renderEntityCard(entity: EntitySummary | undefined): string {
  if (!entity) {
    return `
      <section class="glass-panel entity-card empty-card">
        <span class="eyebrow">INSPECTION</span>
        <h2>No organism selected</h2>
        <p>Select a visible organism in the viewport to inspect its current snapshot.</p>
      </section>
    `;
  }

  const animalMetrics = entity.kind === "animal"
    ? [
        metric("Biomass", `${entity.biomassMg.toFixed(2)} mg`),
        metric("Reserve / energy", formatPercent(entity.reserveEnergy)),
        metric("Hydration", formatPercent(entity.hydration)),
        metric("Action", entity.currentAction),
        metric("Target", entity.currentTarget ?? "—"),
        metric("Birth time", `day ${(entity.birthTimeSeconds / 86400).toFixed(1)}`),
        metric("Parent IDs", entity.parentIds.length ? entity.parentIds.map(displayEntityId).join(", ") : "—"),
        metric("Offspring", String(entity.offspringCount)),
        metric("Reproductive state", entity.reproductiveState),
        ...(entity.deathCause ? [metric("Death cause", entity.deathCause)] : [])
      ]
    : [
        metric("Biomass", `${(entity.biomassMg / 1000).toFixed(2)} g`),
        metric("Water status", formatPercent(entity.waterStatus)),
        metric("Nutrient limit", entity.nutrientLimitation.toUpperCase()),
        metric("Parent ramet", entity.parentRametId ? displayEntityId(entity.parentRametId) : "—"),
        metric("Offspring ramets", entity.offspringRametIds.length ? entity.offspringRametIds.map(displayEntityId).join(", ") : "—")
      ];

  return `
    <section class="glass-panel entity-card" data-entity-id="${entity.id}" data-entity-kind="${entity.kind}">
      <div class="entity-header">
        <div class="entity-mark ${entity.kind}"></div>
        <div>
          <span class="eyebrow">SELECTED · #${displayEntityId(entity.id)}</span>
          <h2>${entity.commonName}</h2>
          <em>${entity.scientificName}</em>
        </div>
      </div>
      <div class="entity-stage-row">
        <span class="stage-pill">${entity.lifeStage}</span>
        <span>${formatAge(getEntityAgeSeconds(entity))}</span>
      </div>
      <div class="metric-grid">${animalMetrics.join("")}</div>
    </section>
  `;
}

export function renderWhyPanel(reasons: ReadonlyArray<BehaviorReason>, action: string): string {
  return `
    <section class="glass-panel why-panel">
      <div class="panel-heading compact">
        <div>
          <span class="eyebrow">STATE TRACE</span>
          <h2>Why?</h2>
        </div>
        <strong class="decision-arrow">→ ${action}</strong>
      </div>
      <div class="reason-list">
        ${reasons.length
          ? reasons.map(reason => `
            <div class="reason-row">
              <div class="reason-copy"><span>${reason.label}</span><strong>${reason.score.toFixed(2)}</strong></div>
              <div class="reason-track"><i style="width:${Math.round(reason.score * 100)}%"></i></div>
            </div>
          `).join("")
          : "<p class=\"inspection-unavailable\">No behavior trace available for this entity.</p>"}
      </div>
    </section>
  `;
}


export function renderEntityHistory(
  events: ReadonlyArray<CausalHistoryEvent>
): string {
  const rows = events.slice(-12).reverse().map((event) => {
    const day = event.timeSeconds / 86400;
    return `
      <div class="history-row">
        <span>day ${day.toFixed(1)}</span>
        <strong>${event.type}</strong>
        <small>${event.label}</small>
      </div>
    `;
  }).join("");
  return `
    <section class="glass-panel history-panel">
      <div class="panel-heading compact">
        <div><span class="eyebrow">CAUSAL HISTORY</span><h2>Entity events</h2></div>
      </div>
      <div class="history-list">
        ${rows || '<p class="inspection-unavailable">No recorded events for this entity.</p>'}
      </div>
    </section>
  `;
}

export function renderGenealogy(nodes: ReadonlyArray<GenealogyNode>): string {
  const parent = nodes.find(node => node.relation === "parent");
  const current = nodes.find(node => node.relation === "current");
  const offspring = nodes.filter(node => node.relation === "offspring");
  const node = (item: GenealogyNode | undefined, relation: string) => item
    ? `<div class="lineage-node ${item.relation}" data-entity-id="${item.entityId}"><span>${relation}</span><strong>${item.label}</strong><small>${item.lifeStage}</small></div>`
    : `<div class="lineage-node muted"><span>${relation}</span><strong>unknown</strong></div>`;

  return `
    <section class="glass-panel genealogy-panel">
      <div class="panel-heading compact"><div><span class="eyebrow">LINEAGE</span><h2>Genealogy</h2></div></div>
      <div class="lineage-flow">
        ${node(parent, "parent")}
        <span class="lineage-connector">↓</span>
        ${node(current, "current")}
        <span class="lineage-connector">↓</span>
        <div class="offspring-row">${offspring.map(child => node(child, "offspring")).join("") || node(undefined, "offspring")}</div>
      </div>
    </section>
  `;
}

function sparkline(series: PopulationSeries): string {
  const values = series.points.map(point => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const times = series.points.map(point => point.timeSeconds);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const timeSpan = Math.max(1, maxTime - minTime);
  const points = series.points.map(point => {
    const x = ((point.timeSeconds - minTime) / timeSpan) * 100;
    const y = 36 - ((point.value - min) / span) * 30;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const latest = values.at(-1) ?? 0;
  return `
    <div class="series-row" data-species-id="${series.speciesId}" data-point-count="${series.points.length}" data-latest="${latest}">
      <div class="series-label"><span>${series.label}</span><strong>${latest}</strong></div>
      <svg class="sparkline" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="${points}"></polyline>
      </svg>
    </div>
  `;
}

export function renderGraphs(snapshot: ObservationSnapshot): string {
  return `
    <div class="bottom-content graph-content">
      <div class="graph-summary">
        <span class="eyebrow">POPULATION BY SPECIES</span>
        <p>Daily samples from the live simulation</p>
      </div>
      <div class="series-grid">${snapshot.populations.map(sparkline).join("")}</div>
      <div class="future-metrics" aria-label="Prepared graph contracts">
        <span>Births / deaths</span><span>Plant biomass</span><span>Decomposition</span>
        <span>Predation</span><span>Resource pools</span>
      </div>
    </div>
  `;
}

export function renderFoodWeb(snapshot: ObservationSnapshot): string {
  const speciesById = new Map(snapshot.species.map(species => [species.id, species]));
  const involvedIds = [...new Set(
    snapshot.foodWeb.flatMap(link => [link.sourceSpeciesId, link.targetSpeciesId])
  )];
  const maxTransfer = Math.max(
    1,
    ...snapshot.foodWeb.map(link => link.biomassTransferMg)
  );

  return `
    <div class="bottom-content foodweb-content">
      <div class="foodweb-diagram" aria-label="Food web">
        <div class="web-node-grid">
          ${involvedIds.map(id => {
            const species = speciesById.get(id);
            const predator = species?.trophicRole === "predator" ? " predator" : "";
            return `<span class="web-node${predator}" data-species-id="${id}">${species?.commonName ?? id}</span>`;
          }).join("")}
        </div>
        <div class="web-edge-list">
          ${snapshot.foodWeb.map(link => {
            const thickness = 1 + (link.biomassTransferMg / maxTransfer) * 5;
            const source = speciesById.get(link.sourceSpeciesId)?.commonName ?? link.sourceSpeciesId;
            const target = speciesById.get(link.targetSpeciesId)?.commonName ?? link.targetSpeciesId;
            return `
              <div class="web-edge" data-source="${link.sourceSpeciesId}" data-target="${link.targetSpeciesId}" data-biomass-mg="${link.biomassTransferMg}">
                <i style="height:${thickness.toFixed(1)}px"></i>
                <span>${source} → ${target}</span>
              </div>
            `;
          }).join("")}
        </div>
      </div>
      <div class="transfer-list">
        ${snapshot.foodWeb.map(link => `
          <div><span>${speciesById.get(link.sourceSpeciesId)?.commonName ?? link.sourceSpeciesId} → ${speciesById.get(link.targetSpeciesId)?.commonName ?? link.targetSpeciesId}</span><strong>${link.biomassTransferMg} mg</strong></div>
        `).join("")}
      </div>
    </div>
  `;
}


function renderProfiler(snapshot: ObservationSnapshot): string {
  const p = snapshot.runtimeProfiler;
  return `
    <div class="bottom-content profiler-content">
      <div class="resource-grid">
        ${metric("Worker", p.running ? "running" : "paused")}
        ${metric("Speed", `${p.speed}×`)}
        ${metric("Last step", `${p.lastStepWallMs.toFixed(2)} ms / ${p.lastStepTicks} ticks`)}
        ${metric("EMA step", `${p.emaStepWallMs.toFixed(2)} ms`)}
        ${metric("Avg / tick", `${p.averageWallMsPerTick.toFixed(3)} ms`)}
        ${metric("Backlog", `${p.backlogTicks.toFixed(2)} ticks`)}
        ${metric("Max backlog", `${p.maxObservedBacklogTicks.toFixed(2)} ticks`)}
        ${metric("Frames emitted", String(p.framesEmitted))}
      </div>
      <div class="ledger-panel">
        <div class="panel-heading compact">
          <div><span class="eyebrow">WORKER PROFILER</span><h2>Simulation runtime</h2></div>
        </div>
        <p class="ledger-note">
          Wall-clock telemetry is diagnostic only. It is not serialized into the deterministic world and cannot change ecology results.
        </p>
      </div>
    </div>
  `;
}

export function renderActions(state: ObservationUiState): string {
  return `
    <div class="bottom-content actions-content">
      <div class="action-grid">
        ${actionLabels.map(([type, label, caption]) => `
          <button class="action-card" data-user-action="${type}">
            <span class="action-plus">+</span>
            <strong>${label}</strong>
            <small>${caption}</small>
          </button>
        `).join("")}
      </div>
      <div class="action-log">
        <span class="eyebrow">USER_ACTION QUEUE</span>
        ${state.userActions.length === 0
          ? "<p>No UI-side mutations. Actions are emitted to the simulation boundary.</p>"
          : state.userActions.slice(-4).reverse().map(action => `<div data-action-type="${action.type}" ${typeof action.payload.hardscapeId === "string" ? `data-hardscape-id="${action.payload.hardscapeId}"` : ""}><code>${action.source}</code><span>${action.type}</span><strong>${action.status}</strong></div>`).join("")
        }
      </div>
    </div>
  `;
}

function renderResources(snapshot: ObservationSnapshot): string {
  const r = snapshot.resources;
  const ledger = snapshot.materialLedger;
  const residualRows = Object.entries(ledger.residuals).map(([key, value]) => `
    <div class="ledger-row">
      <span>${key}</span>
      <strong>${value.actual.toPrecision(6)}</strong>
      <small>Δ ${value.residual.toExponential(2)} / tol ${value.tolerance.toExponential(2)}</small>
    </div>
  `).join("");
  return `
    <div class="bottom-content resource-content">
      <div class="resource-grid">
        ${metric("Available N", `${r.availableNitrogenMg.toFixed(3)} mg`)}
        ${metric("Available P", `${r.availablePhosphorusMg.toFixed(3)} mg`)}
        ${metric("Litter C", `${r.litterCarbonMg.toFixed(1)} mg`)}
        ${metric("Fungal C", `${r.fungalCarbonMg.toFixed(2)} mg`)}
        ${metric("Bacterial C", `${r.bacterialCarbonMg.toFixed(2)} mg`)}
        ${metric("Corpse C", `${r.corpseCarbonMg.toFixed(3)} mg`)}
        <div class="metric boundary-flux" data-boundary-carbon-mg="${ledger.cumulativeBoundaryFlux.carbonMg}" data-boundary-nitrogen-mg="${ledger.cumulativeBoundaryFlux.nitrogenMg}" data-boundary-phosphorus-mg="${ledger.cumulativeBoundaryFlux.phosphorusMg}" data-boundary-water-g="${ledger.cumulativeBoundaryFlux.waterG}">
          <span>Boundary flux</span>
          <strong>C ${ledger.cumulativeBoundaryFlux.carbonMg.toFixed(2)} mg · H₂O ${ledger.cumulativeBoundaryFlux.waterG.toFixed(3)} g</strong>
        </div>
      </div>
      <div class="ledger-panel">
        <div class="panel-heading compact">
          <div><span class="eyebrow">MATERIAL LEDGER</span><h2>Conservation residuals</h2></div>
        </div>
        ${residualRows}
        <p class="ledger-note">Boundary flux is explicit and included in each expected total.</p>
      </div>
    </div>
  `;
}

function renderEvents(snapshot: ObservationSnapshot): string {
  const speciesById = new Map(snapshot.species.map(species => [species.id, species.commonName]));
  const ids = [...new Set([
    ...Object.keys(snapshot.events.births),
    ...Object.keys(snapshot.events.deaths)
  ])];
  return `
    <div class="bottom-content event-content">
      <div class="event-summary">
        <span class="eyebrow">CAUSAL EVENTS</span>
        <strong>${snapshot.events.predation} predation events</strong>
      </div>
      <div class="event-table">
        <div class="event-table-head"><span>Species</span><span>Born / ever</span><span>Deaths</span></div>
        ${ids.map(id => `
          <div class="event-table-row">
            <span>${speciesById.get(id) ?? id}</span>
            <strong>${snapshot.events.births[id] ?? 0}</strong>
            <strong>${snapshot.events.deaths[id] ?? 0}</strong>
          </div>
        `).join("")}
      </div>
      <div class="event-browser" aria-label="Recent causal events">
        <span class="eyebrow">RECENT EVENT STREAM</span>
        ${snapshot.events.recent.slice(0, 40).map(event => `
          <div class="event-browser-row">
            <span>day ${(event.timeSeconds / 86400).toFixed(1)}</span>
            <strong>${speciesById.get(event.speciesId) ?? event.speciesId}</strong>
            <code>${event.type}</code>
            <small>${event.label}</small>
          </div>
        `).join("") || '<p class="inspection-unavailable">No events recorded yet.</p>'}
      </div>
    </div>
  `;
}

export function renderBottomPanel(snapshot: ObservationSnapshot, state: ObservationUiState): string {
  const content = state.bottomPanel === "graphs"
    ? renderGraphs(snapshot)
    : state.bottomPanel === "foodWeb"
      ? renderFoodWeb(snapshot)
      : state.bottomPanel === "resources"
        ? renderResources(snapshot)
        : state.bottomPanel === "events"
          ? renderEvents(snapshot)
          : state.bottomPanel === "profiler"
            ? renderProfiler(snapshot)
            : renderActions(state);
  return `
    <section class="glass-panel bottom-panel">
      <div class="bottom-tabs" role="tablist">
        <button data-bottom-tab="graphs" class="${state.bottomPanel === "graphs" ? "is-active" : ""}">Graphs</button>
        <button data-bottom-tab="foodWeb" class="${state.bottomPanel === "foodWeb" ? "is-active" : ""}">Food web</button>
        <button data-bottom-tab="resources" class="${state.bottomPanel === "resources" ? "is-active" : ""}">Resources</button>
        <button data-bottom-tab="events" class="${state.bottomPanel === "events" ? "is-active" : ""}">Events</button>
        <button data-bottom-tab="profiler" class="${state.bottomPanel === "profiler" ? "is-active" : ""}">Profiler</button>
        <button data-bottom-tab="actions" class="${state.bottomPanel === "actions" ? "is-active" : ""}">Interventions</button>
      </div>
      ${content}
    </section>
  `;
}

export function renderViewport(snapshot: ObservationSnapshot, state: ObservationUiState): string {
  const totalSeconds = Math.max(0, Math.floor(snapshot.environment.timeSeconds));
  const day = Math.floor(totalSeconds / 86400);
  const timeOfDay = totalSeconds % 86400;
  const hours = Math.floor(timeOfDay / 3600);
  const minutes = Math.floor((timeOfDay % 3600) / 60);
  const clock = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  const cameraLabel = state.cameraMode.toUpperCase();
  return `
    <section class="viewport" data-active-overlay="${state.activeOverlay ?? "none"}" aria-label="Live terrarium viewport">
      <div class="viewport-label top-left"><span>OBSERVATION CAMERA</span><strong>${cameraLabel}</strong></div>
      <div class="viewport-label top-right"><span>WORLD TIME</span><strong>DAY ${day} · ${clock}</strong></div>
      <div class="scale-marker"><i></i><span>10 cm</span></div>
      ${state.activeOverlay ? `<div class="overlay-legend"><span>${overlayLabels.find(([key]) => key === state.activeOverlay)?.[1] ?? state.activeOverlay}</span><div class="legend-bar"></div><small>low</small><small>high</small></div>` : ""}
    </section>
  `;
}

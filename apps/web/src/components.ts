import type {
  BehaviorReason,
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
        <span class="status-dot" title="Synthetic snapshot"></span>
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
        metric("Parent IDs", entity.parentIds.length ? entity.parentIds.map(id => `#${id}`).join(", ") : "—"),
        metric("Offspring", String(entity.offspringCount)),
        ...(entity.deathCause ? [metric("Death cause", entity.deathCause)] : [])
      ]
    : [
        metric("Biomass", `${(entity.biomassMg / 1000).toFixed(2)} g`),
        metric("Water status", formatPercent(entity.waterStatus)),
        metric("Nutrient limit", entity.nutrientLimitation.toUpperCase()),
        metric("Parent ramet", entity.parentRametId ? `#${entity.parentRametId}` : "—"),
        metric("Offspring ramets", entity.offspringRametIds.length ? entity.offspringRametIds.map(id => `#${id}`).join(", ") : "—")
      ];

  return `
    <section class="glass-panel entity-card">
      <div class="entity-header">
        <div class="entity-mark ${entity.kind}"></div>
        <div>
          <span class="eyebrow">SELECTED · #${entity.id}</span>
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
          <span class="eyebrow">UTILITY TRACE</span>
          <h2>Why?</h2>
        </div>
        <strong class="decision-arrow">→ ${action}</strong>
      </div>
      <div class="reason-list">
        ${reasons.map(reason => `
          <div class="reason-row">
            <div class="reason-copy"><span>${reason.label}</span><strong>${reason.score.toFixed(2)}</strong></div>
            <div class="reason-track"><i style="width:${Math.round(reason.score * 100)}%"></i></div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

export function renderGenealogy(nodes: ReadonlyArray<GenealogyNode>): string {
  const parent = nodes.find(node => node.relation === "parent");
  const current = nodes.find(node => node.relation === "current");
  const offspring = nodes.filter(node => node.relation === "offspring");
  const node = (item: GenealogyNode | undefined, relation: string) => item
    ? `<div class="lineage-node ${item.relation}"><span>${relation}</span><strong>${item.label}</strong><small>${item.lifeStage}</small></div>`
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
  const points = values.map((value, index) => {
    const x = (index / Math.max(1, values.length - 1)) * 100;
    const y = 36 - ((value - min) / span) * 30;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const latest = values.at(-1) ?? 0;
  return `
    <div class="series-row">
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
        <p>12-day synthetic window</p>
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
  const names = new Map(snapshot.species.map(species => [species.id, species.commonName]));
  return `
    <div class="bottom-content foodweb-content">
      <div class="foodweb-diagram" aria-label="Food web">
        <div class="web-column producers"><span class="web-node">Plants</span><span class="web-node">Litter</span></div>
        <div class="web-links"><i></i><i></i><i></i></div>
        <div class="web-column consumers"><span class="web-node">Fungi</span><span class="web-node">Springtails</span><span class="web-node predator">Rove beetle</span></div>
      </div>
      <div class="transfer-list">
        ${snapshot.foodWeb.map(link => `
          <div><span>${names.get(link.sourceSpeciesId) ?? link.sourceSpeciesId} → ${names.get(link.targetSpeciesId) ?? link.targetSpeciesId}</span><strong>${link.biomassTransferMg} mg</strong></div>
        `).join("")}
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
          : state.userActions.slice(-4).reverse().map(action => `<div><code>${action.source}</code><span>${action.type}</span><strong>${action.status}</strong></div>`).join("")
        }
      </div>
    </div>
  `;
}

export function renderBottomPanel(snapshot: ObservationSnapshot, state: ObservationUiState): string {
  const content = state.bottomPanel === "graphs"
    ? renderGraphs(snapshot)
    : state.bottomPanel === "foodWeb"
      ? renderFoodWeb(snapshot)
      : renderActions(state);
  return `
    <section class="glass-panel bottom-panel">
      <div class="bottom-tabs" role="tablist">
        <button data-bottom-tab="graphs" class="${state.bottomPanel === "graphs" ? "is-active" : ""}">Graphs</button>
        <button data-bottom-tab="foodWeb" class="${state.bottomPanel === "foodWeb" ? "is-active" : ""}">Food web</button>
        <button data-bottom-tab="actions" class="${state.bottomPanel === "actions" ? "is-active" : ""}">Interventions</button>
      </div>
      ${content}
    </section>
  `;
}

export function renderViewport(snapshot: ObservationSnapshot, state: ObservationUiState): string {
  const selected = state.selectedEntityId;
  return `
    <section class="viewport" data-active-overlay="${state.activeOverlay ?? "none"}" aria-label="Terrarium viewport placeholder">
      <div class="terrarium-glass"></div>
      <div class="light-cone"></div>
      <div class="back-haze"></div>
      <div class="hardscape rock-a"></div>
      <div class="hardscape wood-a"></div>
      <div class="plant-cluster cluster-a"><i></i><i></i><i></i><i></i><i></i></div>
      <div class="plant-cluster cluster-b"><i></i><i></i><i></i><i></i></div>
      <div class="soil-layer"></div>
      <button class="organism springtail ${selected === 1042 ? "is-selected" : ""}" data-entity-id="1042" aria-label="Select springtail 1042"><span></span></button>
      <button class="organism beetle ${selected === 2007 ? "is-selected" : ""}" data-entity-id="2007" aria-label="Select rove beetle 2007"><span></span></button>
      <button class="organism ramet ${selected === 501 ? "is-selected" : ""}" data-entity-id="501" aria-label="Select Fittonia ramet 501"><span></span></button>
      <div class="viewport-label top-left"><span>OBSERVATION CAMERA</span><strong>MACRO · 65 mm</strong></div>
      <div class="viewport-label top-right"><span>WORLD TIME</span><strong>DAY ${Math.floor(snapshot.environment.timeSeconds / 86400)} · 13:24</strong></div>
      <div class="scale-marker"><i></i><span>10 cm</span></div>
      ${state.activeOverlay ? `<div class="overlay-legend"><span>${overlayLabels.find(([key]) => key === state.activeOverlay)?.[1] ?? state.activeOverlay}</span><div class="legend-bar"></div><small>low</small><small>high</small></div>` : ""}
    </section>
  `;
}

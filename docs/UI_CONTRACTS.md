# Simarium — Observation UI contracts

Status: Phase 11/12 preparatory UI contract  
Implementation: `apps/web`  
Authority: UI is observational and command-emitting only.

## Boundary rule

The browser UI does not own ecological truth. It consumes read-only observation DTOs and emits commands/actions to a simulation boundary.

The initial implementation uses a synthetic adapter so UI development is independent of Phase 8/9 renderer and worker bridge work.

## Required DTOs

Defined in `apps/web/src/contracts.ts`:

- `SpeciesSummary` — stable species identity and trophic role for presentation.
- `EntitySummary` — discriminated animal/plant inspection DTO. It is not a sim-core entity class.
- `EnvironmentSnapshot` — low-frequency observation values used by scientific overlays.
- `PopulationSeries` — chart-ready time/value points grouped by species.
- `GenealogyNode` — compact lineage node for parent → current → offspring inspection.
- `UserAction` — UI-emitted intervention envelope.
- `ObservationSnapshot` — demo/read-model aggregate for the story screen.

The DTOs intentionally do not import lifecycle systems, entity stores, Three.js objects, or ecology classes.

## High-frequency versus inspection data

The UI contract follows `ARCHITECTURE.md` and `RENDERING.md`:

- transforms/animation state should arrive in compact render snapshots;
- genealogy, causal history and full inspection metadata should be requested or updated at lower frequency;
- render visibility/LOD must not alter ecological state.

The synthetic demo currently co-locates those values in one object only to make the standalone screen easy to develop. A real worker adapter should split render-frame and inspection channels.

## USER_ACTION contract

Build/intervention affordances never mutate snapshot data in the UI.

Current action types:

- `MIST_WATER`
- `ADD_LITTER`
- `INTRODUCE_ORGANISM`
- `REMOVE_ORGANISM`
- `CHANGE_LIGHT`
- `CHANGE_VENTILATION`
- `PLACE_HARDSCAPE`
- `PLANT_RAMET`

Each control creates a queued object with `source: "USER_ACTION"`. A future worker bridge should translate this envelope into the normative `USER_ACTION` worker message and wait for authoritative state/event feedback.

## Time controls

The UI exposes pause, 1×, 5×, 20× and 100×. In the synthetic screen these update display state only. The Phase 9 adapter should map them to `PAUSE` / `START` / `SET_SPEED` worker protocol messages.

## Selection

The demo viewport contains synthetic pick targets. The Phase 9 renderer bridge should provide entity IDs from picking and feed the same `selectedEntityId` state. Entity inspection remains keyed by ID rather than renderer object references.

## Scientific overlays

The UI currently supports controls for:

temperature, humidity, soil water, light, CO2, O2, NH4, NO3, available P, fungal biomass, bacterial biomass and litter.

The CSS viewport only provides an overlay legend in the synthetic demo. Renderer-specific heatmap implementation belongs to the render layer and should consume the selected `OverlayKey`.

## Graph and food-web preparation

The graph panel consumes `PopulationSeries`. The screen visibly reserves additional graph domains for births/deaths, plant biomass, decomposition, predation and resource pools.

Food-web rows consume species IDs plus biomass-transfer values. Line thickness should be derived from actual transferred biomass over a selected time window when telemetry is connected.

## Responsive behavior

Desktop is primary. Below approximately 920 px:

- viewport remains first;
- scientific controls move below it;
- inspection cards become a grid;
- panels stack at narrow mobile widths.

No layout change alters simulation or selection contracts.

## Local development

```bash
npm install
npm run web:dev
```

Production verification:

```bash
npm test
npm run build
```

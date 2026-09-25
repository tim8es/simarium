# Simarium — Implementation plan

Status: execution plan  
Principle: simulation correctness before visual polish.

## Phase 0 — Specification and evidence

**Status: COMPLETE for Phase 1 entry. Species parameterization continues per-phase.**

Goal: make the model implementable without hidden biological invention.

### Deliverables
- [x] MVP_SPEC.md
- [x] SIMULATION_MODEL.md
- [x] WORLD_MODEL.md
- [x] ARCHITECTURE.md
- [x] SPECIES_DATA_MODEL.md
- [x] VALIDATION.md
- [x] RENDERING.md
- [x] ASSUMPTIONS.md
- [x] machine-readable species database skeleton
- [x] parameter evidence backlog/table contract
- [x] preset specification
- [x] runtime schemas/unit validation

### Exit gate
No runtime-critical parameter may remain an undocumented magic number.

## Phase 1 — Headless conservation kernel

**Status: COMPLETE — CI run 36143633327 passed tests, build and 365-day headless acceptance on commit `7b724fce31f586b4166c943acf74dc89f2c08b6e`.**

Goal: create a deterministic world with material pools but no organisms.

Implement:
- fixed clock/scheduler;
- seeded RNG;
- C/N/P/H2O ledgers;
- transfer API;
- environmental grids;
- boundary conditions;
- save/load state;
- invariant checker;
- headless CLI.

Tests:
- exact/near-exact conservation;
- deterministic replay;
- diffusion conservation;
- water flows;
- serialization round-trip.

### Exit gate
Run 365 virtual days of empty/environment world with zero invariant failures.

## Phase 2 — Producer + detritus loop

**Status: COMPLETE — engineering gate passed; final coefficient calibration remains a Phase 7 validation concern.**

Goal:
```text
light -> plant -> litter -> microbial decomposition -> available nutrients -> plant
```

Implement one plant first:
- *Fittonia albivenis*.

Then:
- leaf cohorts;
- photosynthesis;
- respiration;
- allocation;
- uptake;
- senescence;
- litter.

Implement:
- fungal field;
- bacterial field;
- decomposition;
- mineralization.

### Exit gate
A nutrient tracer from old leaf litter appears in later new plant tissue without hidden injection.

Only after that add:
- *Peperomia caperata*;
- *Pilea depressa*.

## Phase 3 — First animal lifecycle

**Status: COMPLETE — engineering gate passed in CI run 36145748523.**

Goal: prove individual life, feeding, reproduction and death.

Implement *Folsomia candida*:
- individual IDs;
- stage development;
- fungal/resource feeding;
- metabolism;
- hydration;
- parthenogenesis;
- death;
- corpse cycle;
- genealogy.

### Exit gate
A multi-generation population exists in a sealed headless chamber and all offspring biomass is traceable to existing world pools.

## Phase 4 — Detritivore

Implement *Trichorhina tomentosa*:
- litter habitat;
- detrital feeding;
- fragmentation;
- moisture preference;
- reproduction;
- stage/age turnover.

### Exit gate
Compare litter decomposition with and without isopods; difference must come from modeled feeding/fragmentation, not special-case rate multipliers.

## Phase 5 — Fungus gnat

Implement *Bradysia impatiens*:
- egg;
- larva;
- pupa;
- adult;
- substrate larval movement;
- fungal/root feeding;
- adult flight;
- mating;
- oviposition.

### Exit gate
Complete multiple generations under suitable conditions and fail naturally when lifecycle requirements are removed.

## Phase 6 — Predator

Implement *Dalotia coriaria*:
- sensing;
- substrate navigation;
- prey selection;
- capture probability;
- prey consumption;
- development;
- mating/reproduction;
- starvation.

### Exit gate
Predation changes prey dynamics through real encounters; predator cannot survive indefinitely without prey/resources.

## Phase 7 — Full headless ecosystem

Combine all approved species.

Implement:
- batch runner;
- metrics export;
- population graphs;
- mass tracer;
- sensitivity analysis;
- calibration tooling.

Run:
- smoke set;
- calibration set;
- validation set;
- stress set.

### Exit gate
Pass VALIDATION.md MVP acceptance gates without rescue rules.

## Phase 8 — Rendering benchmark

Before real art, build synthetic visuals:
- terrarium shell;
- environmental lighting;
- dense placeholder vegetation;
- 300 moving animal proxies;
- macro camera;
- instancing/LOD.

### Exit gate
Target browser hardware demonstrates acceptable frame rate and no main-thread stalls.

## Phase 9 — Simulation-to-render bridge

Implement:
- worker protocol;
- snapshot buffers;
- interpolation;
- selection/picking;
- entity inspection;
- animation-state mapping.

### Exit gate
Turning rendering on/off does not change deterministic ecology results.

## Phase 10 — Species assets and terrarium visuals

Create/obtain documented species-specific assets.

Order:
1. hardscape/substrate;
2. plants;
3. *F. candida*;
4. *T. tomentosa*;
5. *B. impatiens* stages;
6. *D. coriaria* stages;
7. decay/fungal visuals.

### Exit gate
Species are recognizable, correctly scaled and LOD-ready.

## Phase 11 — Observation UX

Implement:
- orbit/free/macro/follow camera;
- minimal HUD;
- entity card;
- "Why?" behavior explanation;
- genealogy;
- history events;
- time controls;
- day/night view.

### Exit gate
A user can follow one post-start individual from birth through feeding/reproduction/death and inspect its causal history.

## Phase 12 — Scientific/debug UX

Implement:
- population charts;
- food-web flows;
- environmental heatmaps;
- resource ledger;
- invariant residuals;
- event browser;
- simulation profiler.

### Exit gate
A developer can diagnose extinction/resource drift without opening a debugger.

## Phase 13 — Persistence and offline-ready browser build

Implement:
- IndexedDB;
- autosave;
- save versioning;
- migration policy;
- deterministic load/resume.

### Exit gate
Reloading the browser resumes the same world without mass/state discontinuity.

## Phase 14 — Final MVP validation

Run final:
- deterministic regression suite;
- 180/365-day ecosystem batches;
- browser performance benchmark;
- save/load stress tests;
- long unattended browser session.

Release only if no P0 invariant, persistence or lifecycle issue remains.

---

# Parallel work policy

Safe to parallelize:
- biological source collection;
- renderer benchmark;
- asset exploration;
- UI prototypes;
- test tooling.

Do not parallelize ahead of missing contracts:
- species logic before data schema;
- ecosystem calibration before single-species validation;
- visual polish before render benchmark;
- save migrations before schema/versioning exists.

# Definition of implementation-ready

Coding a phase is allowed only when:
1. required upstream document exists;
2. data needed by the phase is not TBD at runtime-critical points;
3. acceptance test is written;
4. invariant effects are known;
5. expected telemetry is defined.

# Immediate next work

1. Parameterize and implement *Trichorhina tomentosa* detritivore lifecycle (Phase 4).
2. Validate litter fragmentation and decomposition acceleration without a hard-coded global decomposition bonus.
3. Parameterize and implement *Bradysia impatiens* lifecycle (Phase 5).
4. Add *Dalotia coriaria* predator/prey encounters (Phase 6).
5. Combine all species in the Phase 7 headless ecosystem before detailed Three.js art.

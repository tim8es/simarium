# Simarium — MVP technical specification

Version: 0.2  
Status: reviewed concept specification  
Platform: browser  
Primary goal: autonomous, observable, lightweight 3D micro-ecosystem

## 1. Product definition

Simarium is a browser-based 3D terrarium simulator. Its core is an agent- and resource-based ecosystem simulation. The visual scene must be a consequence of the simulation rather than a scripted animation layer.

The MVP models a deliberately small set of real species and completes the following causal loop:

```text
light
  -> plant photosynthesis and growth
  -> living plant tissue + litter + root exudates
  -> fungal/bacterial decomposition
  -> detritivores / microarthropods
  -> predators
  -> death + waste
  -> detritus
  -> microbial mineralization
  -> mineral nutrients
  -> plants
```

Water also circulates between substrate, organisms, surfaces and air.

The system is materially closed in Sealed Mode except for deliberately configured boundary conditions. Energy enters primarily as light.

## 2. Important correction to the original concept

A literal simulation of "all the same forces and laws as a real tropical forest" is not computationally realistic for an MVP. Simarium must instead preserve the causal mechanisms that dominate the terrarium-scale outcome:

- gravity;
- temperature;
- humidity;
- light;
- soil water;
- gas exchange;
- plant carbon gain and respiration;
- organism metabolism;
- consumption;
- reproduction;
- mortality;
- decomposition;
- carbon/nitrogen/phosphorus transfer;
- local competition and predation.

The simulation should not pretend to resolve molecular chemistry, full fluid dynamics, cellular plant physiology, every microorganism or every individual soil pore.

## 3. Biological scope

### 3.1 MVP is a constructed tropical terrarium

The initial MVP is not a strict geographic biotope. It uses real species that are compatible with warm, humid terrarium conditions and together provide a tractable trophic network.

A later Biotope Mode may require all species to be sympatric and native to one defined locality.

### 3.2 Real species rule

No placeholder organisms such as "predatory beetle", "small fern", "phytophage" or "fungus pool" may appear as user-facing biological entities.

Every explicit living taxon must have:
- accepted scientific name;
- taxonomic authority/source;
- common name where one exists;
- life stages;
- diet/resources;
- temperature/humidity response;
- reproduction model;
- mortality model;
- source references.

Functional aggregates are allowed only for non-organism physical pools such as "soil organic matter" or "ammonium".

## 4. MVP species roster

### Plants

#### P1 — *Fittonia albivenis*
Common name: nerve plant.

Role:
- low-growing producer;
- shade-tolerant humid-terrestrial plant;
- source of living leaf biomass, dead leaves and root exudates.

Simulation:
- clonal spread through rooting creeping stems;
- optional sexual reproduction deferred;
- leaf cohorts with age and damage;
- shallow roots;
- growth limited by light, water, N, P and temperature.

#### P2 — *Peperomia caperata*
Common name: emerald ripple peperomia.

Role:
- compact wet-tropical perennial;
- second producer with different leaf/root allocation.

Simulation:
- discrete plant growth stages;
- leaf production/senescence;
- root uptake;
- flowering may be visual only in MVP unless seed reproduction is implemented.

#### P3 — *Pilea depressa*
Common name: miniature peperomia / depressed clearweed.

Role:
- fast creeping producer;
- fills open humid substrate;
- competes strongly for surface area and light.

Simulation:
- clonal node rooting;
- fast lateral expansion;
- strong response to local light and moisture.

### Soil and detrital fauna

#### A1 — *Folsomia candida*
Common name: springtail.

Role:
- fungal/bacterial grazer;
- consumer of litter-associated microorganisms;
- prey for *Dalotia coriaria*.

Important biology:
- soil-dwelling;
- parthenogenetic;
- highly suitable for deterministic reproduction experiments.

Life stages:
- egg;
- juvenile;
- adult.

#### A2 — *Trichorhina tomentosa*
Common name: dwarf white isopod.

Role:
- detritivore;
- consumes decaying plant material, wood-associated organics and fungi;
- fragments litter, increasing microbial access.

Important biology:
- small, fossorial, moisture-dependent;
- parthenogenetic populations are commonly reported;
- should spend most simulation time within/under substrate and litter, not walking visibly on open surfaces.

Life stages:
- manca/juvenile;
- adult.

### Fungus gnat

#### A3 — *Bradysia impatiens*
Common name: dark-winged fungus gnat.

Role:
- larvae consume fungi and can feed on roots;
- adult stage adds aerial activity;
- major prey pathway for the predator.

Life stages:
- egg;
- larva;
- pupa;
- adult.

Behavioral correction:
Adults do not "feed the ecosystem" enough to be treated as major decomposers. Most ecological processing occurs in the larval substrate stage.

### Predator

#### A4 — *Dalotia coriaria*
Synonym in older literature: *Atheta coriaria*.  
Common name: rove beetle.

Role:
- top invertebrate predator in MVP;
- both larvae and adults prey on fungus-gnat stages and other suitably sized soil arthropods;
- can also consume springtails.

Life stages:
- egg;
- larva;
- pupa;
- adult.

Movement:
- adults mostly substrate-associated but may fly;
- larvae remain within growing medium/litter.

The MVP intentionally omits a spider. Aerial spider predation adds web geometry, prey interception, extra navigation and another trophic dependency without being necessary to prove the closed ecosystem loop.

### Microbial decomposers

#### M1 — *Linnemannia elongata*
Older synonym: *Mortierella elongata*.

Role:
- soil saprotrophic fungus;
- fungal biomass grows on suitable organic substrates;
- contributes to decomposition and becomes food for fungivorous microarthropods.

Representation:
- colony/biomass field rather than one 3D agent per hypha.

#### M2 — *Bacillus subtilis*

Role:
- bacterial decomposer represented as local colony biomass;
- contributes to conversion of labile organic matter and nutrient release.

Representation:
- colony/biomass field;
- not rendered as individual cells.

Important limitation:
Two microbial species cannot represent the diversity of a real tropical-soil microbiome. They are explicit real-species proxies used to make the MVP causal and testable. More microbial species can be added later without changing the resource model.

## 5. Ecological resource model

The simulation must track conserved pools rather than abstract health-only values.

Minimum global/material quantities:

- water;
- carbon;
- nitrogen;
- phosphorus.

Recommended pool breakdown:

### Carbon
- atmospheric CO2-C;
- plant structural C;
- plant reserve C;
- animal biomass C;
- fungal biomass C;
- bacterial biomass C;
- fresh litter C;
- coarse detritus C;
- dissolved/labile organic C;
- stable soil organic C.

### Nitrogen
- plant N;
- animal N;
- microbial N;
- detrital organic N;
- NH4-N;
- NO3-N.

### Phosphorus
- plant P;
- animal P;
- microbial P;
- detrital organic P;
- available inorganic P.

### Water
- substrate water;
- surface water;
- plant water;
- animal water;
- atmospheric water vapor.

Every transfer must have a source and destination.

No system may call hidden helpers equivalent to:
- spawnFood();
- restorePopulation();
- giveNutrients();
- refillWater();

while Sealed Mode is active.

## 6. Energy model

The terrarium is not energetically closed.

External energy:
- light;
- optionally boundary heat exchange with room temperature.

Plant gross carbon assimilation is a function of:
- photosynthetically active light proxy;
- available CO2;
- temperature response;
- water stress;
- nutrient limitation;
- living photosynthetic leaf area.

Plants respire continuously. Animals and decomposers respire continuously. Carbon consumed but not retained as biomass returns partly to CO2 and partly to waste/detritus.

## 7. Microclimate

Use a 3D environmental grid, initially approximately 16 × 8 × 12 cells for a 120 × 60 × 90 cm terrarium.

Per cell:
- air temperature;
- relative/absolute humidity;
- light intensity;
- CO2 concentration;
- O2 concentration if Sealed Gas mode is enabled.

Substrate cells additionally track:
- volumetric water proxy;
- temperature;
- organic matter;
- NH4;
- NO3;
- available P;
- fungal biomass;
- bacterial biomass.

Do not simulate CFD in MVP. Use diffusion/advection approximations between neighboring cells.

## 8. Water cycle

Required processes:
- mist/initial water input before sealing;
- infiltration;
- substrate retention;
- plant root uptake;
- plant transpiration;
- surface evaporation;
- condensation on sufficiently cool surfaces;
- runoff/drip return to substrate.

Water conservation is an automated invariant in Sealed Mode.

## 9. Plant simulation

A plant is not one scalar biomass value.

Minimum structure:
- root biomass;
- stem biomass;
- leaf cohorts;
- reserve carbon;
- water status;
- N/P status;
- age;
- health;
- reproduction/spread state.

Leaf cohort:
- area;
- age;
- carbon;
- nitrogen;
- damage;
- light exposure;
- photosynthetic capacity.

Growth must allocate newly fixed carbon to leaves, roots and reserves.

Senescent leaves become explicit litter objects or litter biomass in the cell.

Clonal plants create new ramets only when stored resources and local space allow.

## 10. Animal state

Each macroscopic individual stores:

```ts
type Organism = {
  id: number
  speciesId: SpeciesId
  lifeStage: LifeStage
  ageSeconds: number
  sex?: Sex

  position: Vec3
  velocity: Vec3

  structuralBiomass: number
  reserveEnergy: number
  bodyWater: number

  health: number
  hunger: number
  hydration: number
  stress: number

  currentAction: Action
  targetId?: number

  reproduction: ReproductionState
}
```

Microbes use colony fields rather than individual entities.

## 11. Behavior model

Use Utility AI, not random animation scripts.

Candidate actions:
- forage;
- graze fungus;
- consume litter;
- hunt;
- flee;
- hide;
- rest;
- seek moisture;
- seek temperature;
- mate;
- oviposit;
- disperse;
- fly where biologically appropriate.

Utility is based on internal state plus sensed local information.

Agents must not know global positions of food, mates or predators.

Species-specific sensors:
- contact;
- short-range chemical cue;
- local humidity;
- temperature;
- light;
- vibration;
- vision where appropriate.

## 12. Navigation

Use layered navigation surfaces and a spatial hash.

Surface classes:
- substrate;
- litter;
- wood;
- rock;
- plant leaf;
- plant stem;
- glass.

Not every species can use every surface.

Examples:
- *T. tomentosa*: mostly substrate/litter/under-object nodes.
- *F. candida*: substrate/litter/fungal patches.
- *B. impatiens* adult: free-flight volume.
- *D. coriaria* adult: substrate/litter plus short flight.

Do not run full rigid-body physics or leg IK for all individuals.

## 13. Reproduction

Reproduction must spend real resources.

Examples:
- egg production subtracts reserve energy and biomass from parent;
- clonal plant spread requires carbon and nutrients;
- microbial growth consumes substrate carbon/nutrients.

No reproduction occurs merely because a timer elapsed.

Species-specific reproductive mode is mandatory:
- *F. candida*: parthenogenesis;
- *T. tomentosa*: parthenogenetic population model;
- *B. impatiens*: sexual reproduction;
- *D. coriaria*: sexual reproduction;
- plants: species-appropriate clonal growth for MVP.

## 14. Death and decomposition

Death causes:
- starvation;
- dehydration;
- unsuitable temperature exposure;
- predation;
- senescence;
- severe resource imbalance.

Death does not delete matter.

A corpse/litter item contains:
- remaining carbon;
- nitrogen;
- phosphorus;
- water;
- decomposition quality;
- physical size;
- decay state.

Consumers and microbes transfer matter from it into their own biomass, waste, dissolved nutrients and respiratory CO2.

## 15. Gas exchange

Correction to the original plan:

O2/CO2 should not automatically be a dominant death mechanic in every mode.

Modes:
1. **Ventilated Mode** — gas exchange with external atmosphere; O2/CO2 remain near boundary values.
2. **Sealed Gas Mode** — no gas exchange; O2/CO2 are conserved internal pools and can become limiting.

The default visually sealed terrarium may still use a configurable low gas permeability rather than a perfectly airtight boundary.

## 16. Time

Rendering:
- target 60 FPS.

Simulation tiers:
- movement: 10–20 Hz near camera;
- behavior decisions: 1–5 Hz;
- microclimate: 1–2 Hz;
- plant physiology: 0.2–1 Hz;
- microbial/nutrient processes: 0.1–1 Hz;
- far-agent updates: lower frequency.

Simulation must use fixed timesteps and remain independent of rendering FPS.

Time controls:
- pause;
- 1×;
- 5×;
- 20×;
- 100×.

At high speed, simulation fidelity may use validated aggregation/LOD rules but must preserve resource conservation.

## 17. Simulation LOD

Near:
- individual movement;
- local sensing;
- full behavior;
- animation.

Medium:
- simplified pathing;
- local resource interactions;
- reduced decision rate.

Far/offscreen:
- infrequent individual updates or validated population aggregation.

Any transition between individual and aggregate simulation must conserve:
- population count;
- biomass;
- water;
- C/N/P pools;
- age/stage distribution.

## 18. Rendering

Recommended stack:
- TypeScript;
- Vite;
- Three.js;
- WebGL2 baseline;
- Web Worker for simulation.

Visual style:
- naturalistic stylized low/mid-poly;
- physically plausible scale;
- restrained material/shader complexity;
- instancing for leaves and small repeated geometry;
- LODs;
- texture atlases;
- soft environmental lighting;
- macro camera.

The project should feel like observing a living museum exhibit, not a cartoon game.

## 19. Observation UI

Default UI is minimal.

Camera:
- orbit;
- free inspection;
- macro;
- follow selected organism.

Selecting an organism shows:
- real species name;
- scientific name;
- life stage;
- age;
- energy;
- hydration;
- body/biomass;
- current action;
- current target;
- reproductive state;
- parent IDs if known;
- offspring count.

"Why?" panel explains the highest utility factors behind the current action.

## 20. Debug/scientific UI

Required overlays:
- temperature;
- humidity;
- soil water;
- light;
- CO2;
- O2 in sealed mode;
- NH4;
- NO3;
- available P;
- litter;
- fungal biomass;
- bacterial biomass.

Graphs:
- population by species/stage;
- total biomass by species;
- births/deaths;
- predation;
- plant productivity;
- decomposition;
- resource pools.

Food-web view:
line thickness represents actual transferred biomass over a selected time window.

## 21. Mass-balance debugger

At every ecology step, compute residuals:

```text
delta(total C) - boundary_C_flux
delta(total N) - boundary_N_flux
delta(total P) - boundary_P_flux
delta(total water) - boundary_water_flux
```

In perfectly sealed material mode, residuals must remain approximately zero within numerical tolerance.

Invariant violations should fail tests.

## 22. Persistence and determinism

Persist to IndexedDB:
- seed;
- world clock;
- environment grid;
- organisms;
- plant state;
- microbial state;
- C/N/P/water pools;
- statistics.

Use seeded PRNG.

Do not use Math.random() inside Simulation Core.

Same:
- seed;
- initial world;
- user actions;
- engine version

must reproduce the same simulation within defined floating-point tolerance.

## 23. Headless ecology runner

A mandatory non-rendering mode must support:
- run N virtual days;
- batch many seeds;
- export CSV/JSON metrics;
- detect extinctions;
- detect resource drift;
- detect explosions;
- produce summary statistics.

This is required before visual polish.

## 24. Stability definition

A real ecosystem is dynamic; the engine must not force fixed population counts.

The "Tropical Stable" preset is considered validated only statistically.

Initial acceptance target:
- 100 deterministic seeds;
- 180 virtual days each;
- no hidden interventions;
- no mass-balance invariant failure;
- >=80% of runs retain all three producer species;
- >=80% retain at least one detritivore population;
- >=70% retain *Bradysia impatiens*;
- >=70% retain *Dalotia coriaria*;
- no unbounded population growth;
- no resource pool becomes negative;
- all surviving trophic populations must contain post-start descendants, proving real reproduction.

These thresholds are engineering targets, not claims about nature, and can be revised after calibration.

## 25. Genealogy requirement

For every individually represented animal:
- parent IDs if applicable;
- birth timestamp;
- death timestamp/cause;
- major feeding events;
- reproductive events.

A user should be able to select an animal born months after simulation start and trace:
- where it was born;
- its parents;
- what resources supported it;
- its offspring;
- where its biomass went after death.

## 26. Initial preset

Exact initial counts must be calibrated by headless simulation rather than guessed.

Starting search ranges:

- *Folsomia candida*: 80–200
- *Trichorhina tomentosa*: 20–60
- *Bradysia impatiens*: 10–30 adults/late larvae combined
- *Dalotia coriaria*: 4–10 adults/late larvae combined
- plants: multiple ramets/individuals of all 3 species
- fungal and bacterial biomass: non-zero established colonies
- substantial initial leaf litter and dead wood carbon

The optimizer/search may tune initial biomass and environmental parameters, but may not add rescue rules.

## 27. Architecture

```text
Simulation Core
  EnvironmentSystem
  ClimateSystem
  WaterSystem
  CarbonSystem
  NitrogenSystem
  PhosphorusSystem
  PlantSystem
  MicrobialSystem
  DetritusSystem
  MetabolismSystem
  BehaviorSystem
  ReproductionSystem
  PredationSystem
  MortalitySystem
  NavigationSystem
  StatisticsSystem
  InvariantSystem

          |
          v

World Snapshot / Delta Stream

          |
          v

Rendering Adapter
          |
          v
Three.js
```

Three.js objects are not authoritative biological state.

## 28. Mandatory automated tests

Unit/invariant:
- water conservation;
- C conservation;
- N conservation;
- P conservation;
- no negative pools;
- seeded reproducibility.

Biological:
- plant grows with light/water/nutrients;
- plant loses growth under limiting resource;
- senescent leaf becomes litter;
- fungal biomass grows on suitable organic substrate;
- *F. candida* reproduces without mate;
- *B. impatiens* completes egg -> larva -> pupa -> adult;
- *D. coriaria* detects and consumes prey;
- starvation lowers reserves and can kill;
- corpse enters detrital cycle;
- decomposition raises mineral nutrient availability;
- new plant tissue incorporates previously detrital nutrient atoms/pool mass.

System:
- 30-day smoke simulation;
- 180-day stable-preset batch;
- accelerated 365-day stress run.

## 29. Performance targets

Desktop MVP:
- 1920×1080;
- target 60 FPS on ordinary integrated/discrete laptop graphics;
- 100–300 visible animal meshes;
- 1,000+ simulated small organisms through LOD/aggregation;
- no main-thread long stalls during normal speed.

## 30. Explicit non-goals for MVP

Do not implement yet:
- hundreds of species;
- genetic evolution;
- mutation;
- disease epidemiology;
- parasites;
- full soil microbiome;
- CFD;
- molecular chemistry;
- individual stomata;
- exact leg physics;
- seasons;
- multiplayer;
- building/crafting;
- economy/quests.

## 31. Definition of done

MVP is done when a user can:

1. open it in a browser;
2. start a seeded tropical terrarium;
3. enable Sealed Mode;
4. leave it without biological intervention;
5. accelerate time for months;
6. inspect births, growth, hunting, feeding, senescence, death and decomposition;
7. inspect resource-flow graphs;
8. verify that matter is not secretly created;
9. select an organism that did not exist at world start;
10. trace its lineage and resource history;
11. observe that its eventual death feeds later generations.

The central criterion is not "looks alive".  
The central criterion is "life-like visible behavior emerges from a closed causal resource system."

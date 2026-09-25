# Simarium — Species data model

Status: normative data specification

## 1. Goal

Biological rules and parameters must be data-driven and auditable.

A developer must never need to invent a biological constant inside system code.

## 2. Required provenance

Every quantitative parameter has:

```yaml
value:
unit:
status: MEASURED | DERIVED | ASSUMED | CALIBRATED | TBD
source:
source_locator:
conditions:
confidence: high | medium | low
notes:
```

For a range:

```yaml
min:
max:
central:
unit:
...
```

## 3. Canonical species record

```yaml
id: folsomia_candida
scientific_name: Folsomia candida
common_names:
  en: springtail
taxonomy:
  kingdom:
  phylum:
  class:
  order:
  family:
  genus:
  species:
taxon_source:
native_range:
biome:
ecological_roles: []

life_cycle:
  reproduction_mode:
  sex_system:
  stages: []
  transitions: {}

environment:
  temperature:
    preferred:
    viable:
    lethal:
  humidity:
  substrate_moisture:
  light_response:

body:
  adult_mass:
  carbon_fraction:
  water_fraction:
  cn_ratio:
  cp_ratio:

metabolism:
  basal_rate:
  temperature_response:
  starvation_tolerance:
  desiccation_tolerance:

diet:
  resources: []
  stage_specific: {}
  assimilation_efficiency:

behavior:
  locomotion_modes: []
  habitat_affordances: []
  sensor_profile:
  actions: []

reproduction:
  maturity:
  fecundity:
  egg_mass:
  reproductive_cost:
  mate_required:
  oviposition_habitat:

mortality:
  senescence:
  stress_hazards:

render:
  scale:
  animation_set:
  lod_group:

sources: []
```

Fields irrelevant to a taxon may be null with an explanation.

## 4. Plant extension

Plants add:

```yaml
plant:
  growth_form:
  photosynthesis:
    amax:
    k_light:
    temperature_curve:
  allocation:
    leaf:
    root:
    stem:
    reserve:
  leaf:
    sla:
    lifespan:
    senescence:
  roots:
    depth:
    uptake_capacity:
  reproduction:
    modes: [clonal, sexual]
    mvp_mode:
    clonal_cost:
    seed_model:
```

## 5. Microbe extension

Microbes add:

```yaml
microbe:
  representation: biomass_field
  substrate_preferences:
  vmax:
  half_saturation:
  carbon_use_efficiency:
  cn_ratio:
  cp_ratio:
  moisture_curve:
  temperature_curve:
  mineralization:
```

## 6. Species currently approved for MVP

- `fittonia_albivenis`
- `peperomia_caperata`
- `pilea_depressa`
- `folsomia_candida`
- `trichorhina_tomentosa`
- `bradysia_impatiens`
- `dalotia_coriaria`
- `linnemannia_elongata`
- `bacillus_subtilis`

No additional species enters MVP without:
1. source review;
2. ecological role justification;
3. parameter coverage check;
4. test additions.

## 7. Missing-data policy

If literature does not provide a parameter:

1. look for same species under comparable conditions;
2. derive from measured quantities when mathematically justified;
3. use a related taxon only if explicitly documented;
4. otherwise mark ASSUMED/CALIBRATED;
5. keep sensitivity bounds;
6. add the parameter to uncertainty analysis.

Never silently copy a value from another species.

## 8. Calibration policy

A CALIBRATED parameter must record:
- target observable;
- calibration dataset/range;
- objective function;
- bounds;
- date/model version.

Example:

```yaml
parameter: feeding.search_radius
status: CALIBRATED
target: prey encounter rate under literature-density scenario
bounds: [0.01, 0.08]
unit: m
```

## 9. Validation

CI validates:
- schema;
- units;
- source presence for MEASURED/DERIVED values;
- no runtime-critical TBD field;
- ranges are ordered;
- life-stage graph is acyclic except explicit adult/reproduction loops;
- diet resource IDs exist;
- render IDs exist.

## 10. Versioning

Species data has its own semantic/data version.

A saved world records the exact species-data version used.
Changing biological constants must invalidate deterministic regression hashes intentionally.

# Simarium — Validation strategy

Status: normative quality specification

## 1. Validation layers

Simarium has four distinct validation questions:

1. **Numerical validity** — does the engine conserve matter and remain stable?
2. **Biological plausibility** — do individual species behave within documented ranges?
3. **Ecological plausibility** — do interactions produce credible population/resource dynamics?
4. **Performance validity** — does the browser implementation meet real-time targets?

A run is not "valid" merely because it looks natural.

## 2. Numerical invariants

Every deterministic test run verifies:
- C balance;
- N balance;
- P balance;
- H2O balance;
- no negative pools beyond epsilon;
- no NaN/Infinity;
- valid lifecycle transitions;
- valid parentage;
- no duplicate IDs.

Residual tolerance must scale with total pool magnitude and floating-point accumulation.

## 3. Unit tests

Required model-level tests:

### Plants
- zero/near-zero light -> no positive photosynthetic gain;
- increasing light increases assimilation until saturation;
- severe water limitation limits growth;
- nutrient limitation limits growth;
- respiration can make net carbon negative;
- senescent tissue becomes litter;
- root uptake subtracts from substrate.

### Microbes
- zero substrate -> no substrate-driven growth;
- suitable substrate/moisture -> positive growth;
- consumption cannot exceed source mass;
- respiration returns carbon to CO2 pool;
- mineralization transfers organic N/P to available pools.

### Animals
- metabolism consumes reserves;
- feeding transfers real matter;
- starvation can cause death;
- reproduction consumes parent resources;
- eggs/offspring contain transferred matter;
- corpse preserves remaining mass.

### Behavior
- no global target knowledge;
- stronger hunger increases food-related utility;
- strong desiccation risk increases moisture-seeking utility where species-appropriate;
- predator cannot consume unreachable/undetected prey.

## 4. Species validation

Each species receives a validation sheet with:
- modeled life-stage durations;
- adult/juvenile body size/mass range;
- reproduction mode;
- fecundity range;
- temperature/moisture response;
- diet;
- activity/habitat pattern;
- lifespan/senescence information where available.

Model outputs are compared to literature intervals under matched test conditions.

A parameter being uncertain is acceptable if documented; silently matching desired ecosystem behavior is not.

## 5. Single-species experiments

Before multi-species simulation:

### Producer chamber
One plant species + light/water/nutrients.
Expected:
- establishment;
- measurable growth;
- senescence;
- litter production.

### Decomposer chamber
Defined litter + microbial species.
Expected:
- microbial growth;
- litter reduction;
- CO2 release;
- N/P mineralization.

### Folsomia chamber
Fungal resource + *F. candida*.
Expected:
- feeding;
- parthenogenetic reproduction;
- stage turnover.

### Trichorhina chamber
Leaf litter + *T. tomentosa*.
Expected:
- detrital consumption;
- reproduction;
- moisture dependence.

### Bradysia chamber
Suitable moist substrate/fungal resource.
Expected:
- egg -> larva -> pupa -> adult;
- root/fungal interaction;
- adult emergence.

### Dalotia chamber
Predator + prey.
Expected:
- encounter-limited predation;
- reproduction when resources allow;
- starvation when prey absent.

## 6. Pairwise interaction experiments

Minimum:
- plant + decomposer;
- fungus + *F. candida*;
- litter + *T. tomentosa*;
- *Bradysia* + plant roots;
- *Dalotia* + *Bradysia*;
- *Dalotia* + *F. candida*.

Each experiment records transfer flows and population outcomes.

## 7. Full ecosystem experiments

### Smoke
- 30 virtual days;
- 10 seeds.

Purpose:
- detect catastrophic bugs.

### Calibration batch
- >=100 seeds;
- 180 virtual days.

Purpose:
- tune bounded CALIBRATED parameters against predefined targets.

### Stability evaluation
- >=500 seeds when runtime permits;
- 365 virtual days preferred.

Purpose:
- evaluate robustness, extinction frequency and drift.

## 8. Stability metrics

Do not define stability as constant population size.

Track:
- persistence probability per species;
- time-to-extinction;
- coefficient of variation of population size;
- peak/trough ratio;
- generation turnover;
- net primary production;
- decomposition rate;
- detritus accumulation;
- predator/prey phase relationships;
- resource-pool drift;
- fraction of biomass originating after world start.

## 9. Initial MVP acceptance targets

These are engineering gates, not biological claims:

- zero invariant failures;
- zero negative resource pools;
- no unbounded numerical growth;
- at least 80% of 180-day runs retain all producer taxa;
- at least 80% retain at least one detritivore species;
- at least 70% retain *Bradysia impatiens*;
- at least 70% retain *Dalotia coriaria*;
- surviving animal populations contain post-start generations;
- at least one nutrient mass tracer originating in litter is later incorporated into new plant tissue.

Targets may only change through a documented model decision, not to hide failures.

## 10. Mass tracers

For validation, support optional virtual tracers.

A tracer has no physical effect but follows mass transfers.

Examples:
- carbon tracer from one dead leaf;
- nitrogen tracer from one corpse.

This allows proof of:
```text
dead tissue -> decomposer -> available nutrient -> plant tissue
```

## 11. Regression baselines

For fixed:
- engine version;
- species data version;
- preset;
- seed;

record checkpoint hashes and summary metrics.

Regression tests detect unintended model changes.

A deliberate model change updates the baseline with explanation.

## 12. Sensitivity analysis

For uncertain ASSUMED/CALIBRATED parameters:
- vary one-at-a-time first;
- then sample bounded parameter space.

Flag parameters where small changes cause:
- universal extinction;
- runaway populations;
- huge resource drift.

Such parameters need better evidence or model redesign.

## 13. Calibration split

Do not calibrate and evaluate on exactly the same seed set.

Example:
- calibration seeds: 0–99;
- validation seeds: 100–299;
- stress seeds: 300–499.

This reduces accidental overfitting to a small deterministic batch.

## 14. Visual validation

Rendering is checked separately:
- apparent movement matches logical movement;
- animation does not alter entity position/state;
- selected organism UI matches simulation state;
- LOD transitions do not change ecological outcomes.

## 15. Performance validation

Benchmark scenes:
- 300 visible animals;
- 1,000 simulated animals;
- dense plant scene;
- 100× time acceleration.

Measure:
- render frame time;
- sim step time by system;
- worker-to-main transfer time;
- memory;
- GC pauses.

Performance optimizations must pass ecology regression tests.

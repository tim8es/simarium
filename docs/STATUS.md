# Simarium — Implementation status

Updated: 2026-09-25

## Current stage

- Phase 0 specification/contracts: complete for implementation entry.
- Phase 1 deterministic conservation kernel: **PASS**.
- Phase 2 producer + detritus loop: **PASS** — three real plant species, water-limited physiology, decomposer environment response and sensitivity tests.
- Phase 3 *Folsomia candida* lifecycle: **PASS (engineering gate)** — individual lifecycle, multi-generation genealogy, moisture-sensitive reproduction, feeding, starvation/death and corpse transfer.

## Phase 1 evidence

Accepted commit:
`7b724fce31f586b4166c943acf74dc89f2c08b6e`

GitHub Actions run:
`36143633327`

Passed:
- npm install;
- Vitest suite;
- TypeScript build;
- 365 virtual day headless simulation at 60-second fixed timestep;
- mass invariant checks for C/N/P/H2O;
- deterministic RNG tests;
- conservative diffusion test;
- serialization round-trip;
- runtime species catalog/unit validation.

## Important interpretation

Phase 1 proves numerical/kernel properties only. It does **not** prove biological realism yet.

The current default Phase 1 world is a synthetic engineering fixture used to validate conservation and deterministic execution.

## Phase 2 entry requirements

Before freezing biological behavior:
- source/label Fittonia parameters;
- source/label microbial decomposition parameters;
- distinguish MEASURED / DERIVED / ASSUMED / CALIBRATED;
- implement resource tracer;
- implement producer -> litter -> decomposer -> available nutrient -> producer loop;
- validate tracer return into new plant tissue.


## Phase 2 first vertical-slice evidence

Accepted head:
`e016c9cf44f6126062fd55a71ebabdee747b7b06`

GitHub Actions run:
`36144239689`

The current experiment proves, with a conserved mass tracer:

```text
tagged litter nitrogen
-> microbial decomposition
-> available nutrient pool
-> new Fittonia structural tissue
```

The experiment also passes the global C/N/P/H2O invariant.

This is an engineering vertical slice, **not yet a validated biological Fittonia growth model**. Several coefficients are intentionally labelled ASSUMED or CALIBRATED.

Remaining Phase 2:
- improve quantitative Fittonia parameter evidence/calibration;
- improve *Linnemannia elongata* / *Bacillus subtilis* decomposition parameterization;
- implement plant water limitation/transpiration;
- add *Peperomia caperata*;
- add *Pilea depressa*;
- run producer/decomposer sensitivity and regression batches.


## Phase 2 completion evidence

Accepted head:
`62c2961d4c9428185b4f4f28162d445b2b163aa2`

GitHub Actions run:
`36144959860`

Passed:
- *Fittonia albivenis*, *Peperomia caperata* and *Pilea depressa* use the shared plant-physiology system;
- root-water uptake and transpiration conserve H2O;
- drought reduces Fittonia carbon gain;
- microbial litter processing slows under low substrate-water availability;
- light/decomposition sensitivity grid preserves global material invariants;
- the older litter-nitrogen tracer proof remains green.

Phase 2 parameters are deliberately a mixture of MEASURED, DERIVED, ASSUMED and CALIBRATED values. Passing the gate means the mechanism is coherent and testable, not that every coefficient is biologically final.

## Phase 3 completion evidence

Accepted head:
`5e796982a971a0e3dd25dafb1216968308331199`

GitHub Actions run:
`36145748523`

Passed:
- 10–12-day juvenile starting cohort;
- temperature-dependent egg/juvenile development;
- parthenogenetic reproduction with material cost paid by the parent;
- post-start descendants and grandchildren with parent IDs;
- individual feeding from explicit fungal/bacterial biomass pools;
- metabolism returns carbon to the atmosphere;
- hydration/desiccation exchanges real water with world pools;
- reproduction is suppressed by dry substrate proxy conditions;
- senescence/starvation/carbon exhaustion create corpse biomass;
- individual material sum matches the aggregate ledger;
- C/N/P/H2O invariants remain valid.

Phase 3 is an engineering lifecycle proof. Population-rate calibration against OECD/literature distributions remains part of later full-ecosystem calibration.


## Phase 4 completion evidence

Accepted lifecycle/fragmentation test head:
`de869a7a0d632445e72ecd23008269415edfb796`

GitHub Actions run:
`36146342332` — PASS.

Validated:
- *Trichorhina tomentosa* individual maturation and parthenogenetic brood production;
- moisture-dependent reproduction;
- feeding transfers coarse litter/fungal matter through a real feed buffer;
- unassimilated material becomes a fine-detritus pool;
- fine detritus decomposes faster because of its pool property, not because an isopod toggles a global decomposition bonus;
- senescent animals transfer remaining C/N/P/H2O to corpse biomass.

## Phase 5 completion evidence

Accepted test head:
`2245cc72c4838898f79421e0ee3070b692711742`

GitHub Actions run:
`36146748002` — PASS.

Validated:
- *Bradysia impatiens* larva -> pupa -> adult transitions;
- deterministic sex assignment;
- mating requires a living male;
- oviposition requires sufficiently moist substrate;
- egg material is paid from the female;
- larvae prefer fungal food and can fall back to real root-tissue biomass;
- adult lifespan ends in corpse biomass without rescue.

## Phase 6 completion evidence

Accepted test head:
`0f36339b2b825f2472f7c5076e45b89bae6b6625`

GitHub Actions run:
`36147187701` — PASS.

Validated:
- *Dalotia coriaria* larva -> pupa -> adult lifecycle and sex assignment;
- density-limited predation on concrete *Bradysia impatiens* and *Folsomia candida* individuals;
- prey death is recorded as predation;
- prey C/N/P/H2O is transferred into predator biomass and detritus;
- sexual reproduction requires a mate and suitable moisture;
- predators die without prey rather than receiving hidden food.

The current predation encounter function is a headless density proxy. Spatially local encounters remain an explicit Phase-7/renderer-integration requirement and are not represented as already solved.

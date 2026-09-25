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

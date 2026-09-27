# Simarium — Implementation status

Updated: 2026-09-27

## Current stage

- Phase 0 specification/contracts: complete for implementation entry.
- Phase 1 deterministic conservation kernel: **PASS**.
- Phase 2 producer + detritus loop: **PASS** — three real plant species, water-limited physiology, decomposer environment response and sensitivity tests.
- Phase 3 *Folsomia candida* lifecycle: **PASS (engineering gate)** — individual lifecycle, multi-generation genealogy, moisture-sensitive reproduction, feeding, starvation/death and corpse transfer.
- Phase 7 full headless ecosystem: **ACCEPTED BASELINE PASS** — the accepted baseline passed a 100-seed × 180-day calibration batch plus an independent 100-seed × 180-day validation batch with unchanged `VALIDATION.md` gates. The current integration branch contains post-acceptance ecology fixes and must rerun the same full gate before that PASS is transferred to the integrated HEAD.

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


## Phase 7 completion evidence — 2026-09-26

**Status: ACCEPTED BASELINE COMPLETE — engineering gate PASS.**

The evidence below applies to the accepted model head recorded in this section. The current integration branch contains subsequent ecology fixes (including diagnostics and local predator-competition corrections). Those changes are covered by regression/smoke tests but have not yet rerun the full 100-seed calibration + independent 100-seed validation gate. Therefore the accepted baseline remains valid evidence, while the integrated HEAD is **pending full Phase-7 revalidation**.

Working branch:
`agent/phase7-ecology`

Accepted model head:
`1aec050c3f0a9353c4d70e7655c8b8919ef62ce2`

Green PR CI:
`36258570107`

Full Phase-7 acceptance workflow:
`36258567197` — **PASS**.

The workflow executed the documented split without changing the acceptance thresholds:
- calibration: seeds `0-99`, 100 runs × 180 virtual days;
- independent validation: seeds `100-199`, 100 runs × 180 virtual days;
- validation seeds were not used for parameter tuning.

### Accepted ecological calibration

The integrated spatial Dalotia model keeps its standalone Phase-6 arena calibration separate from terrarium-scale calibration.

Phase-7 integrated parameters:
- `dalotiaLocalCaptureProbability = 0.20` — **CALIBRATED**;
- `dalotiaLocalPreyHalfSaturationCount = 3` — **CALIBRATED**.

The final density-response value was selected only from calibration seeds `0-4`. After explicit local predator-competition handling was added, a 180-day sweep tested values 3, 4 and 5. Value 3 retained Folsomia, Bradysia and Dalotia in all 5/5 calibration runs; the fixture documents the rejected alternatives and why they were rejected. It is an engineering spatial-model coefficient, not a measured biological constant.

The Dalotia spatial model now accounts for multiple nearby active predators sharing the same local prey field. Without that competition term, every predator independently received the full local-density response, creating an artificial multiplicative kill-rate feedback in dense predator cohorts. This fix adds no new biological coefficient and is covered by a regression test.

### 100 × 180-day calibration results — seeds 0-99

- invariant-failure runs: `0/100`;
- litter-N tracer returned to plant tissue: `100/100`;
- all producer taxa persisted: `100%` (target >=80%);
- at least one detritivore persisted: `100%` (target >=80%);
- Folsomia persisted: `97%`;
- Trichorhina persisted: `100%`;
- Bradysia persisted: `78%` (target >=70%);
- Dalotia persisted: `100%` (target >=70%);
- post-start generation probability: Folsomia `1.0`, Trichorhina `1.0`, Bradysia `1.0`, Dalotia `1.0`;
- mean final living: Fittonia `26`, Peperomia `9`, Pilea `21`, Folsomia `589.35`, Trichorhina `104`, Bradysia `3740.29`, Dalotia `1271.49`;
- unchanged MVP acceptance evaluator: **PASS**.

### Independent 100 × 180-day validation results — seeds 100-199

- invariant-failure runs: `0/100`;
- litter-N tracer returned to plant tissue: `100/100`;
- all producer taxa persisted: `100%`;
- at least one detritivore persisted: `100%`;
- Folsomia persisted: `98%`;
- Trichorhina persisted: `100%`;
- Bradysia persisted: `79%`;
- Dalotia persisted: `100%`;
- post-start generation probability: Folsomia `1.0`, Trichorhina `1.0`, Bradysia `1.0`, Dalotia `1.0`;
- mean final living: Fittonia `26`, Peperomia `9`, Pilea `21`, Folsomia `635.87`, Trichorhina `104`, Bradysia `3952.67`, Dalotia `1236.36`;
- unchanged MVP acceptance evaluator: **PASS**.

### Numerical and runtime interpretation

All 200 accepted 180-day runs completed without invariant failures. The invariant layer checks C/N/P/H2O conservation and ledger validity, including negative/invalid pool detection, so the accepted batches contain no observed negative resource-pool or NaN/Infinity failures.

No unbounded numerical growth was observed over the accepted 180-day horizon. The earlier runaway regimes were rejected during calibration; the accepted calibration and independent validation batches both completed with finite population summaries and similar mean final abundances across disjoint seed sets. This is finite-horizon engineering evidence, not a claim of mathematical asymptotic stability.

Batch execution was also changed so completed worlds are compacted immediately and long-run seeds are isolated by process, preventing multi-seed calibration jobs from retaining every completed world in memory.

### Nutrient tracer proof

The accepted calibration and validation runs preserve the tracer provenance proof:

```text
litter nitrogen
-> decomposer biomass
-> available nutrient pool
-> living plant structural tissue
```

The tracer reached plant tissue in all `200/200` accepted 180-day runs.

### Phase-7 guardrails retained

- no population cap;
- no hidden rescue;
- no hidden food injection;
- no hidden spawn rule;
- no weakening of `VALIDATION.md` acceptance targets;
- validation seeds were not used to select the accepted calibration;
- standalone Phase-6 Dalotia arena parameters remain separate from integrated Phase-7 spatial calibration.

Phase 7 is therefore closed for the MVP engineering gate. The larger 365-day / >=500-seed stability evaluation remains a later robustness objective described in `VALIDATION.md`, not a prerequisite that was silently substituted for the documented 100-seed × 180-day calibration gate.

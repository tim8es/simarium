# Species data confidence audit

Status: biology-data audit for MVP species profiles  
Branch: `agent/biology-data`

This document separates direct biological evidence from current engineering calibration. No `CALIBRATED` runtime value is changed by this audit.

## High-confidence parameters

| Taxon | Parameter/evidence | Confidence |
|---|---|---|
| *Folsomia candida* | Egg development about 10 d at 20 C; first oviposition about 21-24 d; parthenogenesis | high |
| *Folsomia candida* | Adult dry mass about 0.04 mg for 25 ± 3 d laboratory adults | high for cited culture |
| *Folsomia candida* | Clutch size and inter-clutch interval are strongly food- and age-dependent; observed clutches can be far larger than the current runtime value | high |
| *Bradysia impatiens* | Egg 4.0 d, larval instars totaling about 14.1 d, pupa 3.5 d, adult longevity 5.9 d near 24 C | high |
| *Bradysia impatiens* | Mean fecundity about 75 eggs/female (reported 12-156) near 24 C | high |
| *Bradysia impatiens* | Adult female/male mass 0.42/0.23 mg and length 2.22/1.70 mm within 24 h of emergence | high |
| *Dalotia coriaria* | Egg/larva/pupa durations, adult longevity, fecundity and ~1:1 sex ratio near 26 C | high |
| *Dalotia coriaria* | Adult fungus-gnat consumption increases with offered prey density (about 3.6/day at 10 offered; 18.4/day at 40 offered in one assay) | high for assay conditions |
| *Linnemannia elongata* | Laboratory culture can reach stationary mycelial growth around 48 h at 25 C in the cited medium | high for that culture |
| MVP taxonomy | Accepted scientific names are anchored to Kew/ITIS/Index Fungorum/BMIG/official or accepted taxonomic references | high to medium depending on source |

## Low-confidence or calibration-dominated parameters

| Taxon/system | Current parameter | Status / issue |
|---|---|---|
| *F. candida* | runtime clutch size 6 | CALIBRATED; below many directly observed clutch means; must be recalibrated as a population model, not overwritten |
| *F. candida* | 180 d adult lifespan, feeding carbon rate, reserve thresholds | CALIBRATED/ASSUMED |
| *T. tomentosa* | 75 d maturity, 60 d brood interval, brood size 12 | CALIBRATED from low-confidence husbandry/model proxies |
| *T. tomentosa* | adult carbon 0.135 mg_C | ASSUMED; no direct species-specific mass anchor found |
| *B. impatiens* | larval feeding carbon rate 5e-8 mg_C/s | CALIBRATED from qualitative feeding ecology, not measured ingestion |
| *B. impatiens* | adult carbon target 0.03 mg_C | ASSUMED; now has a wet-mass anchor but still needs defensible dry/carbon conversion |
| *D. coriaria* | half-saturation count 12 and capture probability 0.75 | CALIBRATED encounter/functional-response parameters |
| Plants | structural growth, clone intervals/fractions, senescence rates, ramet lifespans | mostly CALIBRATED; direct species-specific growth/senescence evidence is weak |
| Decomposer system | CUE 0.4 | ASSUMED community proxy; not measured for either explicit decomposer species |
| Decomposer system | ~20 d microbial turnover characteristic | CALIBRATED; not a species-specific turnover measurement |

## Change proposals — do not apply automatically

### Folsomia maturation/reproduction

Current runtime:
- maturity: 22 d (`CALIBRATED`);
- reproduction interval: 7 d (`DERIVED`/model simplification);
- clutch size: 6 (`CALIBRATED`).

Evidence:
- first oviposition is reported around 21-24 d near 20 C;
- recent direct clutch observations show strong food/age dependence, with mean clutch sizes in the tens and a broad observed distribution.

Proposal:
- keep the current values unchanged in runtime;
- replace the eventual fixed-clutch model with age/food-conditioned fecundity or calibrate an effective clutch/interval pair against OECD 28-d offspring output plus direct clutch distributions;
- require deterministic population regression before changing the fixture.

### Trichorhina maturation/brood timing

Current runtime:
- adult development 75 d;
- brood interval 60 d;
- brood size 12.

Evidence:
- species identity, damp habitat and parthenogenetic population structure are reasonably supported;
- direct species-specific maturation/brood timing was not found in the reviewed evidence;
- current timing originates from commercial/husbandry proxy material.

Proposal:
- retain current `CALIBRATED` values;
- prioritize primary literature, museum/culture records or targeted observation;
- keep wide sensitivity bounds and avoid narrowing uncertainty from commercial claims.

### Bradysia body mass and larval feeding

New evidence:
- newly emerged adults: female 0.42 ± 0.01 mg, male 0.23 ± 0.01 mg; lengths 2.22 ± 0.02 and 1.70 ± 0.02 mm.

Current runtime:
- adult carbon target 0.03 mg_C (`ASSUMED`);
- larval feeding 5e-8 mg_C/s (`CALIBRATED`).

Proposal:
- do not replace 0.03 mg_C directly with wet mass;
- source/measure species-appropriate dry-mass and carbon fractions, then derive sex-specific carbon bounds;
- retain larval feeding rate as calibration until a direct consumption/biomass-growth dataset is found.

### Dalotia feeding-density relationship

Evidence:
- adult consumption changes strongly with offered prey density and prey stage;
- one fungus-gnat assay gives ~3.6, 7.0, 11.6 and 18.4 larvae/day at offered densities 10, 20, 30 and 40;
- other assays with much smaller prey stages report much higher maxima.

Proposal:
- keep density-limited predation architecture;
- fit response parameters against a named prey stage/arena protocol;
- treat `maxAdultPreyPerDay=20`, half-saturation 12 and capture 0.75 as calibration, not universal biological constants.

### Plant growth and senescence

Evidence:
- controlled growth conditions exist for *Fittonia* and *Peperomia*;
- current literature does not justify the exact Phase-2 senescence coefficients or Phase-7 maturity/clone/ramet-lifespan values;
- *Pilea depressa* is especially dependent on genus-level horticultural proxy data.

Proposal:
- keep current calibration;
- acquire longitudinal leaf/ramet growth and senescence observations under terrarium-like PPFD, temperature and moisture;
- calibrate allometry and senescence against observables rather than care-guide descriptors.

### Microbial turnover and CUE

Evidence:
- soil/community CUE is strongly method-, substrate-, temperature- and community-dependent;
- published soil estimates can be below 0.4, while substrate-specific methods can exceed 0.6;
- one temperature experiment found mean microbial biomass turnover decreasing from ~325 d at 5 C to ~41 d at 25 C.

Current runtime:
- CUE 0.4 (`ASSUMED`);
- turnover ~20 d characteristic (`CALIBRATED`).

Proposal:
- keep both values unchanged;
- treat them as decomposer-system calibration rather than *Linnemannia*/*Bacillus* traits;
- include CUE method sensitivity and slower turnover benchmarks in system-level calibration experiments.

## Architecture result

The main scalability risk was not lack of fields in documentation; it was that actual machine-readable species data remained a shallow catalog. The v2 catalog + normalized profile layer now makes provenance and missingness executable while keeping simulation algorithms untouched.

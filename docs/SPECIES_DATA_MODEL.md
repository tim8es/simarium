# Simarium — Species data model

Status: normative data specification  
Data architecture: v2 catalog + v1 normalized profiles

## 1. Goal

Biological content must be data-driven, auditable and extensible to dozens of species without embedding new constants in simulation systems.

Simulation algorithms consume species data. They do not decide whether a number is measured biology, a derivation, an assumption or an engineering calibration.

## 2. Files and authority

- `data/species.json` — authoritative MVP species catalog. Membership here means the taxon is approved for MVP runtime.
- `data/species.yml` — human-readable compatibility mirror. JSON is authoritative.
- `data/species-profiles/<id>.json` — normalized profile for each MVP taxon.
- `data/examples/` — schema examples for real taxa that are **not** runtime members.
- `schemas/species.schema.json` — catalog schema.
- `schemas/species-profile.schema.json` — normalized profile and quantitative provenance schema.
- `packages/sim-data/src/validation.ts` — runtime validation used by tests/tools.

A future species must not enter runtime merely because a profile file exists. It enters MVP/runtime only when explicitly added to `data/species.json`.

## 3. Quantitative parameter contract

Every biological or simulation number is represented as an object:

```json
{
  "value": 10,
  "unit": "day",
  "status": "MEASURED",
  "source": "paper_id",
  "notes": "Mean at 20 C.",
  "conditions": "Laboratory culture at 20 C.",
  "confidence": "high",
  "valid_range": { "min": 9, "max": 11 },
  "uncertainty": "±0.5 d SE"
}
```

Allowed statuses:

- `MEASURED` — directly reported for the same taxon/quantity under documented conditions.
- `DERIVED` — mathematically derived from reported evidence; derivation must be described.
- `ASSUMED` — defensible proxy/assumption, not directly measured for this parameter.
- `CALIBRATED` — chosen/fitted for model behavior or an engineering gate.
- `TBD` — evidence is missing.

### TBD rule

Unknown values use `"status": "TBD", "value": null`.

A placeholder such as `0`, `1` or `100` is forbidden for an unknown quantity. Avoiding fake precision is more important than making every field immediately executable.

## 4. Source provenance

Every parameter `source` must resolve to an entry in the profile `sources` array.

Source categories encode provenance class:

1. `peer_reviewed`
2. `official_standard`
3. `taxonomic_database`
4. `university_extension`
5. `specialist_reference`
6. `commercial_proxy`
7. `proxy`
8. `model_internal`

The last three categories are not promoted to biological evidence merely because a value survives calibration.

## 5. Normalized SpeciesProfile

Every profile contains:

- `identity`: accepted scientific name, synonyms, common names, taxonomy and taxon source;
- `biology`: stages, development timing, lifespan, reproduction, body mass, water dependence and thermal response;
- `ecology`: diet, prey, predators, habitat, locomotion, activity layer and substrate preference;
- `simulation`: metabolism, reserves, feeding, assimilation, critical-mass thresholds, reproduction, costs and mortality conditions;
- `render`: approximate dimensions, coloration, stage differences, locomotion style and asset/reference notes;
- `sources`: explicit source registry.

Plant and microbial needs are represented through the same top-level contract. Irrelevant quantitative maps may be empty; unresolved values that matter should be represented as `TBD`.

## 6. Reusable behavioral traits

The controlled trait vocabulary currently includes:

- reproduction: `sexual`, `parthenogenetic`, `clonal`;
- lifecycle/representation: `egg_juvenile_adult`, `egg_larva_pupa_adult`, `manca_juvenile_adult`, `ramet_clonal_lifecycle`, `biomass_field`;
- trophic: `producer`, `detritivore`, `fungivore`, `microbivore`, `predator`, `root_feeder`, `saprotroph`, `litter_source`;
- locomotion/layer: `substrate_walker`, `flyer`, `under_litter`, `groundcover`;
- response: `moisture_sensitive`, `temperature_response`.

Traits are capabilities/hints, not algorithms. A profile may have arbitrary named stages even when no lifecycle shorthand trait exists. The `Stratiolaelaps scimitus` example proves a five-stage mite lifecycle can be represented without adding it to runtime.

## 7. Calibration boundary

Finding a different literature value does **not** automatically replace a `CALIBRATED` parameter.

For any proposed change record:

1. current runtime value and status;
2. literature value/range;
3. species/stage and experimental conditions;
4. why the quantities are comparable or not comparable;
5. target observable to recalibrate;
6. proposed bounds/objective;
7. regression/ecosystem tests affected.

Measured biology and engineering calibration can coexist in the same profile as separate named parameters.

## 8. Adding a new species

1. Confirm the accepted taxon with an accepted taxonomic source.
2. Create `data/species-profiles/<id>.json`.
3. Fill identity/ecology and evidence-backed biology.
4. Mark missing numerical quantities `TBD`; do not invent defaults.
5. Add reusable traits; add a new trait only when it represents a reusable capability.
6. Run runtime provenance validation and schema contract tests.
7. Review weak parameters and calibration needs.
8. Only after source review, ecological-role justification and parameter-coverage review, add the taxon to `data/species.json`.
9. Simulation support for a genuinely new behavior is a separate algorithm proposal.

## 9. Versioning

Species data uses its own `data_version`.

Changes to runtime biological constants should intentionally invalidate deterministic regression hashes/snapshots that depend on them. Pure provenance/documentation additions should not alter simulation behavior.

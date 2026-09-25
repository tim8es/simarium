# Simarium — Simulation model

Status: normative design specification  
Scope: headless ecology and physiology model  
Rule: formulas here are authoritative; rendering must never change ecological state.

## 1. Modeling philosophy

Simarium uses a **mechanistic but coarse-grained** model. It does not attempt molecular realism. It preserves the causal flows that must exist for an autonomous terrarium:

- light energy -> plant carbon fixation;
- plant biomass -> litter / consumers;
- organic matter -> microbial biomass + mineral nutrients;
- consumers -> growth / reproduction / waste / respiration;
- predators -> prey biomass transfer;
- all deaths -> detrital pools;
- water moves between substrate, organisms, surfaces and air.

Every mass transfer has a source, destination and unit.

## 2. Canonical units

Internal calculations use SI-derived units with explicit scale:

- time: seconds;
- distance: meters;
- temperature: degrees Celsius for storage, Kelvin where a formula requires it;
- water: grams H2O;
- carbon: milligrams C;
- nitrogen: milligrams N;
- phosphorus: milligrams P;
- organism wet/dry mass: milligrams, explicitly tagged;
- light: relative PAR initially, upgradeable to umol photons m^-2 s^-1;
- gas concentration: ppm or mol fraction, one convention chosen globally.

Never mix wet mass, dry mass and carbon mass without a conversion parameter.

## 3. State variables

### 3.1 Conserved material pools

Minimum tracked totals:

- H2O;
- C;
- N;
- P.

MVP nitrogen simplification:

```text
organic_N -> available_N -> organism_N
```

Do **not** expose NH4/NO3 as independently meaningful pools until nitrification/denitrification are explicitly modeled.

MVP phosphorus simplification:

```text
organic_P -> available_P -> organism_P
```

### 3.2 Carbon pools

- atmospheric_CO2_C;
- plant_structural_C;
- plant_reserve_C;
- animal_structural_C;
- animal_reserve_C;
- fungal_C;
- bacterial_C;
- fresh_litter_C;
- coarse_detritus_C;
- labile_organic_C;
- stable_soil_C.

### 3.3 Water pools

- substrate_water;
- surface_water;
- atmospheric_vapor;
- plant_water;
- animal_water.

## 4. Numerical integration

The simulation uses fixed timesteps.

Recommended scheduler:

- movement dt: 0.05–0.1 s near-camera;
- behavior dt: 0.2–1 s;
- microclimate dt: 0.5–2 s;
- physiology dt: 1–10 s equivalent model time;
- ecology / nutrient dt: 10–60 s equivalent model time.

When accelerated, several fixed ecology steps are executed per wall-clock frame. Never increase ecological dt arbitrarily to achieve speed-up.

All flows must be clamped by available source mass.

## 5. Plant carbon model

For each leaf cohort:

```text
gross_assimilation =
  Amax
  * f_light(PAR)
  * f_temperature(T)
  * f_water(plant_water_status)
  * f_N(plant_N_status)
  * f_P(plant_P_status)
  * f_CO2(CO2)
  * leaf_area
```

Recommended light response:

```text
f_light(I) = I / (I + K_light)
```

Temperature response: bounded bell-shaped species curve. Use a simple asymmetric or Gaussian response initially, parameterized by optimum and tolerated bounds.

The limiting-resource combination must be explicit. MVP default:

```text
limitation = min(f_water, f_N, f_P)
```

Net carbon:

```text
net_C =
  gross_assimilation
  - maintenance_respiration
  - growth_respiration
```

If net_C is negative, reserve carbon is consumed. If reserves reach zero, structural tissue can be lost and mortality risk increases.

## 6. Plant allocation

Positive carbon is allocated among:

- leaf growth;
- root growth;
- stem/support growth;
- reserve pool;
- clonal reproduction.

Allocation rules are species data, not hard-coded branches.

Root uptake:

```text
water_uptake =
  min(root_capacity,
      local_available_water,
      demand)

N_uptake =
  min(root_N_capacity,
      local_available_N,
      demand)

P_uptake =
  min(root_P_capacity,
      local_available_P,
      demand)
```

Uptake must subtract from substrate pools.

## 7. Leaf senescence

Each leaf cohort has:

- age;
- structural_C/N/P;
- damage;
- photosynthetic_capacity.

Senescence probability/rate depends on:
- age;
- chronic water stress;
- shading;
- damage;
- whole-plant resource status.

When a leaf dies, its remaining C/N/P/H2O moves to a litter entity or litter cell pool.

## 8. Microbial decomposition

Microbial populations are biomass fields, not individual cells.

For microbe group m in cell c:

```text
potential_consumption =
  Vmax_m
  * substrate_C / (K_m + substrate_C)
  * f_temperature(T)
  * f_moisture(W)
  * microbial_biomass
```

Actual consumption is constrained by available C/N/P.

Consumed material is partitioned into:

- microbial growth;
- respiration -> CO2;
- mineralized available N/P;
- residual/stabilized organic matter.

Parameters:
- carbon use efficiency;
- C:N:P biomass ratio;
- substrate preference;
- moisture response;
- temperature response.

No negative source pool is permitted.

## 9. Detritivore feeding

For each feeding event:

```text
ingested = min(bite_capacity, target_available_mass)

assimilated = ingested * assimilation_efficiency
egested = ingested - assimilated
```

Assimilated material is partitioned into:
- reserve energy;
- structural growth;
- reproductive allocation;
- respiration.

Egested material enters a finer/labile detrital pool.

Detritivores therefore accelerate decomposition partly by fragmenting litter.

## 10. Animal metabolism

Each animal has structural mass and reserve energy.

Basal metabolic cost:

```text
BMR = species_BMR
      * mass_scaling(body_mass)
      * f_temperature(T)
```

Activity adds cost:

```text
metabolic_cost = BMR + action_cost[action]
```

Reserve update:

```text
reserve_next = reserve
             + assimilated_energy
             - metabolic_cost
             - reproductive_cost
```

If reserve reaches zero, health deteriorates according to a species-specific starvation tolerance curve.

## 11. Hydration

Animal hydration changes by:
- food water;
- drinking/contact uptake if species-appropriate;
- environmental exchange;
- metabolic loss.

Humidity response affects:
- desiccation loss;
- behavior utility;
- mortality risk.

Do not implement a generic "drink" action for species whose biology is better represented by environmental moisture/contact uptake.

## 12. Behavior utility

For action a:

```text
U(a) = need_factor
     * opportunity_factor
     * environmental_suitability
     * risk_factor
     * species_weight
```

Candidate actions are species-specific.

Example predator hunt utility:

```text
U_hunt =
  hunger
  * prey_detected
  * prey_value
  * distance_factor
  * (1 - danger)
```

Utility AI determines intent; movement/navigation executes the intent.

No agent has global knowledge.

## 13. Predation

A predator can attack only prey it can sense and reach.

Attack success is stochastic but deterministic under the seeded PRNG:

```text
p_success =
  base_capture_rate
  * predator_stage_factor
  * prey_stage_factor
  * local_structure_factor
```

Successful capture transfers prey material; it does not delete the prey and create arbitrary calories.

Unconsumed remains become detritus.

## 14. Reproduction

Reproduction requires:
- appropriate life stage;
- required sex/mate where applicable;
- sufficient reserves;
- environmental constraints;
- reproduction cooldown/development state.

Egg production transfers real C/N/P/H2O from parent reserves/structure to egg pools.

Parthenogenetic species still pay reproductive material/energy costs.

Offspring begin with material that was previously contained in parent/egg pools.

## 15. Development and aging

Life-stage transition uses accumulated development:

```text
development += development_rate(T) * dt
```

This supports temperature-dependent development without scripting a fixed wall-clock date.

Aging is distinct from development.

Senescence mortality uses a species-specific age hazard rather than a deterministic "die at day X" rule unless evidence strongly supports a narrow lifespan.

## 16. Mortality

Possible causes:
- predation;
- starvation;
- desiccation;
- thermal stress;
- senescence;
- severe plant tissue/resource failure.

The engine records one primary and optional contributing causes.

Death creates corpse/detritus mass with conserved C/N/P/H2O.

## 17. Water cycle

Required flows:

```text
surface_water -> substrate_water     infiltration
substrate_water -> plant_water       root uptake
plant_water -> atmospheric_vapor     transpiration
surface_water -> atmospheric_vapor   evaporation
atmospheric_vapor -> surface_water   condensation
surface_water -> substrate_water     runoff/drip
```

Ventilated mode may have explicit vapor boundary flux.
Sealed-material mode may not.

## 18. Gas model

Two modes:

### Ventilated
External atmosphere is a boundary reservoir. CO2/O2 can relax toward boundary concentrations.

### Sealed Gas
CO2 and O2 are explicit internal pools.

Photosynthesis:
- decreases CO2-C;
- increases O2 according to configured stoichiometric approximation.

Respiration does the inverse.

Gas calculations are coarse-grained and are not CFD.

## 19. Spatial diffusion

Grid fields may diffuse between neighbor cells:

```text
delta_x = D * (neighbor - current) * dt
```

Apply conservative pairwise fluxes so that diffusion cannot create or destroy mass.

Use this for:
- water vapor;
- optional CO2/O2;
- heat approximation;
- dissolved/available nutrient movement in substrate if enabled.

## 20. Parameter classes

Every model parameter must be one of:

1. **MEASURED** — directly supported by literature/data.
2. **DERIVED** — calculated from measured quantities.
3. **ASSUMED** — plausible engineering approximation.
4. **CALIBRATED** — fitted to reproduce a documented behavior/range.
5. **TBD** — not yet safe to use.

The runtime species database stores provenance and confidence.

## 21. Hard invariants

At every ecology step:

```text
total_C_next = total_C_prev + boundary_C_flux +/- tolerance
total_N_next = total_N_prev + boundary_N_flux +/- tolerance
total_P_next = total_P_prev + boundary_P_flux +/- tolerance
total_H2O_next = total_H2O_prev + boundary_H2O_flux +/- tolerance
```

Also:
- no pool < -epsilon;
- no NaN/Infinity;
- organism mass > 0 while alive;
- dead organism cannot act;
- life-stage transition graph must be valid;
- no child without a valid reproductive event.

Invariant failure is a test failure, never silently corrected.

## 22. Calibration rule

Calibration may tune continuous coefficients and initial conditions.

Calibration may **not**:
- spawn organisms when populations are low;
- add food/nutrients conditionally;
- suppress death because extinction is inconvenient;
- alter rules based on future knowledge;
- use renderer visibility to change ecology.

The headless model must remain valid without Three.js.

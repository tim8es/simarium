# Simarium — World model

Status: normative design specification

## 1. Physical terrarium

Default MVP enclosure:

- width: 1.20 m;
- depth: 0.60 m;
- height: 0.90 m.

These are configurable world parameters.

Coordinate system:
- X: width;
- Y: height;
- Z: depth;
- world unit: meter.

## 2. Layers

The enclosure contains:

1. glass boundary;
2. air volume;
3. substrate;
4. leaf litter;
5. coarse wood;
6. rocks/hardscape;
7. plants;
8. organisms;
9. surface water/condensation;
10. invisible environmental grids.

## 3. Substrate

MVP substrate is modeled as cells with:
- depth;
- porosity proxy;
- field capacity proxy;
- current water;
- available_N;
- available_P;
- labile organic C;
- stable organic C;
- fungal biomass;
- bacterial biomass;
- temperature.

The exact horticultural recipe is a preset input, not hard-coded into ecology.

## 4. Environmental grid

Initial target:
- air: 16 × 8 × 12 cells;
- substrate: 2D/3D grid aligned to substrate depth, resolution chosen by benchmark.

The grid resolution is configurable.

Each air cell stores:
- temperature;
- absolute humidity;
- relative humidity derived from temperature/humidity;
- light/PAR proxy;
- CO2;
- optional O2.

Each substrate cell stores the variables in section 3.

## 5. Microclimate boundaries

External inputs:
- room temperature schedule;
- light schedule and intensity;
- optional ventilation/permeability;
- optional external humidity for ventilated mode.

Sealed-material mode:
- no water/nutrient/organism inputs after start.

Light and boundary heat remain external energy inputs.

## 6. Day/night

Default cycle:
- configurable 24 h period;
- configurable photoperiod;
- smooth dawn/dusk transition;
- light intensity affects plant physiology;
- temperature boundary can lag light cycle.

Do not tie animal circadian behavior to screen brightness; behavior reads world light/time state.

## 7. Light

MVP light model:
- one or more area/directional emitters;
- geometric attenuation/shading approximation;
- plant leaves reduce light for cells/objects below them;
- renderer light and biological light derive from the same logical sources but are not numerically identical by assumption.

Biological light must be queryable without rendering.

## 8. Temperature

MVP does not solve full heat transfer.

Use:
- boundary temperature;
- light heating term;
- substrate thermal inertia;
- neighbor-cell diffusion;
- configurable glass/room coupling.

The goal is credible gradients, not CFD.

## 9. Humidity

Absolute water vapor is the conserved quantity.
Relative humidity is derived.

Sources:
- evaporation;
- transpiration.

Sinks:
- condensation;
- ventilation boundary.

This avoids treating relative humidity as directly conserved.

## 10. Surface water and condensation

Glass/hardscape surfaces can hold a small water film.

If local surface temperature is below dew-point approximation:
- vapor -> surface water.

Surface water can:
- evaporate;
- drip/run off;
- infiltrate substrate when reaching it.

For MVP, droplets can be visually aggregated; the ecology only needs conserved surface-water mass.

## 11. Hardscape

Hardscape entities expose:
- collision geometry;
- surface class;
- moisture retention coefficient;
- shelter score;
- light occlusion;
- thermal inertia proxy.

Examples:
- cork/wood;
- rock;
- glass;
- litter layer.

## 12. Habitat affordances

Navigation and behavior query affordances rather than arbitrary meshes:

- exposed_surface;
- moist_substrate;
- under_litter;
- under_wood;
- leaf_surface;
- stem_surface;
- flight_volume;
- egg_laying_site;
- fungal_patch.

Species define allowed/preferred affordances.

## 13. Initial conditions

A preset must fully define:
- seed;
- enclosure dimensions;
- light schedule;
- temperature boundary;
- ventilation mode;
- initial water;
- substrate properties;
- detritus/litter mass;
- plant placement and biomass;
- animal populations/stages;
- microbial biomass fields.

No unspecified runtime random defaults are allowed in a reproducible preset.

## 14. World save identity

A world save records:
- engine version;
- schema version;
- preset version;
- species data version;
- seed;
- simulation timestamp.

Loading incompatible saves must fail clearly or run an explicit migration.

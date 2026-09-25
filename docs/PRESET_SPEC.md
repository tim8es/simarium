# Simarium — Preset specification

Status: normative data contract

## 1. Purpose

A preset is a complete reproducible initial world definition.

It must contain enough information that no hidden random default is required.

## 2. Required metadata

```yaml
id:
name:
preset_version:
engine_compatibility:
species_data_version:
seed:
mode:
```

## 3. Enclosure

```yaml
enclosure:
  width_m:
  depth_m:
  height_m:
  gas_boundary: ventilated | low_permeability | sealed
```

## 4. External boundary conditions

```yaml
boundary:
  room_temperature_schedule:
  external_humidity_schedule:
  light:
    photoperiod_hours:
    dawn_minutes:
    dusk_minutes:
    intensity:
  gas_exchange_rate:
```

Only energy/boundary inputs explicitly listed here may enter during Sealed Mode.

## 5. Substrate

```yaml
substrate:
  depth_m:
  porosity:
  field_capacity:
  initial_water_g:
  initial_available_N_mg:
  initial_available_P_mg:
  initial_labile_C_mg:
  initial_stable_C_mg:
```

All values require status/provenance once a preset is promoted from experimental to validated.

## 6. Hardscape

Each object:
```yaml
- type:
  transform:
  material:
  moisture_retention:
  shelter_score:
```

## 7. Plants

Each initial plant/ramet:
```yaml
- species_id:
  position:
  stage:
  initial_structural_C_mg:
  initial_reserve_C_mg:
  initial_N_mg:
  initial_P_mg:
  initial_water_g:
```

## 8. Animals

A preset may define:
- exact individuals; or
- deterministic population generators.

Example:
```yaml
- species_id: folsomia_candida
  count: 120
  stage_distribution:
    juvenile: 0.6
    adult: 0.4
  placement_region: moist_litter_zone
```

Population generation must use the world seed.

## 9. Microbes

```yaml
microbes:
  - species_id:
    initial_total_C_mg:
    spatial_distribution:
```

## 10. Detritus

The stable preset must begin with a realistic finite detrital store.

```yaml
detritus:
  leaf_litter:
    C_mg:
    N_mg:
    P_mg:
    water_g:
  coarse_wood:
    ...
```

## 11. Preset classes

### experiment
May contain TBD/calibrated assumptions and is not user-facing.

### candidate
Passes schema/invariants but has not passed long-run validation.

### validated
Passes the current acceptance suite and has a frozen version.

## 12. Tropical Stable preset

The user-facing MVP preset must be created by:
1. defining bounded initial-condition ranges;
2. running headless calibration;
3. freezing one preset version;
4. evaluating on independent seeds;
5. documenting acceptance results.

It must never contain conditional rescue rules.

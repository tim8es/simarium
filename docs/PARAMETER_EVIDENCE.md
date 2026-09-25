# Simarium — Parameter evidence backlog

Status: Phase 0 research plan

## 1. Purpose

This file lists the biological quantities that must be sourced or explicitly approximated before each implementation phase.

A missing value is safer than an invented value.

## 2. Priority labels

- P0: blocks implementation of the next phase.
- P1: needed before ecological calibration.
- P2: improves fidelity but can follow a functioning model.

## 3. Cross-species P0

For every organism:
- body/biomass scale and wet/dry basis;
- life-stage definitions;
- temperature response;
- moisture/humidity response;
- feeding resource IDs;
- reproduction mode;
- development timing;
- mortality/senescence representation.

For plants:
- light response;
- growth temperature range;
- tissue allocation assumptions;
- leaf senescence scale;
- root/water behavior.

For microbes:
- substrate class;
- growth response to moisture/temperature;
- carbon-use efficiency or bounded assumption;
- biomass stoichiometry or bounded assumption.

## 4. Fittonia albivenis

P0:
- usable growth temperature range;
- relative light response for shade plant;
- approximate dry biomass / leaf area relation;
- clonal spread rules;
- leaf lifespan/senescence calibration target.

P1:
- tissue C:N:P ranges;
- root:shoot allocation response.

## 5. Peperomia caperata

P0:
- growth temperature/light/moisture response;
- allocation/growth-form parameters;
- clonal propagation representation.

P1:
- tissue stoichiometry;
- leaf lifespan.

## 6. Pilea depressa

P0:
- creeping growth rate bounds;
- rooting-at-node rules;
- light/moisture response.

P1:
- tissue stoichiometry;
- competitive shading parameters.

## 7. Folsomia candida

P0:
- body mass by stage;
- egg/development timing versus temperature;
- reproductive interval/fecundity;
- food preference bounds;
- temperature/moisture tolerance.

P1:
- assimilation efficiency;
- starvation/desiccation tolerance;
- movement/encounter calibration.

This species is a first parameterization target because it has substantial ecotoxicology/lifecycle literature.

## 8. Trichorhina tomentosa

P0:
- developmental stages/timing;
- reproduction/fecundity;
- body mass/size mapping;
- moisture preference/tolerance;
- litter/fungal diet representation.

Risk:
species-specific quantitative literature may be thinner. Any proxy parameter must be explicitly tagged and sensitivity-tested.

## 9. Bradysia impatiens

P0:
- egg/larval/pupal durations vs temperature;
- adult longevity;
- fecundity;
- larval food/root damage rates;
- oviposition moisture/substrate conditions;
- adult movement scale.

P1:
- stage masses;
- predator exposure parameters.

## 10. Dalotia coriaria

P0:
- stage durations vs temperature;
- fecundity;
- adult/larval body mass;
- prey spectrum;
- feeding/capture-rate bounds;
- starvation tolerance.

Existing lifecycle literature makes this another early parameterization target.

## 11. Linnemannia elongata

P0:
- temperature/moisture growth envelope;
- substrate classes;
- decomposition/growth calibration range.

P1:
- carbon-use efficiency;
- biomass C:N:P assumptions.

## 12. Bacillus subtilis

P0:
- role must remain deliberately coarse;
- growth response bounds;
- substrate availability relationship.

Risk:
using one bacterial species as "the bacterial decomposition system" is a major abstraction. Validation must target system-level decomposition behavior, not claim community realism.

## 13. Evidence table format

Each sourced value enters the species database with:

| Field | Requirement |
|---|---|
| value/range | numerical |
| unit | explicit |
| status | MEASURED/DERIVED/ASSUMED/CALIBRATED |
| species/stage | exact |
| environmental conditions | temperature, substrate, etc. |
| source | DOI/URL/database |
| source locator | table/figure/page when possible |
| confidence | high/medium/low |
| notes | conversion/proxy caveats |

## 14. Research order

1. *Folsomia candida*
2. *Dalotia coriaria*
3. *Bradysia impatiens*
4. *Fittonia albivenis*
5. microbial decomposition parameters
6. *Trichorhina tomentosa*
7. *Peperomia caperata*
8. *Pilea depressa*

This order follows implementation dependency, not biological importance.

## 15. Stop rule

Do not spend unlimited time searching for a parameter.

If no direct evidence is found:
1. record search coverage;
2. choose a defensible bounded assumption/proxy;
3. mark it clearly;
4. include it in sensitivity analysis.

A transparent approximation is preferable to fake precision.

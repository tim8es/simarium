# Simarium — Assumptions and limitations register

Status: living normative document

## 1. Purpose

Simarium must be explicit about where it is:
- biologically measured;
- mechanistically approximated;
- calibrated;
- visually stylized.

The project must never present engineering approximations as exact ecology.

## 2. A-001 Constructed ecosystem

MVP species do not form one exact natural locality community.

Reason:
- keeps the MVP tractable;
- uses terrarium-compatible real species with complementary roles.

Consequence:
- product claims "bioactive tropical terrarium simulation", not "exact rainforest biotope".

Future:
- add geographically coherent biotope presets.

## 3. A-002 Microbiome compression

The real soil microbiome contains enormous diversity.

MVP explicitly represents:
- *Linnemannia elongata*;
- *Bacillus subtilis*.

They are real species but cannot represent every microbial function.

Consequence:
- microbial processing is coarse-grained;
- do not claim full soil microbiome fidelity.

## 4. A-003 Nitrogen simplification

MVP uses:
```text
organic_N <-> organism_N / available_N
```

It does not claim explicit nitrification, denitrification or nitrogen fixation.

Reason:
- current species roster does not contain a complete nitrogen-cycle guild;
- NH4/NO3 detail would create false precision.

Future:
- add explicit functional species/processes only with evidence.

## 5. A-004 Phosphorus simplification

MVP tracks organic and available P without detailed sorption mineral chemistry.

## 6. A-005 Plant reproduction

MVP may use biologically real clonal/vegetative reproduction for approved plant species.

This creates generation/ramet turnover but is not equivalent to a complete sexual seed cycle.

Product UI and docs must not imply that flowering, pollination and seed genetics are simulated unless implemented.

Future:
- add sexual reproduction per species with pollination/seed requirements.

## 7. A-006 Plant physiology

Photosynthesis, respiration and allocation are coarse-grained functional models.

Not modeled:
- individual stomata;
- vascular hydraulics in detail;
- cellular metabolism;
- photochemistry.

## 8. A-007 Animal physiology

Energy reserve, hydration, growth and reproduction are simplified state variables.

The simulator does not model organs or biochemical pathways.

## 9. A-008 Microclimate

No CFD.

Temperature/humidity/gases use grid diffusion and boundary approximations.

This is sufficient only if validation shows realistic qualitative gradients.

## 10. A-009 Soil physics

Substrate is a porous-cell approximation.

Not modeled:
- every pore;
- exact capillary network;
- full soil chemistry.

## 11. A-010 Genetics/evolution

MVP offspring inherit species identity and may receive deterministic/stochastic variation only if explicitly added.

No evolutionary selection claim.

## 12. A-011 Disease and parasites

Not modeled in MVP.

Mortality therefore omits major real-world causes.

## 13. A-012 Closed-system meaning

"Sealed" means no deliberate organism/food/water/nutrient intervention after start.

Light and heat are external energy/boundary inputs.

Gas permeability is a separate mode.

## 14. A-013 Stability

Stable does not mean static.

Expected:
- oscillations;
- local extinctions in some seeds;
- succession;
- changing biomass distribution.

The model is not allowed to force a target population.

## 15. A-014 Parameter uncertainty

Many ecological parameters will have incomplete species-specific literature.

Every such value is tagged ASSUMED/CALIBRATED/TBD and included in sensitivity analysis.

## 16. Decision log requirement

Any new major assumption receives:
- ID;
- date;
- decision;
- reason;
- affected systems;
- validation impact.

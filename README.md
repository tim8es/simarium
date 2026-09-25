# Simarium

Browser-based 3D simulation of an autonomous tropical terrarium.

The project goal is not to animate a decorative terrarium, but to simulate a small causal ecosystem in which real species grow, feed, reproduce, die, decompose and return matter to the system.

## MVP principles

- All named living organisms are real species with accepted scientific names.
- Simulation state is authoritative; 3D rendering only visualizes it.
- Matter is conserved within explicit resource pools; light is the main external energy input.
- No hidden population rescue, food spawning or nutrient injection in sealed mode.
- Organisms reproduce only through their own life cycles.
- Death produces biomass/detritus that remains inside the ecosystem.
- A stable preset is validated across many deterministic seeds, not by one hand-tuned run.
- Browser-first: TypeScript + Three.js/WebGL2, simulation in a Web Worker.

## MVP species

Plants:
- *Fittonia albivenis* — nerve plant
- *Peperomia caperata* — emerald ripple peperomia
- *Pilea depressa* — miniature peperomia / depressed clearweed

Animals and other invertebrates:
- *Folsomia candida* — springtail
- *Trichorhina tomentosa* — dwarf white isopod
- *Bradysia impatiens* — dark-winged fungus gnat
- *Dalotia coriaria* — rove beetle

Microbial decomposers:
- *Linnemannia elongata* (syn. *Mortierella elongata*) — soil saprotrophic fungus
- *Bacillus subtilis* — soil bacterium

The MVP is a constructed tropical bioactive terrarium, not a claim to reproduce one exact natural geographic biotope.

## Documentation

- [MVP specification](docs/MVP_SPEC.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Simulation model](docs/SIMULATION_MODEL.md)
- [World model](docs/WORLD_MODEL.md)
- [Technical architecture](docs/ARCHITECTURE.md)
- [Species data model](docs/SPECIES_DATA_MODEL.md)
- [Preset specification](docs/PRESET_SPEC.md)
- [Validation strategy](docs/VALIDATION.md)
- [Rendering specification](docs/RENDERING.md)
- [Assumptions and limitations](docs/ASSUMPTIONS.md)
- [Parameter evidence backlog](docs/PARAMETER_EVIDENCE.md)
- [Biology sources](docs/BIOLOGY_SOURCES.md)
- [Species data skeleton](data/species.yml)

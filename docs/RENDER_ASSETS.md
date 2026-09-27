# Simarium — MVP render asset manifest

Status: implementation manifest for the procedural MVP asset set.

This manifest documents the render assets currently used by the browser MVP. These assets are renderer-only and do not own ecological state. Species identity and lifecycle data come from the simulation/species data layer; the render system consumes species/stage labels and transforms.

The current animal assets are intentionally procedural low-poly silhouettes rather than downloaded stock models. That avoids licensing ambiguity and keeps scale/LOD behavior explicit. They are engineering MVP assets, not a claim of museum-grade anatomical reconstruction.

## Source policy

Biological identity and size references are tied to the species evidence already documented in:
- docs/BIOLOGY_SOURCES.md
- docs/PARAMETER_EVIDENCE.md
- data/species.yml

No external texture or mesh license is required for the procedural geometry below.

## Terrarium / hardscape

| Asset | Representation | License/source | LOD |
|---|---|---|---|
| glass enclosure | procedural box + edges | project-generated | single lightweight shell |
| substrate | procedural box | project-generated | single mesh |
| leaf litter | instanced planes | project-generated | instanced |
| rock | instanced dodecahedron | project-generated | instanced |
| wood | instanced low-sided cylinder | project-generated | instanced |
| user hardscape | procedural rock/wood proxy | project-generated | one lightweight mesh per explicit user object |

## Plants

The three MVP plant species use shared instanced procedural leaves/stems with species-specific dimensions and material colors. A plant render entity corresponds to a living ramet; leaf geometry is a visual expansion of that authoritative ramet state, not an independent ecological organism.

| Species | Render identity | Scale basis | LOD strategy |
|---|---|---|---|
| Fittonia albivenis | broader mid-green leaves, taller ramet profile | simulation ramet share -> render scale | instanced leaves + stem |
| Peperomia caperata | broad dark leaves, compact profile | simulation ramet share -> render scale | instanced leaves + stem |
| Pilea depressa | smaller lighter leaves, low profile | simulation ramet share -> render scale | instanced leaves + stem |

Current plant visuals do not yet model leaf damage masks, venation textures or true species morphology. Those are art-quality improvements, not simulation blockers.

## Animals

All dimensions are rendered in meter world units. The style table in apps/web/src/render/BenchmarkScene.ts maps species/stage to approximate visual length/height/width. Life-stage scale is driven by authoritative simulation stage.

| Species / stage | Procedural silhouette | Notes | LOD |
|---|---|---|---|
| Folsomia candida egg | short capsule | compact egg proxy | near instanced / far points |
| F. candida juvenile | elongated capsule | smaller springtail body | near instanced / far points |
| F. candida adult | elongated capsule | longest springtail stage | near instanced / far points |
| Trichorhina tomentosa manca | flattened ellipsoid | small isopod proxy | near instanced / far points |
| T. tomentosa juvenile | flattened ellipsoid | intermediate body | near instanced / far points |
| T. tomentosa adult | flattened ellipsoid | broad pill-shaped body | near instanced / far points |
| Bradysia impatiens egg | short capsule | egg proxy | near instanced / far points |
| B. impatiens larva | elongated capsule | pale fungus-gnat larva | near instanced / far points |
| B. impatiens pupa | compact capsule | brown pupa proxy | near instanced / far points |
| B. impatiens adult | low-poly tapered body | dark flying adult; wings remain a future art pass | near instanced / far points |
| Dalotia coriaria egg | short capsule | egg proxy | near instanced / far points |
| D. coriaria larva | elongated capsule | mobile larva proxy | near instanced / far points |
| D. coriaria pupa | compact capsule | pupa proxy | near instanced / far points |
| D. coriaria adult | elongated dark capsule | rove-beetle body proxy | near instanced / far points |

## LOD contract

Normal mode keeps ecology unchanged regardless of camera distance:
- LOD0/1: at most 260 near animal instances are drawn with species/stage geometry.
- LOD2: remaining visible animals are represented by one point-cloud layer, up to the renderer budget.
- culled: no render object; the organism remains fully simulated.

The renderer receives at most MAX_RENDER_ANIMALS animal render entities per projection. That is a visual budget only; it is not a population cap and never deletes or suppresses organisms in the simulation.

## Animation-state contract

Simulation intent labels map to renderer animation states:
- develop
- forage
- detritus-feed
- hunt
- fly
- grow

The current procedural asset set uses transform/pose-level presentation rather than skeletal animation. The labels are already transported so later mesh/rig replacements do not require changes to ecological algorithms or worker protocol.

## Phase-10 interpretation

This asset set satisfies the technical requirements for species/stage-specific, correctly scaled, LOD-ready browser representations and has explicit provenance. It is not final production art. Anatomical detail, textures, wings/legs, leaf venation, damage masks and decay/fungal surface effects remain visual-quality work that can replace these renderer-only assets without changing the simulation core.

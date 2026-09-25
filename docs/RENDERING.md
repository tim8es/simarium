# Simarium — Rendering specification

Status: visual/technical specification

## 1. Visual target

Style:
- lightweight naturalistic 3D;
- low/mid-poly geometry;
- physically believable scale;
- restrained stylization;
- no toy/cartoon proportions;
- strong macro-photography feeling.

The visual goal is "living museum terrarium", not "strategy game".

## 2. Renderer

MVP baseline:
- Three.js;
- WebGL2;
- standard browser canvas.

Renderer abstraction must not couple sim-core to Three.js.

WebGPU may be introduced later only after baseline parity and profiling.

## 3. Frame budget

Desktop target at 1920×1080:
- 60 FPS target;
- render frame budget ~16.7 ms;
- simulation runs in worker and must not cause main-thread stalls.

Graceful degradation:
- lower shadow quality;
- lower vegetation density;
- lower render distance;
- lower MSAA/post-processing;
- lower visible microfauna count.

Do not reduce ecological simulation simply to maintain graphics FPS unless a validated simulation LOD rule exists.

## 4. Camera

Modes:
- orbit terrarium;
- free inspect;
- macro;
- follow entity.

Macro mode needs:
- near clipping suitable for centimeter/millimeter objects;
- smooth focus transition;
- stable target tracking;
- no large-world precision issue at terrarium scale.

## 5. Terrarium shell

Render:
- glass panes;
- frame if present;
- condensation layer;
- substrate cross-section where visible;
- hardscape.

Glass must remain visually readable without expensive multi-pass realism.

## 6. Plants

Strategies:
- shared geometry;
- instancing where compatible;
- leaf atlas;
- per-instance variation;
- discrete growth morph/stages;
- limited skeletal/procedural stem motion.

Growth visuals derive from plant state:
- leaf cohort count/area;
- age;
- damage;
- senescence.

Do not create decorative leaves that have no simulation counterpart unless explicitly marked visual-only.

## 7. Animals

Per species/stage:
- one or a few optimized meshes;
- skeletal animation only where useful;
- animation states driven from simulation intent/state.

Minimum animation vocabulary:
- idle;
- locomotion;
- feeding;
- attack;
- reproduction interaction if visible;
- death.

For very small organisms, shader/instanced proxy representations are acceptable at distance.

## 8. LOD

### LOD0 Macro
High-detail mesh/animation.

### LOD1 Normal
Reduced mesh, standard animation.

### LOD2 Far
Very low-poly / billboard / instanced proxy.

### Culled
No mesh.

Rendering LOD is camera-dependent and must not modify ecological state.

## 9. Environment animation

Allowed visual-only effects:
- subtle leaf sway;
- condensation sparkle;
- dust/micro-particle ambience.

These must not imply ecological forces unless linked to a simulation variable.

## 10. Lighting

Visual lighting derives from the same schedule as biological light but may use artistic mapping.

Requirements:
- clear day/night;
- soft tropical enclosure feel;
- readable night observation mode;
- local shadows near macro subjects.

Night observation may use a visual exposure aid without increasing biological light.

## 11. Materials

Use PBR-compatible lightweight materials:
- glass;
- damp soil;
- dry/wet leaf litter;
- bark;
- rock;
- living leaves;
- senescent leaves.

Avoid large numbers of unique materials.

## 12. Damage / decay visualization

Plant:
- leaf discoloration;
- holes/damage mask;
- wilt proxy.

Corpse/litter:
- color/roughness change;
- size reduction;
- fungal overlay where justified.

Visual decay level is computed from simulation state.

## 13. Debug overlays

Toggleable:
- environmental grid;
- temperature;
- humidity;
- substrate water;
- light;
- available N/P;
- fungal/bacterial biomass;
- navigation affordances;
- entity sensing radius;
- current action/target.

Debug rendering is not part of performance acceptance for normal mode.

## 14. Render data budget

Main thread receives compact snapshots:
- IDs;
- transforms;
- stage/species;
- animation state;
- visual scalar states.

High-cardinality state should use typed buffers.

Do not send genealogy, full diet history or resource ledgers each frame.

## 15. Asset policy

Each species asset must document:
- real species reference;
- body scale;
- stage represented;
- texture license/source;
- polygon count;
- LODs;
- animation set.

Scientific identity must not be replaced by a vaguely similar stock insect without documentation.

## 16. Rendering benchmark gate

Before full asset production, build a synthetic benchmark scene with:
- terrarium shell;
- dense plants;
- 300 visible moving animal proxies;
- shadows;
- macro camera;
- debug UI disabled.

The benchmark must prove the baseline browser stack before detailed art production.


## 17. Phase 8 benchmark implementation

The Phase 8 benchmark is implemented as two renderer-owned layers:

```text
Simulation-compatible snapshot/delta
        |
        v
packages/render-core
  RenderAdapter + render contracts
        |
        v
apps/web
  Three.js/WebGL2 renderer
```

`packages/render-core` has no dependency on `sim-core` or Three.js. It owns only a copied renderer projection containing IDs, species/stage labels, transforms, scale proxy, animation state and alive/visible flags. Three.js `Object3D` instances are never attached to authoritative organism objects.

The synthetic benchmark source is renderer test data only; it does not implement or approximate ecology.

Implemented benchmark load:
- 1.20 × 0.60 × 0.90 m enclosure in meter world units;
- glass shell, substrate, leaf litter, rocks and wood;
- shared lightweight materials and geometries;
- 180 plant render entities across the three MVP plant species;
- 4,320 instanced leaf visuals derived from those plant entities;
- 1,200 moving animal render entities across the required species/stages;
- camera/frustum-driven animal LOD with at most 260 instanced near animal meshes and a single Points layer for remaining visible entities;
- one shadow-casting directional light plus hemisphere environment light;
- orbit, free inspect, macro and follow-target camera modes;
- HUD for FPS, frame time, draw calls, triangles, total/visible entities, LOD counts and Long Tasks.

Build commands:
- `npm run dev:render`;
- `npm run typecheck:render`;
- `npm run build:render`;
- `npm run preview:render`.

The reproducible target-hardware procedure and recording template live in `docs/RENDER_BENCHMARK.md`.

**Gate note:** CI validates contracts, TypeScript and the production Vite bundle. CI is not evidence for laptop GPU FPS, so Phase 8 remains performance-unverified until a 1920×1080 hardware run is recorded. This prevents a build-only result from being mislabeled as a rendering-performance pass.

# Simarium — Phase 8 rendering benchmark

Status: implementation/methodology for the Phase 8 engineering gate.

## Purpose

This benchmark answers one question before production art begins: can the baseline Three.js/WebGL2 renderer present Simarium-scale visual density at desktop 1920×1080 without coupling the scene graph to authoritative ecology state?

It is intentionally synthetic. It does not validate biological calibration and it must not be used to infer ecological behavior.

## Architecture under test

```text
Synthetic benchmark snapshot/delta
        |
        v
packages/render-core RenderAdapter
        |
        v
renderer-only RenderEntity projection
        |
        v
apps/web Three.js scene
```

`packages/render-core` imports neither `packages/sim-core` nor Three.js. The benchmark source speaks the same renderer-facing contract expected from the future worker bridge.

Three.js objects never reference authoritative organism objects. Camera-dependent LOD and culling do not feed state back into the simulation.

## Synthetic scene budget

World units are meters and the enclosure is 1.20 m × 0.60 m × 0.90 m.

The default benchmark creates:
- 180 plant render entities: 60 each for *Fittonia albivenis*, *Peperomia caperata*, and *Pilea depressa*;
- 24 leaf instances per plant, for 4,320 instanced leaves total;
- 1,200 moving animal render entities;
- 320 *Folsomia candida* adults;
- 240 *Trichorhina tomentosa* adults;
- 220 *Bradysia impatiens* larvae;
- 180 *Bradysia impatiens* adults;
- 240 *Dalotia coriaria* adults;
- instanced leaf litter, rocks, and wood;
- one transparent glass shell, substrate, enclosure edges, hemisphere light, and one shadow-casting directional light.

Animal LOD is deliberately capped at 260 simultaneously rendered instanced animal meshes. Additional camera-visible animals are rendered in one `Points` draw as LOD2 proxies. This keeps 1,000+ moving entities active while testing the required 100–300 mesh range.

No organism gets its own `Mesh` or material. Geometry and materials are shared per visual class/species-stage group.

## Camera modes

1. **Orbit** — whole-terrarium inspection and the primary benchmark view.
2. **Free inspect** — fly-style camera for checking hardscape and enclosure traversal.
3. **Macro** — millimeter-friendly near plane and close framing on the benchmark focus target.
4. **Follow target** — prototype camera that follows a renderer entity ID from the adapter projection.

The benchmark focus target is a synthetic *Dalotia coriaria* adult. Target following reads `RenderAdapter` data only.

## HUD metrics

The on-screen HUD reports:
- rolling FPS;
- rolling frame time;
- Three.js draw calls;
- rendered triangles;
- total render entity count;
- camera-visible render entity count;
- near-LOD animal mesh count;
- LOD2 animal proxy count;
- plant leaf instance count;
- browser Long Tasks count and maximum Long Task duration when the API is available.

## Benchmark procedure

Use a physical laptop-class GPU rather than software rendering or a CI VM.

1. Install dependencies with `npm install`.
2. Run `npm run build:render` and verify the production bundle succeeds.
3. Run `npm run preview:render -- --host 127.0.0.1`.
4. Use a Chromium-class desktop browser with hardware acceleration enabled.
5. Set the browser viewport to 1920×1080 and device pixel ratio to the machine default. The renderer caps DPR at 2.
6. Close DevTools while collecting the representative run; DevTools profiling is a separate diagnostic pass.
7. Warm the scene for 30 seconds so shaders, material programs, and JIT paths are initialized.
8. Record at least 120 seconds in Orbit mode without user input.
9. Record at least 60 seconds in Macro mode and at least 60 seconds in Follow mode.
10. Repeat once after a fresh page load to detect one-off initialization artifacts.

Record hardware, OS, browser/version, GPU, display scale/DPR, power mode, average/median FPS, representative frame time, draw calls, triangles, Long Tasks, and any visible hitching.

## Target interpretation

The Phase 8 target is approximately 60 FPS at 1920×1080 on ordinary laptop-class hardware with no recurring main-thread stalls during steady state.

For the benchmark implementation, use these engineering warning thresholds:
- sustained FPS materially below 55 in the Orbit steady-state pass requires investigation;
- recurring frame times above 20 ms require investigation;
- recurring Long Tasks above 50 ms after warm-up fail the “no long main-thread stalls” intent;
- normal Orbit draw calls should stay in the low tens rather than scale with entity count.

These thresholds are diagnostic, not a substitute for recording the actual target-hardware result.

## CI scope and gate status

CI can verify:
- `RenderAdapter` contract tests;
- TypeScript build for existing headless code plus the renderer-neutral adapter;
- renderer TypeScript typecheck;
- Vite production bundle.

CI cannot establish laptop GPU FPS. Therefore Phase 8 must not be marked fully passed until a target-hardware run is recorded using the procedure above.

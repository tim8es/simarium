import { describe, expect, it } from "vitest";
import {
  IntegratedEcosystemRuntimeAdapter,
  type UserActionEnvelope
} from "../packages/sim-runtime/src/index.js";

function init(seed = 7001): IntegratedEcosystemRuntimeAdapter {
  const adapter = new IntegratedEcosystemRuntimeAdapter();
  adapter.init({
    type: "INIT",
    requestId: "init",
    seed,
    simulationVersion: "test",
    speciesDataVersion: "test",
    presetVersion: "phase7-integrated"
  });
  return adapter;
}

describe("integrated browser runtime", () => {
  it("starts the real ecosystem at virtual time zero and advances deterministically", () => {
    const adapter = init();
    const initial = adapter.renderSnapshot();
    expect(initial.tick).toBe(0);
    expect(initial.virtualTime).toBe(0);
    expect(initial.entities.length).toBeGreaterThan(40);
    expect(initial.entities.some((entity) => entity.speciesId === "folsomia_candida")).toBe(true);
    expect(initial.entities.some((entity) => entity.speciesId === "fittonia_albivenis")).toBe(true);

    adapter.step(48);
    const afterDay = adapter.renderSnapshot();
    expect(afterDay.tick).toBe(48);
    expect(afterDay.virtualTime).toBe(86_400);
  });

  it("reveals succession species only from the conserved propagule bank", () => {
    const adapter = init(7001);
    const before = adapter.renderSnapshot();
    expect(
      before.entities.some((entity) => entity.speciesId === "pilea_microphylla")
    ).toBe(false);

    adapter.step(14 * 48 + 1);

    const after = adapter.renderSnapshot();
    expect(
      after.entities.some((entity) => entity.speciesId === "pilea_microphylla")
    ).toBe(true);

    const saved = adapter.saveSnapshot();
    const pools = saved.sections.materialPools as unknown as {
      pools: Record<string, { carbonMg: number }>;
    };
    expect(pools.pools.pilea_microphylla_seedbank!.carbonMg).toBeLessThan(24);

    const stats = adapter.stats() as unknown as {
      populations: Record<string, number>;
      materialLedger: {
        residuals: {
          carbonMg: { residual: number };
          nitrogenMg: { residual: number };
          phosphorusMg: { residual: number };
          waterG: { residual: number };
        };
      };
    };
    expect(stats.populations.pilea_microphylla).toBeGreaterThan(0);
    expect(Math.abs(stats.materialLedger.residuals.carbonMg.residual)).toBeLessThan(1e-6);
    expect(Math.abs(stats.materialLedger.residuals.nitrogenMg.residual)).toBeLessThan(1e-6);
    expect(Math.abs(stats.materialLedger.residuals.phosphorusMg.residual)).toBeLessThan(1e-6);
    expect(Math.abs(stats.materialLedger.residuals.waterG.residual)).toBeLessThan(1e-6);
  });

  it("round-trips an integrated world through deterministic replay save/load", () => {
    const source = init(7017);
    source.step(8);
    const action: UserActionEnvelope = {
      sequence: 0,
      targetTick: 8,
      action: { type: "set_light", intensity: 0.65 }
    };
    source.applyUserAction(action);
    source.step(12);

    const saved = source.saveSnapshot();
    const expected = source.renderSnapshot();
    const expectedStats = source.stats();

    const restored = new IntegratedEcosystemRuntimeAdapter();
    restored.loadSnapshot(saved);

    expect(restored.renderSnapshot()).toEqual(expected);
    expect(restored.stats()).toEqual(expectedStats);
  });

  it("applies explicit boundary actions and organism removal", () => {
    const adapter = init();
    const initial = adapter.renderSnapshot();
    const folsomia = initial.entities.find(
      (entity) => entity.speciesId === "folsomia_candida"
    );
    expect(folsomia).toBeDefined();

    adapter.applyUserAction({
      sequence: 0,
      targetTick: 0,
      action: { type: "add_water", waterG: 2 }
    });
    adapter.applyUserAction({
      sequence: 1,
      targetTick: 0,
      action: { type: "set_light", intensity: 0.5 }
    });
    adapter.applyUserAction({
      sequence: 2,
      targetTick: 0,
      action: { type: "remove_organisms", entityIds: [folsomia!.entityId] }
    });
    adapter.step(1);

    const after = adapter.renderSnapshot();
    expect(after.entities.some((entity) => entity.entityId === folsomia!.entityId)).toBe(false);

    const stats = adapter.stats() as unknown as {
      controls: { lightMultiplier: number };
    };
    expect(stats.controls.lightMultiplier).toBe(0.5);

    const saved = adapter.saveSnapshot();
    const ledger = saved.sections.materialPools as unknown as {
      cumulativeBoundaryFlux: { waterG: number };
    };
    // Removing a living organism is an explicit negative boundary flux for its
    // body water, so net boundary water is slightly below the +2 g mist input.
    expect(ledger.cumulativeBoundaryFlux.waterG).toBeGreaterThan(1.99);
  });

  it("round-trips every MVP boundary action through save/load and deterministic continuation", () => {
    const source = init(7067);
    const initial = source.renderSnapshot();
    const removable = initial.entities.find(
      (entity) => entity.speciesId === "folsomia_candida"
    );
    expect(removable).toBeDefined();

    const actions: UserActionEnvelope[] = [
      {
        sequence: 0,
        targetTick: 0,
        action: { type: "add_water", waterG: 1.5 }
      },
      {
        sequence: 1,
        targetTick: 0,
        action: {
          type: "add_litter",
          material: {
            carbonMg: 100,
            nitrogenMg: 2,
            phosphorusMg: 0.2,
            waterG: 0.5
          }
        }
      },
      {
        sequence: 2,
        targetTick: 0,
        action: {
          type: "introduce_organisms",
          speciesId: "folsomia_candida",
          count: 2
        }
      },
      {
        sequence: 3,
        targetTick: 0,
        action: { type: "set_light", intensity: 0.65 }
      },
      {
        sequence: 4,
        targetTick: 0,
        action: { type: "set_ventilation", ratePerSecond: 0.00002 }
      },
      {
        sequence: 5,
        targetTick: 0,
        action: {
          type: "add_hardscape",
          hardscapeId: "persistent-hardscape",
          kind: "wood",
          position: { x: 0, y: 0.14, z: 0 }
        }
      },
      {
        sequence: 6,
        targetTick: 0,
        action: {
          type: "add_hardscape",
          hardscapeId: "temporary-hardscape",
          kind: "stone",
          position: { x: 0.1, y: 0.1, z: 0 }
        }
      },
      {
        sequence: 7,
        targetTick: 0,
        action: {
          type: "remove_hardscape",
          hardscapeId: "temporary-hardscape"
        }
      },
      {
        sequence: 8,
        targetTick: 0,
        action: {
          type: "remove_organisms",
          entityIds: [removable!.entityId]
        }
      }
    ];

    for (const action of actions) {
      source.applyUserAction(action);
    }
    source.step(3);

    const saved = source.saveSnapshot();
    const restored = new IntegratedEcosystemRuntimeAdapter();
    restored.loadSnapshot(saved);

    const restoredSave = restored.saveSnapshot();
    expect(restoredSave.tick).toBe(saved.tick);
    expect(restoredSave.virtualTime).toBe(saved.virtualTime);
    expect(restoredSave.rngState).toEqual(saved.rngState);
    expect(restoredSave.sections.materialPools).toEqual(
      saved.sections.materialPools
    );
    expect(restoredSave.sections.organisms).toEqual(
      saved.sections.organisms
    );
    expect(restoredSave.sections.plants).toEqual(saved.sections.plants);
    expect(restoredSave.sections.spatialState).toEqual(
      saved.sections.spatialState
    );

    const stats = restored.stats() as unknown as {
      controls: {
        lightMultiplier: number;
        ventilationRatePerSecond: number;
      };
      hardscape: Array<{ id: string }>;
    };
    expect(stats.controls.lightMultiplier).toBe(0.65);
    expect(stats.controls.ventilationRatePerSecond).toBe(0.00002);
    expect(stats.hardscape.some((item) => item.id === "persistent-hardscape")).toBe(true);
    expect(stats.hardscape.some((item) => item.id === "temporary-hardscape")).toBe(false);

    const followOn: UserActionEnvelope = {
      sequence: 9,
      targetTick: saved.tick,
      action: { type: "set_light", intensity: 0.9 }
    };
    source.applyUserAction(followOn);
    restored.applyUserAction(structuredClone(followOn));
    source.step(5);
    restored.step(5);

    const sourceEnd = source.saveSnapshot();
    const restoredEnd = restored.saveSnapshot();
    expect(restoredEnd.tick).toBe(sourceEnd.tick);
    expect(restoredEnd.virtualTime).toBe(sourceEnd.virtualTime);
    expect(restoredEnd.rngState).toEqual(sourceEnd.rngState);
    expect(restoredEnd.coreState).toEqual(sourceEnd.coreState);
    expect(restoredEnd.userActionQueue).toEqual(sourceEnd.userActionQueue);
    expect(restoredEnd.sections).toEqual(sourceEnd.sections);
  });

  it("records explicit diagnostic cause when a plant ramet is removed", () => {
    const adapter = init(7071);
    const plant = adapter.renderSnapshot().entities.find(
      (entity) => entity.speciesId === "fittonia_albivenis"
    );
    expect(plant).toBeDefined();

    adapter.applyUserAction({
      sequence: 0,
      targetTick: 0,
      action: {
        type: "remove_organisms",
        entityIds: [plant!.entityId]
      }
    });
    adapter.step(1);

    expect(
      adapter.renderSnapshot().entities.some(
        (entity) => entity.entityId === plant!.entityId
      )
    ).toBe(false);

    const stats = adapter.stats() as unknown as {
      events: {
        recent: Array<{
          speciesId: string;
          type: string;
          entityId: string | null;
          label: string;
        }>;
      };
    };
    expect(stats.events.recent).toContainEqual(
      expect.objectContaining({
        speciesId: "fittonia_albivenis",
        type: "death",
        entityId: plant!.entityId,
        label: expect.stringContaining("user_removal")
      })
    );
  });

  it("keeps ecology deterministic when render and stats are observed", () => {
    const observed = init(7041);
    const headless = init(7041);

    for (let tick = 0; tick < 32; tick++) {
      const render = observed.renderSnapshot();
      observed.stats();
      const inspectable = render.entities.find(
        (entity) => entity.speciesId === "fittonia_albivenis"
      );
      if (!inspectable) throw new Error("Expected an inspectable Fittonia ramet");
      observed.entityDetails(inspectable.entityId);
      observed.step(1);
      headless.step(1);
    }

    const observedSave = observed.saveSnapshot();
    const headlessSave = headless.saveSnapshot();
    expect(observedSave.tick).toBe(headlessSave.tick);
    expect(observedSave.virtualTime).toBe(headlessSave.virtualTime);
    expect(observedSave.rngState).toEqual(headlessSave.rngState);
    expect(observedSave.sections.materialPools).toEqual(
      headlessSave.sections.materialPools
    );
    expect(observedSave.sections.organisms).toEqual(
      headlessSave.sections.organisms
    );
    expect(observedSave.sections.plants).toEqual(
      headlessSave.sections.plants
    );
    expect(observedSave.sections.spatialState).toEqual(
      headlessSave.sections.spatialState
    );
  });


  it("exposes lifecycle-backed causal history for selected entities", () => {
    const adapter = init(7055);
    adapter.step(1);
    const snapshot = adapter.renderSnapshot();
    const selected = snapshot.entities.find(
      (entity) => entity.speciesId === "folsomia_candida"
    );
    expect(selected).toBeDefined();

    const details = adapter.entityDetails(selected!.entityId) as unknown as {
      history: Array<{
        timeSeconds: number;
        type: string;
        label: string;
      }>;
    };
    expect(details.history.length).toBeGreaterThan(0);
    expect(details.history.some((event) => event.type === "birth")).toBe(true);
    expect(details.history.every((event) => Number.isFinite(event.timeSeconds))).toBe(true);
  });


  it("survives repeated integrated save-load-resume cycles without state drift", () => {
    const direct = init(7099);
    let cycled = init(7099);

    for (let cycle = 0; cycle < 5; cycle++) {
      const action: UserActionEnvelope = {
        sequence: cycle,
        targetTick: direct.saveSnapshot().tick,
        action:
          cycle % 2 === 0
            ? { type: "set_light", intensity: 0.8 + cycle * 0.05 }
            : { type: "add_water", waterG: 0.5 + cycle * 0.1 }
      };
      direct.applyUserAction(action);
      cycled.applyUserAction(structuredClone(action));

      direct.step(12);
      cycled.step(12);

      const saved = cycled.saveSnapshot();
      const replacement = new IntegratedEcosystemRuntimeAdapter();
      replacement.loadSnapshot(saved);
      cycled = replacement;
    }

    const directEnd = direct.saveSnapshot();
    const cycledEnd = cycled.saveSnapshot();
    expect(cycledEnd.tick).toBe(directEnd.tick);
    expect(cycledEnd.virtualTime).toBe(directEnd.virtualTime);
    expect(cycledEnd.rngState).toEqual(directEnd.rngState);
    expect(cycledEnd.sections.materialPools).toEqual(
      directEnd.sections.materialPools
    );
    expect(cycledEnd.sections.organisms).toEqual(
      directEnd.sections.organisms
    );
    expect(cycledEnd.sections.plants).toEqual(
      directEnd.sections.plants
    );
    expect(cycledEnd.sections.spatialState).toEqual(
      directEnd.sections.spatialState
    );
  });


  it("replays boundary, organism and hardscape actions through save-load without drift", () => {
    const source = init(7111);
    const initial = source.renderSnapshot();
    const removable = initial.entities.find(
      (entity) => entity.speciesId === "folsomia_candida"
    );
    expect(removable).toBeDefined();

    const actions: UserActionEnvelope[] = [
      {
        sequence: 0,
        targetTick: 0,
        action: {
          type: "add_litter",
          material: {
            carbonMg: 120,
            nitrogenMg: 2.4,
            phosphorusMg: 0.24,
            waterG: 0.6
          }
        }
      },
      {
        sequence: 1,
        targetTick: 0,
        action: { type: "set_ventilation", ratePerSecond: 0.0002 }
      },
      {
        sequence: 2,
        targetTick: 0,
        action: {
          type: "introduce_organisms",
          speciesId: "trichorhina_tomentosa",
          count: 2
        }
      },
      {
        sequence: 3,
        targetTick: 0,
        action: {
          type: "add_hardscape",
          hardscapeId: "validation-wood",
          kind: "wood",
          position: { x: 0.1, y: 0.14, z: -0.05 }
        }
      },
      {
        sequence: 4,
        targetTick: 0,
        action: {
          type: "remove_organisms",
          entityIds: [removable!.entityId]
        }
      }
    ];
    actions.forEach((action) => source.applyUserAction(action));
    source.step(4);

    const saved = source.saveSnapshot();
    const restored = new IntegratedEcosystemRuntimeAdapter();
    restored.loadSnapshot(saved);

    expect(restored.saveSnapshot().rngState).toEqual(saved.rngState);
    expect(restored.saveSnapshot().sections.materialPools).toEqual(
      saved.sections.materialPools
    );
    expect(restored.saveSnapshot().sections.organisms).toEqual(
      saved.sections.organisms
    );
    expect(restored.saveSnapshot().sections.spatialState).toEqual(
      saved.sections.spatialState
    );

    const stats = restored.stats() as unknown as {
      controls: { ventilationRatePerSecond: number };
      hardscape: Array<{ id: string }>;
    };
    expect(stats.controls.ventilationRatePerSecond).toBe(0.0002);
    expect(stats.hardscape.some((item) => item.id === "validation-wood")).toBe(true);

    source.step(8);
    restored.step(8);
    expect(restored.saveSnapshot().rngState).toEqual(source.saveSnapshot().rngState);
    expect(restored.saveSnapshot().sections.materialPools).toEqual(
      source.saveSnapshot().sections.materialPools
    );
    expect(restored.saveSnapshot().sections.organisms).toEqual(
      source.saveSnapshot().sections.organisms
    );
    expect(restored.saveSnapshot().sections.spatialState).toEqual(
      source.saveSnapshot().sections.spatialState
    );
  });

  it("keeps all animal species represented when render populations exceed the visual budget", () => {
    const adapter = init(7053);
    const species = [
      "folsomia_candida",
      "trichorhina_tomentosa",
      "bradysia_impatiens",
      "dalotia_coriaria"
    ] as const;

    species.forEach((speciesId, sequence) => {
      adapter.applyUserAction({
        sequence,
        targetTick: 0,
        action: {
          type: "introduce_organisms",
          speciesId,
          count: 400
        }
      });
    });
    adapter.step(1);

    const snapshot = adapter.renderSnapshot();
    const renderedAnimals = snapshot.entities.filter(
      (entity) => !entity.speciesId.includes("fittonia") &&
        !entity.speciesId.includes("peperomia") &&
        !entity.speciesId.includes("pilea")
    );
    expect(renderedAnimals.length).toBeLessThanOrEqual(1200);
    for (const speciesId of species) {
      const rendered = renderedAnimals.filter(
        (entity) => entity.speciesId === speciesId
      );
      expect(rendered.length).toBe(300);
    }
  });


  it("keeps the rendered animal cohort stable as an over-budget population grows", () => {
    const adapter = init(7131);
    adapter.applyUserAction({
      sequence: 0,
      targetTick: 0,
      action: {
        type: "introduce_organisms",
        speciesId: "trichorhina_tomentosa",
        count: 400
      }
    });
    adapter.step(1);

    const before = adapter.renderSnapshot().entities
      .filter((entity) => entity.speciesId === "trichorhina_tomentosa")
      .map((entity) => entity.entityId);
    expect(before.length).toBe(300);

    adapter.applyUserAction({
      sequence: 1,
      targetTick: 1,
      action: {
        type: "introduce_organisms",
        speciesId: "trichorhina_tomentosa",
        count: 50
      }
    });
    adapter.step(1);

    const after = adapter.renderSnapshot().entities
      .filter((entity) => entity.speciesId === "trichorhina_tomentosa")
      .map((entity) => entity.entityId);
    const beforeSet = new Set(before);
    const retained = after.filter((id) => beforeSet.has(id));

    expect(after.length).toBe(300);
    expect(retained.length).toBeGreaterThanOrEqual(290);
  });

  it("renders a newly introduced plant as sparse emerging growth before it matures", () => {
    const adapter = init(7133);
    adapter.applyUserAction({
      sequence: 0,
      targetTick: 0,
      action: {
        type: "introduce_organisms",
        speciesId: "fittonia_albivenis",
        count: 1,
        lifeStage: "ramet"
      }
    });
    adapter.step(1);

    const snapshot = adapter.renderSnapshot();
    const young = snapshot.entities
      .filter((entity) => entity.speciesId === "fittonia_albivenis")
      .find((entity) =>
        entity.action === "new-growth" &&
        Number(
          (entity.debugAttributes as { visualGrowthProgress?: number } | undefined)
            ?.visualGrowthProgress
        ) === 0
      );

    expect(young).toBeDefined();
    expect(young!.displayScale).toBeLessThan(0.3);
    const initialScale = young!.displayScale;

    adapter.step(48 * 6);

    const grown = adapter.renderSnapshot().entities.find(
      (entity) => entity.entityId === young!.entityId
    );
    expect(grown).toBeDefined();
    expect(grown!.displayScale).toBeGreaterThan(initialScale);
    expect(
      Number(
        (grown!.debugAttributes as { visualGrowthProgress?: number } | undefined)
          ?.visualGrowthProgress
      )
    ).toBeGreaterThan(0);
  });

});

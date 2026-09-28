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

  it("keeps ecology deterministic when render and stats are observed", () => {
    const observed = init(7041);
    const headless = init(7041);

    for (let tick = 0; tick < 32; tick++) {
      observed.renderSnapshot();
      observed.stats();
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
    const adapter = init(7061);
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

  it("renders newly introduced plant ramets as small growth stages instead of instant adults", () => {
    const adapter = init(7067);
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

    const young = adapter.renderSnapshot().entities.find((entity) =>
      entity.speciesId === "fittonia_albivenis" &&
      entity.action === "emerge" &&
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

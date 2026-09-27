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
    expect(ledger.cumulativeBoundaryFlux.waterG).toBeGreaterThanOrEqual(2);
  });
});

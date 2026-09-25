import { describe, expect, it } from "vitest";
import { Phase1SimulationRuntimeAdapter } from "../packages/sim-runtime/src/index.ts";

describe("concrete simulation worker adapter", () => {
  it("runs sim-core, saves, reloads and resumes deterministically", () => {
    const direct = new Phase1SimulationRuntimeAdapter();
    direct.init({
      type: "INIT",
      requestId: "init",
      seed: 4242,
      simulationVersion: "0.1.0-test",
      speciesDataVersion: "species-test",
      config: { fixedDtSeconds: 60, roomTemperatureC: 24 }
    });

    direct.step(10);
    direct.applyUserAction({
      sequence: 0,
      targetTick: 10,
      action: { type: "add_water", waterG: 25, targetPool: "surface_water" }
    });
    direct.step(5);

    const saved = direct.saveSnapshot();
    expect(saved.tick).toBe(15);
    expect(saved.sections.materialPools).not.toBeNull();

    direct.step(25);
    const directEnd = direct.saveSnapshot();

    const restored = new Phase1SimulationRuntimeAdapter();
    restored.loadSnapshot(saved);
    restored.step(25);
    const restoredEnd = restored.saveSnapshot();

    expect(restoredEnd.coreState).toEqual(directEnd.coreState);
    expect(restoredEnd.rngState).toEqual(directEnd.rngState);
    expect(restoredEnd.tick).toBe(directEnd.tick);
    expect(restoredEnd.virtualTime).toBe(directEnd.virtualTime);
  });

  it("routes supported material actions through boundary flux and rejects unavailable ecology actions", () => {
    const adapter = new Phase1SimulationRuntimeAdapter();
    adapter.init({
      type: "INIT",
      requestId: "init",
      seed: 9,
      simulationVersion: "0.1.0-test",
      speciesDataVersion: "species-test"
    });

    const before = adapter.stats() as {
      materialTotals: { waterG: number };
    };

    adapter.applyUserAction({
      sequence: 0,
      targetTick: 0,
      action: { type: "add_water", waterG: 12.5 }
    });
    adapter.step(1);

    const after = adapter.stats() as {
      materialTotals: { waterG: number };
    };
    expect(after.materialTotals.waterG - before.materialTotals.waterG).toBeCloseTo(12.5, 10);

    adapter.applyUserAction({
      sequence: 1,
      targetTick: 1,
      action: { type: "introduce_organisms", speciesId: "folsomia_candida", count: 5 }
    });
    expect(() => adapter.step(1)).toThrow(/integrated ecosystem runtime adapter/);
  });
});

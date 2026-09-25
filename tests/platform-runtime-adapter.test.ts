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

  it("preserves pending USER_ACTION state and sequence watermarks across save/load", () => {
    const direct = new Phase1SimulationRuntimeAdapter();
    direct.init({
      type: "INIT",
      requestId: "init",
      seed: 55,
      simulationVersion: "0.1.0-test",
      speciesDataVersion: "species-test",
      config: { fixedDtSeconds: 60 }
    });
    direct.step(5);
    direct.applyUserAction({
      sequence: 7,
      targetTick: 10,
      action: { type: "add_water", waterG: 40 }
    });

    const saved = direct.saveSnapshot();
    expect(saved.userActionQueue).toEqual({
      pending: [{
        sequence: 7,
        targetTick: 10,
        action: { type: "add_water", waterG: 40 }
      }],
      lastSequence: 7,
      lastTargetTick: 10
    });

    direct.step(10);
    const directEnd = direct.saveSnapshot();

    const restored = new Phase1SimulationRuntimeAdapter();
    restored.loadSnapshot(saved);
    restored.step(10);
    const restoredEnd = restored.saveSnapshot();

    expect(restoredEnd.coreState).toEqual(directEnd.coreState);
    expect(restoredEnd.userActionQueue).toEqual(directEnd.userActionQueue);
    expect(() => restored.applyUserAction({
      sequence: 7,
      targetTick: restoredEnd.tick,
      action: { type: "add_water", waterG: 1 }
    })).toThrow(/sequence must increase/);
  });

  it("clears stale pending actions when INIT replaces the world", () => {
    const adapter = new Phase1SimulationRuntimeAdapter();
    adapter.init({
      type: "INIT",
      requestId: "first",
      seed: 1,
      simulationVersion: "0.1.0-test",
      speciesDataVersion: "species-test"
    });
    adapter.applyUserAction({
      sequence: 5,
      targetTick: 10,
      action: { type: "add_water", waterG: 100 }
    });

    adapter.init({
      type: "INIT",
      requestId: "second",
      seed: 2,
      simulationVersion: "0.1.0-test",
      speciesDataVersion: "species-test"
    });
    adapter.step(11);
    const saved = adapter.saveSnapshot();
    expect(saved.userActionQueue).toEqual({
      pending: [],
      lastSequence: -1,
      lastTargetTick: -1
    });
    expect((saved.coreState as { ledger: { cumulativeBoundaryFlux: { waterG: number } } }).ledger.cumulativeBoundaryFlux.waterG).toBe(0);
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

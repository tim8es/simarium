import { describe, expect, it } from "vitest";
import { mockObservationSnapshot } from "../apps/web/src/mock-data.js";
import { createUserAction, formatAge, getOverlayValue } from "../apps/web/src/view-model.js";

describe("observation UI contracts", () => {
  it("emits interventions as queued USER_ACTION envelopes", () => {
    const action = createUserAction("ADD_LITTER", { grams: 2 }, 1234);
    expect(action).toEqual({
      id: "ui-1234-add_litter",
      source: "USER_ACTION",
      type: "ADD_LITTER",
      createdAtUiMs: 1234,
      status: "queued",
      payload: { grams: 2 }
    });
  });

  it("contains the required observation overlay values", () => {
    const env = mockObservationSnapshot.environment;
    expect(getOverlayValue(env, "temperature")).toContain("°C");
    expect(getOverlayValue(env, "humidity")).toContain("RH");
    expect(getOverlayValue(env, "availableP")).toContain("mg/kg");
    expect(getOverlayValue(env, "fungalBiomass")).toContain("mg");
  });

  it("keeps inspection DTOs independent from lifecycle classes", () => {
    const entity = mockObservationSnapshot.entities.find(item => item.id === 1042);
    expect(entity?.kind).toBe("animal");
    expect(entity && "currentAction" in entity ? entity.currentAction : null).toBe("FORAGE");
    expect(formatAge(18.6 * 86400)).toContain("19");
  });

  it("ships the exact requested time-control speeds as UI state contract values", () => {
    const speeds = [1, 5, 20, 100] as const;
    expect(speeds).toEqual([1, 5, 20, 100]);
  });
});

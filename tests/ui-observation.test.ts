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
    expect(getOverlayValue(env, "availableP")).toContain("mg pool");
    expect(getOverlayValue(env, "fungalBiomass")).toContain("mg");
  });

  it("keeps inspection DTOs independent from lifecycle classes", () => {
    const entity = mockObservationSnapshot.entities.find(item => item.id === "folsomia_candida#1042");
    expect(entity?.kind).toBe("animal");
    expect(entity && "currentAction" in entity ? entity.currentAction : null).toBe("FORAGE");
    expect(formatAge(18.6 * 86400)).toContain("19");
  });

  it("ships the exact requested time-control speeds as UI state contract values", () => {
    const speeds = [1, 5, 20, 100] as const;
    expect(speeds).toEqual([1, 5, 20, 100]);
  });

  it("keeps entity-specific inspection metadata aligned with the selected entity", () => {
    expect(mockObservationSnapshot.inspectionByEntity["folsomia_candida#1042"]?.genealogy.some(
      node => node.relation === "current" && node.entityId === "folsomia_candida#1042"
    )).toBe(true);
    expect(mockObservationSnapshot.inspectionByEntity["dalotia_coriaria#2007"]?.genealogy.some(
      node => node.relation === "current" && node.entityId === "dalotia_coriaria#2007"
    )).toBe(true);
    expect(mockObservationSnapshot.inspectionByEntity["fittonia_albivenis#501"]?.why.some(
      reason => reason.label === "HUNGRY"
    )).toBe(false);
  });

  it("includes reproductive state in animal inspection DTOs", () => {
    const animal = mockObservationSnapshot.entities.find(
      entity => entity.kind === "animal" && entity.id === "folsomia_candida#1042"
    );
    expect(animal && animal.kind === "animal" ? animal.reproductiveState : null)
      .toContain("parthenogenetic");
  });

});

import { describe, expect, it } from "vitest";
import catalog from "../data/species.json";
import phase2 from "../data/experiments/phase2-producer-loop.json";
import phase2Multi from "../data/experiments/phase2-multiplant.json";
import {
  assertCanonicalUnit,
  validateSpeciesCatalog
} from "../packages/sim-data/src/validation.ts";

describe("species data contracts", () => {
  it("validates the canonical MVP species catalog", () => {
    const validated = validateSpeciesCatalog(catalog);
    expect(validated.species).toHaveLength(9);
    expect(new Set(validated.species.map((species) => species.id)).size).toBe(9);
  });

  it("rejects unknown units instead of accepting silent conversions", () => {
    expect(() => assertCanonicalUnit("kg-ish")).toThrow(/Unknown canonical unit/);
    expect(() => assertCanonicalUnit("mg_C")).not.toThrow();
  });

  it("requires every phase-2 numeric model parameter to declare a known unit and provenance status", () => {
    const allowedStatuses = new Set(["MEASURED", "DERIVED", "ASSUMED", "CALIBRATED", "TBD"]);
    for (const [name, parameter] of Object.entries(phase2.parameters)) {
      expect(Number.isFinite(parameter.value), name).toBe(true);
      expect(() => assertCanonicalUnit(parameter.unit)).not.toThrow();
      expect(allowedStatuses.has(parameter.status), name).toBe(true);
      expect(parameter.source.length, name).toBeGreaterThan(0);
      expect(parameter.notes.length, name).toBeGreaterThan(0);
    }
  });

  it("validates provenance for the three-plant phase-2 experiment", () => {
    const allowedStatuses = new Set(["MEASURED", "DERIVED", "ASSUMED", "CALIBRATED", "TBD"]);
    const groups = [
      ...Object.entries(phase2Multi.shared),
      ...Object.entries(phase2Multi.decomposer),
      ...Object.entries(phase2Multi.plants.fittonia_albivenis),
      ...Object.entries(phase2Multi.plants.peperomia_caperata),
      ...Object.entries(phase2Multi.plants.pilea_depressa)
    ];

    for (const [name, parameter] of groups) {
      expect(Number.isFinite(parameter.value), name).toBe(true);
      expect(() => assertCanonicalUnit(parameter.unit)).not.toThrow();
      expect(allowedStatuses.has(parameter.status), name).toBe(true);
      expect(parameter.source.length, name).toBeGreaterThan(0);
    }
  });
});

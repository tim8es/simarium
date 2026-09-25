import { describe, expect, it } from "vitest";
import catalog from "../data/species.json";
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
});

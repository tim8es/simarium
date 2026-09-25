import { describe, expect, it } from "vitest";
import catalog from "../data/species.json";
import fittonia from "../data/species-profiles/fittonia_albivenis.json";
import peperomia from "../data/species-profiles/peperomia_caperata.json";
import pilea from "../data/species-profiles/pilea_depressa.json";
import folsomia from "../data/species-profiles/folsomia_candida.json";
import trichorhina from "../data/species-profiles/trichorhina_tomentosa.json";
import bradysia from "../data/species-profiles/bradysia_impatiens.json";
import dalotia from "../data/species-profiles/dalotia_coriaria.json";
import linnemannia from "../data/species-profiles/linnemannia_elongata.json";
import bacillus from "../data/species-profiles/bacillus_subtilis.json";
import futureExample from "../data/examples/species-profile.stratiolaelaps_scimitus.json";
import catalogSchema from "../schemas/species.schema.json";
import profileSchema from "../schemas/species-profile.schema.json";
import {
  validateQuantitativeParameter,
  validateSpeciesCatalog,
  validateSpeciesProfile
} from "../packages/sim-data/src/validation.ts";

const mvpProfiles = [
  fittonia,
  peperomia,
  pilea,
  folsomia,
  trichorhina,
  bradysia,
  dalotia,
  linnemannia,
  bacillus
];

function walkParameters(value: unknown, visit: (parameter: Record<string, unknown>) => void): void {
  if (Array.isArray(value)) {
    value.forEach((item) => walkParameters(item, visit));
    return;
  }
  if (!value || typeof value !== "object") return;
  const object = value as Record<string, unknown>;
  if ("status" in object && "unit" in object && "value" in object) {
    visit(object);
    return;
  }
  for (const child of Object.values(object)) walkParameters(child, visit);
}

describe("normalized species profiles", () => {
  it("validates every MVP profile and keeps catalog/profile membership one-to-one", () => {
    const validatedCatalog = validateSpeciesCatalog(catalog);
    expect(validatedCatalog.species).toHaveLength(9);
    expect(mvpProfiles).toHaveLength(9);

    const byId = new Map(mvpProfiles.map((profile) => {
      const validated = validateSpeciesProfile(profile);
      expect(validated.runtime_membership).toBe("MVP");
      return [validated.id, validated] as const;
    }));

    for (const entry of validatedCatalog.species) {
      const profile = byId.get(entry.id);
      expect(profile, entry.id).toBeDefined();
      expect(profile?.identity.accepted_scientific_name).toBe(entry.scientific_name);
      expect(new Set(profile?.traits)).toEqual(new Set(entry.traits));
      expect(entry.profile_path).toBe(`data/species-profiles/${entry.id}.json`);
    }
  });

  it("validates the real future-species example without adding it to MVP runtime", () => {
    const validated = validateSpeciesProfile(futureExample);
    expect(validated.id).toBe("stratiolaelaps_scimitus");
    expect(validated.runtime_membership).toBe("EXAMPLE_ONLY");
    expect(catalog.species.some((entry) => entry.id === validated.id)).toBe(false);
    expect((validated.biology as Record<string, unknown>).stages).toEqual([
      "egg",
      "larva",
      "protonymph",
      "deutonymph",
      "adult"
    ]);
  });

  it("requires provenance on every quantitative parameter", () => {
    for (const profile of [...mvpProfiles, futureExample]) {
      const sourceById = new Map(profile.sources.map((source) => [source.id, source]));
      walkParameters(profile, (parameter) => {
        expect(typeof parameter.unit).toBe("string");
        expect(typeof parameter.source).toBe("string");
        expect(typeof parameter.notes).toBe("string");
        expect(String(parameter.notes).length).toBeGreaterThan(0);

        if (parameter.status === "TBD") {
          expect(parameter.value).toBeNull();
        } else {
          expect(Number.isFinite(parameter.value)).toBe(true);
        }

        const source = sourceById.get(String(parameter.source));
        expect(source, `${profile.id}:${String(parameter.source)}`).toBeDefined();
        if (parameter.status === "MEASURED" || parameter.status === "DERIVED") {
          expect(["model_internal", "commercial_proxy", "proxy"]).not.toContain(source?.category);
        }
      });
    }
  });

  it("rejects fake numeric placeholders for TBD and invalid provenance ranges", () => {
    expect(() => validateQuantitativeParameter({
      value: 0,
      unit: "day",
      status: "TBD",
      source: "paper",
      notes: "Unknown value"
    })).toThrow(/must be null/);

    expect(() => validateQuantitativeParameter({
      value: 10,
      unit: "day",
      status: "MEASURED",
      source: "paper",
      notes: "Measured",
      valid_range: { min: 12, max: 8 }
    })).toThrow(/min must be <= max/);

    expect(() => validateQuantitativeParameter({
      value: 10,
      unit: "day",
      status: "MEASURED",
      source: "missing",
      notes: "Measured"
    }, "parameter", new Set(["paper"]))).toThrow(/unknown source id/);
  });

  it("keeps JSON Schema and runtime provenance requirements aligned", () => {
    expect(catalogSchema.properties.schema_version.const).toBe(2);
    expect(catalogSchema.properties.species.items.required).toContain("profile_path");

    const quantitative = profileSchema.$defs.quantitativeParameter;
    expect(quantitative.required).toEqual(
      expect.arrayContaining(["value", "unit", "status", "source", "notes"])
    );
    expect(quantitative.properties.status.enum).toEqual([
      "MEASURED",
      "DERIVED",
      "ASSUMED",
      "CALIBRATED",
      "TBD"
    ]);
  });
});

import Ajv2020 from "ajv/dist/2020.js";
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

import phase2 from "../data/experiments/phase2-producer-loop.json";
import phase2Multi from "../data/experiments/phase2-multiplant.json";
import phase3Folsomia from "../data/experiments/phase3-folsomia.json";
import phase4Trichorhina from "../data/experiments/phase4-trichorhina.json";
import phase5Bradysia from "../data/experiments/phase5-bradysia.json";
import phase6Dalotia from "../data/experiments/phase6-dalotia.json";

import catalogSchema from "../schemas/species.schema.json";
import profileSchema from "../schemas/species-profile.schema.json";

import {
  assertCanonicalUnit,
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

describe("species data contracts", () => {
  it("validates the canonical MVP catalog through runtime validation", () => {
    const validated = validateSpeciesCatalog(catalog);
    expect(validated.species).toHaveLength(9);
    expect(new Set(validated.species.map((species) => species.id)).size).toBe(9);
    expect(new Set(validated.species.map((species) => species.profile_path)).size).toBe(9);
  });

  it("validates all normalized MVP profiles through runtime validation", () => {
    for (const profile of mvpProfiles) {
      expect(() => validateSpeciesProfile(profile), profile.id).not.toThrow();
      expect(profile.runtime_membership, profile.id).toBe("MVP");
    }
  });

  it("keeps the future real-taxon example outside the MVP runtime catalog", () => {
    expect(() => validateSpeciesProfile(futureExample)).not.toThrow();
    expect(futureExample.runtime_membership).toBe("EXAMPLE_ONLY");
    expect(catalog.species.some((species) => species.id === futureExample.id)).toBe(false);
    expect(futureExample.biology.stages).toEqual([
      "egg",
      "larva",
      "protonymph",
      "deutonymph",
      "adult"
    ]);
  });

  it("validates catalog and profiles against JSON Schema Draft 2020-12", () => {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const validateCatalogSchema = ajv.compile(catalogSchema);
    const validateProfileSchema = ajv.compile(profileSchema);

    expect(validateCatalogSchema(catalog), JSON.stringify(validateCatalogSchema.errors)).toBe(true);
    for (const profile of [...mvpProfiles, futureExample]) {
      expect(validateProfileSchema(profile), `${profile.id}: ${JSON.stringify(validateProfileSchema.errors)}`).toBe(true);
    }
  });

  it("rejects unknown units instead of accepting silent conversions", () => {
    expect(() => assertCanonicalUnit("kg-ish")).toThrow(/Unknown canonical unit/);
    expect(() => assertCanonicalUnit("mg_C")).not.toThrow();
  });

  it("requires TBD parameters to use null rather than invented placeholder numbers", () => {
    expect(() =>
      validateQuantitativeParameter({
        value: null,
        unit: "day",
        status: "TBD",
        source: "example",
        notes: "Unknown on purpose."
      })
    ).not.toThrow();

    expect(() =>
      validateQuantitativeParameter({
        value: 1,
        unit: "day",
        status: "TBD",
        source: "example",
        notes: "Fake precision."
      })
    ).toThrow(/must be null/);
  });

  it("requires every legacy experiment parameter to retain provenance metadata", () => {
    const allowedStatuses = new Set(["MEASURED", "DERIVED", "ASSUMED", "CALIBRATED", "TBD"]);
    const groups: Array<[string, Record<string, { value: number; unit: string; status: string; source: string; notes?: string }>]> = [
      ["phase2", phase2.parameters],
      ["phase2.shared", phase2Multi.shared],
      ["phase2.decomposer", phase2Multi.decomposer],
      ["phase2.fittonia", phase2Multi.plants.fittonia_albivenis],
      ["phase2.peperomia", phase2Multi.plants.peperomia_caperata],
      ["phase2.pilea", phase2Multi.plants.pilea_depressa],
      ["phase3.folsomia", phase3Folsomia.parameters],
      ["phase4.trichorhina", phase4Trichorhina.parameters],
      ["phase5.bradysia", phase5Bradysia.parameters],
      ["phase6.dalotia", phase6Dalotia.parameters]
    ];

    for (const [groupName, group] of groups) {
      for (const [name, parameter] of Object.entries(group)) {
        expect(Number.isFinite(parameter.value), `${groupName}.${name}`).toBe(true);
        expect(() => assertCanonicalUnit(parameter.unit), `${groupName}.${name}`).not.toThrow();
        expect(allowedStatuses.has(parameter.status), `${groupName}.${name}`).toBe(true);
        expect(parameter.source.length, `${groupName}.${name}`).toBeGreaterThan(0);
      }
    }
  });

  it("does not silently replace highlighted calibrated/assumed runtime values", () => {
    expect(phase3Folsomia.parameters.clutchSize).toMatchObject({
      value: 6,
      status: "CALIBRATED"
    });
    expect(phase4Trichorhina.parameters.adultDevelopmentDays).toMatchObject({
      value: 75,
      status: "CALIBRATED"
    });
    expect(phase4Trichorhina.parameters.broodIntervalDays).toMatchObject({
      value: 60,
      status: "CALIBRATED"
    });
    expect(phase5Bradysia.parameters.adultCarbonTargetMg).toMatchObject({
      value: 0.03,
      status: "ASSUMED"
    });
    expect(phase5Bradysia.parameters.larvalFeedingCarbonMgPerSecond).toMatchObject({
      value: 5e-8,
      status: "CALIBRATED"
    });
    expect(phase6Dalotia.parameters.preyHalfSaturationCount).toMatchObject({
      value: 12,
      status: "CALIBRATED"
    });
    expect(phase2Multi.plants.fittonia_albivenis.senescenceRatePerSecond.status).toBe("CALIBRATED");
    expect(phase2Multi.plants.peperomia_caperata.senescenceRatePerSecond.status).toBe("CALIBRATED");
    expect(phase2Multi.plants.pilea_depressa.senescenceRatePerSecond.status).toBe("CALIBRATED");
    expect(phase2Multi.decomposer.carbonUseEfficiency).toMatchObject({
      value: 0.4,
      status: "ASSUMED"
    });
    expect(phase2Multi.decomposer.microbialTurnoverRatePerSecond).toMatchObject({
      value: 5.787e-7,
      status: "CALIBRATED"
    });
  });
});

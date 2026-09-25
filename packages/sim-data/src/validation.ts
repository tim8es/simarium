export const PARAMETER_STATUSES = [
  "MEASURED",
  "DERIVED",
  "ASSUMED",
  "CALIBRATED",
  "TBD"
] as const;

export type ParameterStatus = (typeof PARAMETER_STATUSES)[number];

export const CANONICAL_UNITS = new Set([
  "s",
  "day",
  "m",
  "mm",
  "degC",
  "g_H2O",
  "mg_wet",
  "mg_dry",
  "mg_C",
  "mg_N",
  "mg_P",
  "1/s",
  "relative_PAR",
  "dimensionless",
  "mg_C/s",
  "mg_N/mg_C",
  "mg_P/mg_C",
  "g_H2O/mg_C"
]);

export interface SpeciesCatalogEntry {
  id: string;
  scientific_name: string;
  type: "plant" | "animal" | "fungus" | "bacterium";
  ecological_roles: string[];
  life_stages?: string[];
  sources: string[];
  runtime_parameter_status: "TBD" | "PARTIAL" | "READY";
}

export interface SpeciesCatalog {
  schema_version: number;
  data_version: string;
  status: string;
  species: SpeciesCatalogEntry[];
}

function assertString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${path} must be a non-empty string`);
  }
}

function assertStringArray(value: unknown, path: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${path} must be an array of strings`);
  }
}

export function assertCanonicalUnit(unit: string): void {
  if (!CANONICAL_UNITS.has(unit)) {
    throw new Error(`Unknown canonical unit: ${unit}`);
  }
}

export function validateSpeciesCatalog(value: unknown): SpeciesCatalog {
  if (!value || typeof value !== "object") throw new Error("Catalog must be an object");
  const catalog = value as Record<string, unknown>;

  if (!Number.isInteger(catalog.schema_version) || Number(catalog.schema_version) <= 0) {
    throw new Error("schema_version must be a positive integer");
  }
  assertString(catalog.data_version, "data_version");
  assertString(catalog.status, "status");
  if (!Array.isArray(catalog.species)) throw new Error("species must be an array");

  const seen = new Set<string>();
  for (let i = 0; i < catalog.species.length; i++) {
    const raw = catalog.species[i];
    if (!raw || typeof raw !== "object") {
      throw new Error(`species[${i}] must be an object`);
    }
    const entry = raw as Record<string, unknown>;

    assertString(entry.id, `species[${i}].id`);
    if (!/^[a-z0-9_]+$/.test(entry.id)) {
      throw new Error(`species[${i}].id must be snake_case ASCII`);
    }
    if (seen.has(entry.id)) throw new Error(`Duplicate species id: ${entry.id}`);
    seen.add(entry.id);

    assertString(entry.scientific_name, `species[${i}].scientific_name`);
    if (!["plant", "animal", "fungus", "bacterium"].includes(String(entry.type))) {
      throw new Error(`species[${i}].type is invalid`);
    }
    assertStringArray(entry.ecological_roles, `species[${i}].ecological_roles`);
    assertStringArray(entry.sources, `species[${i}].sources`);
    if (entry.sources.length === 0) {
      throw new Error(`species[${i}] must contain at least one source`);
    }
    if (!["TBD", "PARTIAL", "READY"].includes(String(entry.runtime_parameter_status))) {
      throw new Error(`species[${i}].runtime_parameter_status is invalid`);
    }
    if (entry.life_stages !== undefined) {
      assertStringArray(entry.life_stages, `species[${i}].life_stages`);
    }
  }

  return value as SpeciesCatalog;
}

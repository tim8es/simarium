export const PARAMETER_STATUSES = [
  "MEASURED",
  "DERIVED",
  "ASSUMED",
  "CALIBRATED",
  "TBD"
] as const;

export type ParameterStatus = (typeof PARAMETER_STATUSES)[number];

export const SOURCE_CATEGORIES = [
  "peer_reviewed",
  "official_standard",
  "taxonomic_database",
  "university_extension",
  "specialist_reference",
  "commercial_proxy",
  "proxy",
  "model_internal"
] as const;

export type SourceCategory = (typeof SOURCE_CATEGORIES)[number];

export const BEHAVIORAL_TRAITS = [
  "sexual",
  "parthenogenetic",
  "clonal",
  "egg_juvenile_adult",
  "egg_larva_pupa_adult",
  "manca_juvenile_adult",
  "ramet_clonal_lifecycle",
  "biomass_field",
  "detritivore",
  "fungivore",
  "microbivore",
  "predator",
  "root_feeder",
  "producer",
  "saprotroph",
  "litter_source",
  "substrate_walker",
  "flyer",
  "under_litter",
  "groundcover",
  "moisture_sensitive",
  "temperature_response"
] as const;

export type BehavioralTrait = (typeof BEHAVIORAL_TRAITS)[number];

export const CANONICAL_UNITS = new Set([
  "s",
  "day",
  "hour",
  "m",
  "cm",
  "mm",
  "um",
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
  "count",
  "count/day",
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
  life_stages: string[];
  traits: BehavioralTrait[];
  profile_path: string;
  sources: string[];
  runtime_parameter_status: "TBD" | "PARTIAL" | "READY";
}

export interface SpeciesCatalog {
  schema_version: number;
  data_version: string;
  status: string;
  species: SpeciesCatalogEntry[];
}

export interface QuantitativeParameter {
  value: number | null;
  unit: string;
  status: ParameterStatus;
  source: string;
  notes: string;
  source_locator?: string;
  conditions?: string;
  confidence?: "high" | "medium" | "low";
  valid_range?: { min: number; max: number };
  uncertainty?: string;
}

export interface SpeciesProfile {
  schema_version: number;
  data_version: string;
  id: string;
  runtime_membership: "MVP" | "EXAMPLE_ONLY";
  profile_status: "PARTIAL" | "READY";
  identity: Record<string, unknown>;
  traits: BehavioralTrait[];
  biology: Record<string, unknown>;
  ecology: Record<string, unknown>;
  simulation: Record<string, unknown>;
  render: Record<string, unknown>;
  sources: Array<{
    id: string;
    category: SourceCategory;
    citation: string;
    url?: string;
    confidence: "high" | "medium" | "low";
    notes?: string;
  }>;
}

function assertString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${path} must be a non-empty string`);
  }
}

function assertStringArray(value: unknown, path: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new Error(`${path} must be an array of non-empty strings`);
  }
}

function assertObject(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
}

export function assertCanonicalUnit(unit: string): void {
  if (!CANONICAL_UNITS.has(unit)) {
    throw new Error(`Unknown canonical unit: ${unit}`);
  }
}

export function validateQuantitativeParameter(
  value: unknown,
  path = "parameter",
  sourceIds?: ReadonlySet<string>
): QuantitativeParameter {
  assertObject(value, path);
  const parameter = value as Record<string, unknown>;

  if (!PARAMETER_STATUSES.includes(parameter.status as ParameterStatus)) {
    throw new Error(`${path}.status is invalid`);
  }
  const status = parameter.status as ParameterStatus;

  if (!Object.prototype.hasOwnProperty.call(parameter, "value")) {
    throw new Error(`${path}.value is required`);
  }
  if (status === "TBD") {
    if (parameter.value !== null) {
      throw new Error(`${path}.value must be null when status is TBD`);
    }
  } else if (typeof parameter.value !== "number" || !Number.isFinite(parameter.value)) {
    throw new Error(`${path}.value must be a finite number unless status is TBD`);
  }

  assertString(parameter.unit, `${path}.unit`);
  assertCanonicalUnit(parameter.unit);
  assertString(parameter.source, `${path}.source`);
  assertString(parameter.notes, `${path}.notes`);

  if (sourceIds && !sourceIds.has(parameter.source)) {
    throw new Error(`${path}.source references unknown source id: ${parameter.source}`);
  }

  if (parameter.confidence !== undefined && !["high", "medium", "low"].includes(String(parameter.confidence))) {
    throw new Error(`${path}.confidence is invalid`);
  }
  if (parameter.conditions !== undefined) assertString(parameter.conditions, `${path}.conditions`);
  if (parameter.source_locator !== undefined) assertString(parameter.source_locator, `${path}.source_locator`);
  if (parameter.uncertainty !== undefined) assertString(parameter.uncertainty, `${path}.uncertainty`);

  if (parameter.valid_range !== undefined) {
    assertObject(parameter.valid_range, `${path}.valid_range`);
    const range = parameter.valid_range as Record<string, unknown>;
    if (typeof range.min !== "number" || !Number.isFinite(range.min) ||
        typeof range.max !== "number" || !Number.isFinite(range.max)) {
      throw new Error(`${path}.valid_range must contain finite min/max`);
    }
    if (range.min > range.max) throw new Error(`${path}.valid_range min must be <= max`);
    if (typeof parameter.value === "number" && (parameter.value < range.min || parameter.value > range.max)) {
      throw new Error(`${path}.value must be inside valid_range`);
    }
  }

  return value as QuantitativeParameter;
}

function walkQuantitativeParameters(
  value: unknown,
  path: string,
  sourceIds: ReadonlySet<string>
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkQuantitativeParameters(item, `${path}[${index}]`, sourceIds));
    return;
  }
  if (!value || typeof value !== "object") return;

  const object = value as Record<string, unknown>;
  const looksLikeParameter =
    Object.prototype.hasOwnProperty.call(object, "value") ||
    Object.prototype.hasOwnProperty.call(object, "unit") ||
    (Object.prototype.hasOwnProperty.call(object, "status") &&
      PARAMETER_STATUSES.includes(object.status as ParameterStatus));

  if (looksLikeParameter) {
    validateQuantitativeParameter(object, path, sourceIds);
    return;
  }

  for (const [key, child] of Object.entries(object)) {
    walkQuantitativeParameters(child, `${path}.${key}`, sourceIds);
  }
}

export function validateSpeciesCatalog(value: unknown): SpeciesCatalog {
  assertObject(value, "catalog");
  const catalog = value as Record<string, unknown>;

  if (catalog.schema_version !== 2) {
    throw new Error("schema_version must be 2");
  }
  assertString(catalog.data_version, "data_version");
  assertString(catalog.status, "status");
  if (!Array.isArray(catalog.species)) throw new Error("species must be an array");

  const seen = new Set<string>();
  const profilePaths = new Set<string>();
  const allowedTraits = new Set<string>(BEHAVIORAL_TRAITS);

  for (let i = 0; i < catalog.species.length; i++) {
    const raw = catalog.species[i];
    assertObject(raw, `species[${i}]`);
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
    assertStringArray(entry.life_stages, `species[${i}].life_stages`);
    assertStringArray(entry.traits, `species[${i}].traits`);
    for (const trait of entry.traits) {
      if (!allowedTraits.has(trait)) throw new Error(`species[${i}] has unknown trait: ${trait}`);
    }
    assertString(entry.profile_path, `species[${i}].profile_path`);
    if (!/^data\/species-profiles\/[a-z0-9_]+\.json$/.test(entry.profile_path)) {
      throw new Error(`species[${i}].profile_path is invalid`);
    }
    if (profilePaths.has(entry.profile_path)) throw new Error(`Duplicate profile_path: ${entry.profile_path}`);
    profilePaths.add(entry.profile_path);

    assertStringArray(entry.sources, `species[${i}].sources`);
    if (entry.sources.length === 0) throw new Error(`species[${i}] must contain at least one source`);
    if (!["TBD", "PARTIAL", "READY"].includes(String(entry.runtime_parameter_status))) {
      throw new Error(`species[${i}].runtime_parameter_status is invalid`);
    }
  }

  return value as SpeciesCatalog;
}

export function validateSpeciesProfile(value: unknown): SpeciesProfile {
  assertObject(value, "profile");
  const profile = value as Record<string, unknown>;

  if (profile.schema_version !== 1) throw new Error("profile.schema_version must be 1");
  assertString(profile.data_version, "profile.data_version");
  assertString(profile.id, "profile.id");
  if (!/^[a-z0-9_]+$/.test(profile.id)) throw new Error("profile.id must be snake_case ASCII");
  if (!["MVP", "EXAMPLE_ONLY"].includes(String(profile.runtime_membership))) {
    throw new Error("profile.runtime_membership is invalid");
  }
  if (!["PARTIAL", "READY"].includes(String(profile.profile_status))) {
    throw new Error("profile.profile_status is invalid");
  }

  assertObject(profile.identity, "profile.identity");
  const identity = profile.identity as Record<string, unknown>;
  assertString(identity.accepted_scientific_name, "profile.identity.accepted_scientific_name");
  assertStringArray(identity.synonyms, "profile.identity.synonyms");
  assertStringArray(identity.common_names, "profile.identity.common_names");
  assertString(identity.taxon_source, "profile.identity.taxon_source");
  assertObject(identity.taxonomy, "profile.identity.taxonomy");
  for (const rank of ["kingdom", "phylum", "class", "order", "family", "genus", "species"]) {
    assertString((identity.taxonomy as Record<string, unknown>)[rank], `profile.identity.taxonomy.${rank}`);
  }

  assertStringArray(profile.traits, "profile.traits");
  const allowedTraits = new Set<string>(BEHAVIORAL_TRAITS);
  for (const trait of profile.traits) {
    if (!allowedTraits.has(trait)) throw new Error(`profile has unknown trait: ${trait}`);
  }

  for (const section of ["biology", "ecology", "simulation", "render"]) {
    assertObject(profile[section], `profile.${section}`);
  }

  if (!Array.isArray(profile.sources) || profile.sources.length === 0) {
    throw new Error("profile.sources must be a non-empty array");
  }

  const sourceIds = new Set<string>();
  const sourceCategories = new Set<string>(SOURCE_CATEGORIES);
  for (let i = 0; i < profile.sources.length; i++) {
    const rawSource = profile.sources[i];
    assertObject(rawSource, `profile.sources[${i}]`);
    assertString(rawSource.id, `profile.sources[${i}].id`);
    if (sourceIds.has(rawSource.id)) throw new Error(`Duplicate source id: ${rawSource.id}`);
    sourceIds.add(rawSource.id);
    if (!sourceCategories.has(String(rawSource.category))) {
      throw new Error(`profile.sources[${i}].category is invalid`);
    }
    assertString(rawSource.citation, `profile.sources[${i}].citation`);
    if (!["high", "medium", "low"].includes(String(rawSource.confidence))) {
      throw new Error(`profile.sources[${i}].confidence is invalid`);
    }
    if (rawSource.url !== undefined) assertString(rawSource.url, `profile.sources[${i}].url`);
    if (rawSource.notes !== undefined) assertString(rawSource.notes, `profile.sources[${i}].notes`);
  }

  if (!sourceIds.has(identity.taxon_source)) {
    throw new Error(`profile.identity.taxon_source references unknown source id: ${identity.taxon_source}`);
  }

  for (const section of ["biology", "simulation", "render"]) {
    walkQuantitativeParameters(profile[section], `profile.${section}`, sourceIds);
  }

  return value as SpeciesProfile;
}

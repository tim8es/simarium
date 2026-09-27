import type { JsonValue } from "../../../../packages/sim-runtime/src/index.js";
import type {
  BehaviorReason,
  EntityInspection,
  EntitySummary,
  EnvironmentSnapshot,
  FoodWebLink,
  GenealogyNode,
  ObservationSnapshot,
  PopulationSeries,
  SpeciesSummary
} from "../contracts.js";

function record(value: JsonValue | undefined, name: string): Record<string, JsonValue> {
  if (value === null || value === undefined || Array.isArray(value) || typeof value !== "object") {
    throw new Error(`${name} must be an object`);
  }
  return value;
}

function numberValue(value: JsonValue | undefined, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nullableNumber(value: JsonValue | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: JsonValue | undefined, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function boolValue(value: JsonValue | undefined, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function array(value: JsonValue | undefined): JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function stringArray(value: JsonValue | undefined): string[] {
  return array(value).filter((item): item is string => typeof item === "string");
}

export function emptyObservationSnapshot(): ObservationSnapshot {
  return {
    species: [],
    entities: [],
    environment: {
      timeSeconds: 0,
      temperatureC: 24,
      relativeHumidity: 0,
      soilWater: 0,
      lightPar: 0,
      co2Ppm: 0,
      o2Percent: null,
      nh4MgKg: null,
      no3MgKg: null,
      availablePMgKg: null,
      availableNitrogenMg: 0,
      availablePhosphorusMg: 0,
      fungalBiomassMg: 0,
      bacterialBiomassMg: 0,
      litterMg: 0
    },
    populations: [],
    inspectionByEntity: {},
    foodWeb: []
  };
}

export function statsToObservation(stats: JsonValue): ObservationSnapshot {
  const root = record(stats, "stats");
  const environmentRaw = record(root.environment, "stats.environment");
  const resources = record(root.resources, "stats.resources");

  const environment: EnvironmentSnapshot = {
    timeSeconds: numberValue(environmentRaw.timeSeconds),
    temperatureC: numberValue(environmentRaw.temperatureC, 24),
    relativeHumidity: numberValue(environmentRaw.relativeHumidity),
    soilWater: numberValue(environmentRaw.soilWater),
    lightPar: numberValue(environmentRaw.lightPar),
    co2Ppm: numberValue(environmentRaw.co2Ppm),
    o2Percent: nullableNumber(environmentRaw.o2Percent),
    nh4MgKg: nullableNumber(environmentRaw.nh4MgKg),
    no3MgKg: nullableNumber(environmentRaw.no3MgKg),
    availablePMgKg: nullableNumber(environmentRaw.availablePMgKg),
    availableNitrogenMg: numberValue(resources.availableNitrogenMg),
    availablePhosphorusMg: numberValue(resources.availablePhosphorusMg),
    fungalBiomassMg: numberValue(environmentRaw.fungalBiomassMg),
    bacterialBiomassMg: numberValue(environmentRaw.bacterialBiomassMg),
    litterMg: numberValue(environmentRaw.litterMg)
  };

  const species: SpeciesSummary[] = array(root.species).map((entry) => {
    const item = record(entry, "species entry");
    return {
      id: stringValue(item.id),
      commonName: stringValue(item.commonName),
      scientificName: stringValue(item.scientificName),
      category: stringValue(item.category) as SpeciesSummary["category"],
      trophicRole: stringValue(item.trophicRole) as SpeciesSummary["trophicRole"]
    };
  });

  const speciesById = new Map(species.map((item) => [item.id, item]));
  const populationSeriesRaw = record(root.populationSeries, "stats.populationSeries");
  const populations: PopulationSeries[] = Object.entries(populationSeriesRaw).map(
    ([speciesId, pointsValue]) => {
      const points = array(pointsValue).map((pointValue) => {
        const point = record(pointValue, "population point");
        return {
          timeSeconds: numberValue(point.timeSeconds),
          value: numberValue(point.value)
        };
      });
      return {
        speciesId,
        label:
          speciesById.get(speciesId)?.scientificName
            .split(" ")
            .map((part, index) => (index === 0 ? `${part[0] ?? ""}.` : part))
            .join(" ") ?? speciesId,
        points
      };
    }
  );

  const foodWeb: FoodWebLink[] = array(root.foodWeb).map((entry) => {
    const item = record(entry, "foodWeb entry");
    return {
      sourceSpeciesId: stringValue(item.sourceSpeciesId),
      targetSpeciesId: stringValue(item.targetSpeciesId),
      biomassTransferMg: numberValue(item.biomassTransferMg)
    };
  });

  return {
    species,
    entities: [],
    environment,
    populations,
    inspectionByEntity: {},
    foodWeb
  };
}

export function entityDetailsToUi(details: JsonValue): {
  entity: EntitySummary;
  inspection: EntityInspection;
} {
  const root = record(details, "entity details");
  const entity = record(root.entity, "entity details.entity");
  const kind = stringValue(entity.kind);
  const id = stringValue(entity.id);
  if (!id) throw new Error("Entity details missing authoritative id");

  let summary: EntitySummary;
  if (kind === "animal") {
    summary = {
      kind: "animal",
      id,
      speciesId: stringValue(entity.speciesId),
      commonName: stringValue(entity.commonName),
      scientificName: stringValue(entity.scientificName),
      lifeStage: stringValue(entity.lifeStage),
      ageSeconds: numberValue(entity.ageSeconds),
      biomassMg: numberValue(entity.biomassMg),
      reserveEnergy: numberValue(entity.reserveEnergy),
      hydration: numberValue(entity.hydration),
      currentAction: stringValue(entity.currentAction, "unknown"),
      birthTimeSeconds: numberValue(entity.birthTimeSeconds),
      parentIds: stringArray(entity.parentIds),
      offspringCount: numberValue(entity.offspringCount),
      reproductiveState: stringValue(entity.reproductiveState, "unknown"),
      ...(typeof entity.deathCause === "string"
        ? { deathCause: entity.deathCause }
        : {})
    };
  } else if (kind === "plant") {
    summary = {
      kind: "plant",
      id,
      speciesId: stringValue(entity.speciesId),
      commonName: stringValue(entity.commonName),
      scientificName: stringValue(entity.scientificName),
      lifeStage: stringValue(entity.lifeStage, "ramet"),
      rametAgeSeconds: numberValue(entity.rametAgeSeconds),
      biomassMg: numberValue(entity.biomassMg),
      waterStatus: numberValue(entity.waterStatus),
      nutrientLimitation: stringValue(
        entity.nutrientLimitation,
        "none"
      ) as "none" | "nitrogen" | "phosphorus" | "mixed",
      ...(typeof entity.parentRametId === "string"
        ? { parentRametId: entity.parentRametId }
        : {}),
      offspringRametIds: stringArray(entity.offspringRametIds)
    };
  } else {
    throw new Error(`Unsupported entity detail kind: ${kind}`);
  }

  const genealogy: GenealogyNode[] = array(root.genealogy).map((entry) => {
    const node = record(entry, "genealogy node");
    return {
      entityId: stringValue(node.entityId),
      label: stringValue(node.label),
      lifeStage: stringValue(node.lifeStage),
      relation: stringValue(node.relation) as GenealogyNode["relation"],
      alive: boolValue(node.alive)
    };
  });
  const why: BehaviorReason[] = array(root.why).map((entry) => {
    const reason = record(entry, "why reason");
    return {
      label: stringValue(reason.label),
      score: numberValue(reason.score)
    };
  });

  return {
    entity: summary,
    inspection: { genealogy, why }
  };
}

export type EntityId = number;
export type SpeciesId = string;

export type SpeciesSummary = {
  id: SpeciesId;
  commonName: string;
  scientificName: string;
  category: "plant" | "animal" | "fungus" | "bacterium";
  trophicRole: "producer" | "detritivore" | "fungivore" | "predator" | "decomposer";
};

export type AnimalEntitySummary = {
  kind: "animal";
  id: EntityId;
  speciesId: SpeciesId;
  commonName: string;
  scientificName: string;
  lifeStage: string;
  ageSeconds: number;
  biomassMg: number;
  reserveEnergy: number;
  hydration: number;
  currentAction: string;
  currentTarget?: string;
  birthTimeSeconds: number;
  parentIds: EntityId[];
  offspringCount: number;
  deathCause?: string;
};

export type PlantEntitySummary = {
  kind: "plant";
  id: EntityId;
  speciesId: SpeciesId;
  commonName: string;
  scientificName: string;
  lifeStage: string;
  rametAgeSeconds: number;
  biomassMg: number;
  waterStatus: number;
  nutrientLimitation: "none" | "nitrogen" | "phosphorus" | "mixed";
  parentRametId?: EntityId;
  offspringRametIds: EntityId[];
};

export type EntitySummary = AnimalEntitySummary | PlantEntitySummary;

export type EnvironmentSnapshot = {
  timeSeconds: number;
  temperatureC: number;
  relativeHumidity: number;
  soilWater: number;
  lightPar: number;
  co2Ppm: number;
  o2Percent: number;
  nh4MgKg: number;
  no3MgKg: number;
  availablePMgKg: number;
  fungalBiomassMg: number;
  bacterialBiomassMg: number;
  litterMg: number;
};

export type PopulationSeries = {
  speciesId: SpeciesId;
  label: string;
  points: ReadonlyArray<{ timeSeconds: number; value: number }>;
};

export type GenealogyNode = {
  entityId: EntityId;
  label: string;
  lifeStage: string;
  relation: "parent" | "current" | "offspring";
  alive: boolean;
};

export type BehaviorReason = {
  label: string;
  score: number;
};

export type OverlayKey =
  | "temperature"
  | "humidity"
  | "soilWater"
  | "light"
  | "co2"
  | "o2"
  | "nh4"
  | "no3"
  | "availableP"
  | "fungalBiomass"
  | "bacterialBiomass"
  | "litter";

export type UserActionType =
  | "MIST_WATER"
  | "ADD_LITTER"
  | "INTRODUCE_ORGANISM"
  | "REMOVE_ORGANISM"
  | "CHANGE_LIGHT"
  | "CHANGE_VENTILATION"
  | "PLACE_HARDSCAPE"
  | "PLANT_RAMET";

export type UserAction = {
  id: string;
  source: "USER_ACTION";
  type: UserActionType;
  createdAtUiMs: number;
  status: "queued";
  payload: Readonly<Record<string, string | number | boolean>>;
};

export type FoodWebLink = {
  sourceSpeciesId: SpeciesId;
  targetSpeciesId: SpeciesId;
  biomassTransferMg: number;
};

export type ObservationSnapshot = {
  species: ReadonlyArray<SpeciesSummary>;
  entities: ReadonlyArray<EntitySummary>;
  environment: EnvironmentSnapshot;
  populations: ReadonlyArray<PopulationSeries>;
  genealogy: ReadonlyArray<GenealogyNode>;
  why: ReadonlyArray<BehaviorReason>;
  foodWeb: ReadonlyArray<FoodWebLink>;
};

export type ObservationUiState = {
  paused: boolean;
  speed: 1 | 5 | 20 | 100;
  selectedEntityId: EntityId | null;
  activeOverlay: OverlayKey | null;
  bottomPanel: "graphs" | "foodWeb" | "actions";
  userActions: ReadonlyArray<UserAction>;
};

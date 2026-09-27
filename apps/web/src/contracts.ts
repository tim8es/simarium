export type EntityId = string;
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
  reproductiveState: string;
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
  o2Percent: number | null;
  nh4MgKg: number | null;
  no3MgKg: number | null;
  availablePMgKg: number | null;
  availableNitrogenMg: number;
  availablePhosphorusMg: number;
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
  | "REMOVE_HARDSCAPE"
  | "PLANT_RAMET";

export type UserAction = {
  id: string;
  source: "USER_ACTION";
  type: UserActionType;
  createdAtUiMs: number;
  status: "queued" | "accepted" | "error";
  payload: Readonly<Record<string, string | number | boolean>>;
};

export type FoodWebLink = {
  sourceSpeciesId: SpeciesId;
  targetSpeciesId: SpeciesId;
  biomassTransferMg: number;
};

export type CausalHistoryEvent = {
  timeSeconds: number;
  type: string;
  label: string;
  relatedEntityIds: ReadonlyArray<EntityId>;
};

export type EntityInspection = {
  genealogy: ReadonlyArray<GenealogyNode>;
  why: ReadonlyArray<BehaviorReason>;
  history: ReadonlyArray<CausalHistoryEvent>;
};

export type MaterialValues = {
  carbonMg: number;
  nitrogenMg: number;
  phosphorusMg: number;
  waterG: number;
};

export type MaterialResidual = {
  actual: number;
  expected: number;
  residual: number;
  tolerance: number;
};

export type ScientificResources = {
  availableNitrogenMg: number;
  availablePhosphorusMg: number;
  litterCarbonMg: number;
  fungalCarbonMg: number;
  bacterialCarbonMg: number;
  corpseCarbonMg: number;
};

export type ScientificEventRecord = {
  timeSeconds: number;
  speciesId: SpeciesId;
  type: string;
  entityId: EntityId | null;
  label: string;
};

export type ScientificEvents = {
  predation: number;
  births: Readonly<Record<string, number>>;
  deaths: Readonly<Record<string, number>>;
  recent: ReadonlyArray<ScientificEventRecord>;
};

export type RuntimeProfilerSnapshot = {
  running: boolean;
  speed: number;
  ticksPerSecondAt1x: number;
  pulseIntervalMs: number;
  maxTicksPerPulse: number;
  lastStepTicks: number;
  lastStepWallMs: number;
  emaStepWallMs: number;
  averageWallMsPerTick: number;
  totalTicksStepped: number;
  framesEmitted: number;
  backlogTicks: number;
  maxObservedBacklogTicks: number;
};

export type MaterialLedgerSnapshot = {
  totals: MaterialValues;
  cumulativeBoundaryFlux: MaterialValues;
  residuals: Readonly<Record<keyof MaterialValues, MaterialResidual>>;
};

export type TemperatureGridSnapshot = {
  width: number;
  height: number;
  depth: number;
  values: ReadonlyArray<number>;
};

export type ObservationSnapshot = {
  species: ReadonlyArray<SpeciesSummary>;
  entities: ReadonlyArray<EntitySummary>;
  environment: EnvironmentSnapshot;
  temperatureGrid: TemperatureGridSnapshot | null;
  populations: ReadonlyArray<PopulationSeries>;
  inspectionByEntity: Readonly<Record<EntityId, EntityInspection>>;
  foodWeb: ReadonlyArray<FoodWebLink>;
  resources: ScientificResources;
  events: ScientificEvents;
  materialLedger: MaterialLedgerSnapshot;
  runtimeProfiler: RuntimeProfilerSnapshot;
};

export type ObservationUiState = {
  paused: boolean;
  speed: 1 | 5 | 20 | 100;
  selectedEntityId: EntityId | null;
  activeOverlay: OverlayKey | null;
  bottomPanel: "graphs" | "foodWeb" | "resources" | "events" | "profiler" | "actions";
  userActions: ReadonlyArray<UserAction>;
  cameraMode: "orbit" | "free" | "macro" | "follow";
  seed: number;
  runtimeStatus: "starting" | "running" | "paused" | "error";
  runtimeMessage?: string;
  saveMessage?: string;
  nightObservationAid: boolean;
};

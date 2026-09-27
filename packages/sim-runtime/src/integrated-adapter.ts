import {
  PlantPhysiologySystem,
  VentilationBoundarySystem,
  cloneMaterial,
  scaleMaterial,
  zeroMaterial,
  type Material
} from "../../sim-core/src/index.js";
import {
  createIntegratedEcosystem,
  type IntegratedEcosystem
} from "./integrated-ecosystem.js";
import type { UiToWorkerMessage } from "./protocol.js";
import type { RenderEntityDto, RenderWorldSnapshotDto } from "./render-dto.js";
import {
  createRuntimeSnapshot,
  toJsonValue,
  type JsonValue,
  type RuntimeSnapshotV2
} from "./snapshot.js";
import {
  DeterministicUserActionQueue,
  isUserActionEnvelope,
  type UserActionEnvelope
} from "./user-actions.js";
import type { SimulationRuntimeAdapter } from "./worker-runtime.js";

const WORLD_WIDTH_M = 1.2;
const WORLD_DEPTH_M = 0.6;
const SUBSTRATE_Y_M = 0.145;
const AIR_Y_MIN_M = 0.2;
const AIR_Y_MAX_M = 0.72;
const DAY_SECONDS = 86_400;
const MAX_RENDER_ANIMALS = 1_200;

type SpeciesMeta = {
  commonName: string;
  scientificName: string;
  category: "plant" | "animal" | "fungus" | "bacterium";
  trophicRole: "producer" | "detritivore" | "fungivore" | "predator" | "decomposer";
};

const SPECIES: Record<string, SpeciesMeta> = {
  fittonia_albivenis: {
    commonName: "Nerve plant",
    scientificName: "Fittonia albivenis",
    category: "plant",
    trophicRole: "producer"
  },
  peperomia_caperata: {
    commonName: "Emerald ripple peperomia",
    scientificName: "Peperomia caperata",
    category: "plant",
    trophicRole: "producer"
  },
  pilea_depressa: {
    commonName: "Depressed clearweed",
    scientificName: "Pilea depressa",
    category: "plant",
    trophicRole: "producer"
  },
  folsomia_candida: {
    commonName: "Springtail",
    scientificName: "Folsomia candida",
    category: "animal",
    trophicRole: "fungivore"
  },
  trichorhina_tomentosa: {
    commonName: "Dwarf white isopod",
    scientificName: "Trichorhina tomentosa",
    category: "animal",
    trophicRole: "detritivore"
  },
  bradysia_impatiens: {
    commonName: "Dark-winged fungus gnat",
    scientificName: "Bradysia impatiens",
    category: "animal",
    trophicRole: "fungivore"
  },
  dalotia_coriaria: {
    commonName: "Rove beetle",
    scientificName: "Dalotia coriaria",
    category: "animal",
    trophicRole: "predator"
  },
  linnemannia_elongata: {
    commonName: "Soil fungus",
    scientificName: "Linnemannia elongata",
    category: "fungus",
    trophicRole: "decomposer"
  },
  bacillus_subtilis: {
    commonName: "Soil bacterium",
    scientificName: "Bacillus subtilis",
    category: "bacterium",
    trophicRole: "decomposer"
  }
};

const SPECIES_ALIASES: Record<string, string> = {
  "fittonia-albivenis": "fittonia_albivenis",
  "peperomia-caperata": "peperomia_caperata",
  "pilea-depressa": "pilea_depressa",
  "folsomia-candida": "folsomia_candida",
  "trichorhina-tomentosa": "trichorhina_tomentosa",
  "bradysia-impatiens": "bradysia_impatiens",
  "dalotia-coriaria": "dalotia_coriaria"
};

type PopulationPoint = { timeSeconds: number; value: number };

function normalizeSpeciesId(value: string): string {
  return SPECIES_ALIASES[value] ?? value;
}

function entityRef(speciesId: string, id: number): string {
  return `${speciesId}#${id}`;
}

function parseEntityRef(ref: string): { speciesId: string; id: number } {
  const index = ref.lastIndexOf("#");
  if (index <= 0) throw new Error(`Invalid entity id: ${ref}`);
  const speciesId = normalizeSpeciesId(ref.slice(0, index));
  const id = Number(ref.slice(index + 1));
  if (!Number.isInteger(id) || id <= 0) throw new Error(`Invalid entity id: ${ref}`);
  return { speciesId, id };
}

function negativeMaterial(value: Material): Material {
  return {
    carbonMg: -value.carbonMg,
    nitrogenMg: -value.nitrogenMg,
    phosphorusMg: -value.phosphorusMg,
    waterG: -value.waterG
  };
}

function materialNonZero(value: Material): boolean {
  return value.carbonMg !== 0 || value.nitrogenMg !== 0 ||
    value.phosphorusMg !== 0 || value.waterG !== 0;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function hash01(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function plantPosition(speciesId: string, id: number): { x: number; y: number; z: number } {
  const a = hash01(`${speciesId}:${id}:x`);
  const b = hash01(`${speciesId}:${id}:z`);
  return {
    x: (a - 0.5) * WORLD_WIDTH_M * 0.82,
    y: SUBSTRATE_Y_M,
    z: (b - 0.5) * WORLD_DEPTH_M * 0.78
  };
}

function livingCount(population: { living(): readonly unknown[] }): number {
  return population.living().length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stageScale(stage: string): number {
  if (stage === "egg") return 0.45;
  if (stage === "manca") return 0.55;
  if (stage === "juvenile" || stage === "larva") return 0.72;
  if (stage === "pupa") return 0.82;
  return 1;
}

export class IntegratedEcosystemRuntimeAdapter implements SimulationRuntimeAdapter {
  private ecosystem: IntegratedEcosystem | undefined;
  private actions = new DeterministicUserActionQueue();
  private appliedActions: UserActionEnvelope[] = [];
  private simulationVersion = "0.1.0";
  private speciesDataVersion = "species-v2";
  private presetVersion = "phase7-integrated";
  private initialAtmosphereCarbonMg = 1;
  private initialAtmosphereWaterG = 1;
  private initialSubstrateWaterG = 1;
  private lightMultiplier = 1;
  private ventilationRatePerSecond = 0;
  private readonly hardscape = new Map<string, JsonValue>();
  private readonly history = new Map<string, PopulationPoint[]>();
  private sampledDay = -1;
  private transferUnsubscribe: (() => void) | undefined;
  private readonly foodWebCarbonMg = new Map<string, number>();

  init(message: Extract<UiToWorkerMessage, { type: "INIT" }>): void {
    this.simulationVersion = message.simulationVersion;
    this.speciesDataVersion = message.speciesDataVersion;
    this.presetVersion = message.presetVersion ?? "phase7-integrated";
    this.actions = new DeterministicUserActionQueue();
    this.appliedActions = [];
    this.lightMultiplier = 1;
    this.ventilationRatePerSecond = 0;
    this.hardscape.clear();
    this.resetEcosystem(message.seed);
  }

  loadSnapshot(snapshot: RuntimeSnapshotV2): void {
    if (!isRecord(snapshot.coreState) || snapshot.coreState.kind !== "integrated-replay-v1") {
      throw new Error("Snapshot is not an integrated ecosystem replay snapshot");
    }
    const applied = snapshot.coreState.appliedActions;
    if (!Array.isArray(applied)) {
      throw new Error("Integrated snapshot appliedActions are invalid");
    }
    const appliedEnvelopes: UserActionEnvelope[] = applied.map((value) => {
      if (!isUserActionEnvelope(value)) {
        throw new Error("Integrated snapshot appliedActions are invalid");
      }
      return structuredClone(value);
    });

    this.simulationVersion = snapshot.simulationVersion;
    this.speciesDataVersion = snapshot.speciesDataVersion;
    this.presetVersion = snapshot.presetVersion ?? "phase7-integrated";
    this.actions = new DeterministicUserActionQueue();
    this.appliedActions = [];
    this.lightMultiplier = 1;
    this.ventilationRatePerSecond = 0;
    this.hardscape.clear();
    this.resetEcosystem(snapshot.seed);

    let actionIndex = 0;
    for (let tick = 0; tick < snapshot.tick; tick++) {
      while (
        actionIndex < appliedEnvelopes.length &&
        appliedEnvelopes[actionIndex]!.targetTick <= this.requireEco().world.tick
      ) {
        const envelope = structuredClone(appliedEnvelopes[actionIndex]!);
        this.applyAtBoundary(envelope);
        this.appliedActions.push(envelope);
        actionIndex++;
      }
      this.stepCore(1);
    }
    while (actionIndex < appliedEnvelopes.length && appliedEnvelopes[actionIndex]!.targetTick <= snapshot.tick) {
      const envelope = structuredClone(appliedEnvelopes[actionIndex]!);
      this.applyAtBoundary(envelope);
      this.appliedActions.push(envelope);
      actionIndex++;
    }
    if (actionIndex !== appliedEnvelopes.length) {
      throw new Error("Integrated snapshot contains applied actions beyond its world tick");
    }

    if (snapshot.userActionQueue !== undefined) {
      this.actions.restoreState(snapshot.userActionQueue);
    }

    const eco = this.requireEco();
    if (eco.world.tick !== snapshot.tick || eco.world.timeSeconds !== snapshot.virtualTime) {
      throw new Error("Integrated replay did not reconstruct the saved world clock");
    }
    const rng = eco.world.rng.getState();
    if (rng.some((word, index) => word !== snapshot.rngState[index])) {
      throw new Error("Integrated replay did not reconstruct the saved RNG state");
    }
    eco.invariants.check(eco.world);
  }

  step(ticks: number): void {
    const eco = this.requireEco();
    for (let index = 0; index < ticks; index++) {
      for (const envelope of this.actions.peekForTick(eco.world.tick)) {
        this.applyAtBoundary(envelope);
        this.appliedActions.push(structuredClone(envelope));
        this.actions.removeApplied(envelope.sequence);
      }
      this.stepCore(1);
    }
  }

  applyUserAction(action: UserActionEnvelope): void {
    const eco = this.requireEco();
    if (action.targetTick < eco.world.tick) {
      throw new Error(
        `USER_ACTION targetTick ${action.targetTick} is behind current tick ${eco.world.tick}`
      );
    }
    this.actions.enqueue(action);
  }

  renderSnapshot(): RenderWorldSnapshotDto {
    const eco = this.requireEco();
    const entities: RenderEntityDto[] = [];

    for (const [speciesId, population] of [
      ["fittonia_albivenis", eco.plants.fittonia],
      ["peperomia_caperata", eco.plants.peperomia],
      ["pilea_depressa", eco.plants.pilea]
    ] as const) {
      for (const ramet of population.living()) {
        const baseScale = Math.max(0.55, Math.min(1.8, Math.sqrt(ramet.share * population.living().length)));
        entities.push({
          entityId: entityRef(speciesId, ramet.id),
          speciesId,
          lifeStage: "ramet",
          position: plantPosition(speciesId, ramet.id),
          orientation: { x: 0, y: 0, z: 0, w: 1 },
          displayScale: baseScale,
          action: "grow",
          debugAttributes: {
            ageSeconds: ramet.ageSeconds,
            share: ramet.share
          }
        });
      }
    }

    let animalSlots = MAX_RENDER_ANIMALS;
    animalSlots = this.appendAnimalRenderEntities(
      entities,
      "folsomia_candida",
      eco.animals.folsomia.living(),
      animalSlots
    );
    animalSlots = this.appendAnimalRenderEntities(
      entities,
      "trichorhina_tomentosa",
      eco.animals.trichorhina.living(),
      animalSlots
    );
    animalSlots = this.appendAnimalRenderEntities(
      entities,
      "bradysia_impatiens",
      eco.animals.bradysia.living(),
      animalSlots
    );
    this.appendAnimalRenderEntities(
      entities,
      "dalotia_coriaria",
      eco.animals.dalotia.living(),
      animalSlots
    );

    return {
      tick: eco.world.tick,
      virtualTime: eco.world.timeSeconds,
      entities,
      environment: this.environmentSnapshot()
    };
  }

  entityDetails(entityId: string): JsonValue {
    const { speciesId, id } = parseEntityRef(entityId);
    const eco = this.requireEco();
    if (speciesId === "fittonia_albivenis") return this.plantDetails(speciesId, eco.plants.fittonia, id, "fittonia");
    if (speciesId === "peperomia_caperata") return this.plantDetails(speciesId, eco.plants.peperomia, id, "peperomia");
    if (speciesId === "pilea_depressa") return this.plantDetails(speciesId, eco.plants.pilea, id, "pilea");
    if (speciesId === "folsomia_candida") return this.folsomiaDetails(id);
    if (speciesId === "trichorhina_tomentosa") return this.trichorhinaDetails(id);
    if (speciesId === "bradysia_impatiens") return this.bradysiaDetails(id);
    if (speciesId === "dalotia_coriaria") return this.dalotiaDetails(id);
    throw new Error(`Unknown inspectable species: ${speciesId}`);
  }

  stats(): JsonValue {
    const eco = this.requireEco();
    this.sampleHistoryIfNeeded();
    const nutrient = eco.world.ledger.getPool("available_nutrients");
    const litter = eco.world.ledger.getPool("litter");
    const fungal = eco.world.ledger.getPool("linnemannia_biomass");
    const bacterial = eco.world.ledger.getPool("bacillus_biomass");

    return toJsonValue({
      tick: eco.world.tick,
      virtualTime: eco.world.timeSeconds,
      fixedDtSeconds: eco.world.config.fixedDtSeconds,
      environment: this.environmentSnapshot(),
      species: Object.entries(SPECIES).map(([id, meta]) => ({ id, ...meta })),
      populations: {
        fittonia_albivenis: livingCount(eco.plants.fittonia),
        peperomia_caperata: livingCount(eco.plants.peperomia),
        pilea_depressa: livingCount(eco.plants.pilea),
        folsomia_candida: livingCount(eco.animals.folsomia),
        trichorhina_tomentosa: livingCount(eco.animals.trichorhina),
        bradysia_impatiens: livingCount(eco.animals.bradysia),
        dalotia_coriaria: livingCount(eco.animals.dalotia)
      },
      populationSeries: Object.fromEntries(this.history),
      resources: {
        availableNitrogenMg: nutrient.nitrogenMg,
        availablePhosphorusMg: nutrient.phosphorusMg,
        litterCarbonMg: litter.carbonMg,
        fungalCarbonMg: fungal.carbonMg,
        bacterialCarbonMg: bacterial.carbonMg,
        corpseCarbonMg: eco.world.ledger.getPool("animal_corpses").carbonMg
      },
      materialLedger: {
        totals: eco.world.ledger.totals(),
        cumulativeBoundaryFlux: eco.world.ledger.cumulativeBoundaryFlux(),
        residuals: eco.invariants.report(eco.world)
      },
      events: {
        predation: eco.animals.dalotia.eventLog().filter((event) => event.type === "predation").length,
        births: {
          folsomia: eco.animals.folsomia.all().length,
          trichorhina: eco.animals.trichorhina.all().length,
          bradysia: eco.animals.bradysia.all().length,
          dalotia: eco.animals.dalotia.all().length
        },
        deaths: {
          folsomia: eco.animals.folsomia.all().filter((item) => !item.alive).length,
          trichorhina: eco.animals.trichorhina.all().filter((item) => !item.alive).length,
          bradysia: eco.animals.bradysia.all().filter((item) => !item.alive).length,
          dalotia: eco.animals.dalotia.all().filter((item) => !item.alive).length
        }
      },
      foodWeb: [...this.foodWebCarbonMg.entries()].map(([key, carbonMg]) => {
        const [sourceSpeciesId, targetSpeciesId] = key.split("->");
        return { sourceSpeciesId, targetSpeciesId, biomassTransferMg: carbonMg };
      }),
      controls: {
        lightMultiplier: this.lightMultiplier,
        ventilationRatePerSecond: this.ventilationRatePerSecond
      },
      hardscape: [...this.hardscape.entries()].map(([id, value]) => ({ id, value }))
    });
  }

  saveSnapshot(): RuntimeSnapshotV2 {
    const eco = this.requireEco();
    return createRuntimeSnapshot({
      simulationVersion: this.simulationVersion,
      speciesDataVersion: this.speciesDataVersion,
      presetVersion: this.presetVersion,
      seed: eco.world.config.seed,
      virtualTime: eco.world.timeSeconds,
      tick: eco.world.tick,
      rngState: eco.world.rng.getState(),
      coreState: toJsonValue({
        kind: "integrated-replay-v1",
        appliedActions: this.appliedActions
      }),
      userActionQueue: toJsonValue(this.actions.stateSnapshot()),
      sections: {
        materialPools: toJsonValue(eco.world.ledger.snapshot()),
        organisms: toJsonValue({
          folsomia: eco.animals.folsomia.all(),
          trichorhina: eco.animals.trichorhina.all(),
          bradysia: eco.animals.bradysia.all(),
          dalotia: eco.animals.dalotia.all()
        }),
        genealogy: toJsonValue({
          folsomia: eco.animals.folsomia.all().map((item) => eco.animals.folsomia.record(item.id)),
          trichorhina: eco.animals.trichorhina.all().map((item) => eco.animals.trichorhina.record(item.id)),
          bradysia: eco.animals.bradysia.all().map((item) => eco.animals.bradysia.record(item.id)),
          dalotia: eco.animals.dalotia.all().map((item) => eco.animals.dalotia.record(item.id))
        }),
        plants: toJsonValue({
          fittonia: eco.plants.fittonia.all(),
          peperomia: eco.plants.peperomia.all(),
          pilea: eco.plants.pilea.all()
        }),
        microbeFields: toJsonValue({
          linnemannia: eco.world.ledger.getPool("linnemannia_biomass"),
          bacillus: eco.world.ledger.getPool("bacillus_biomass")
        }),
        spatialState: toJsonValue({
          habitat: eco.habitat.entries(),
          hardscape: [...this.hardscape.entries()]
        }),
        stats: this.stats()
      }
    });
  }

  private resetEcosystem(seed: number): void {
    this.transferUnsubscribe?.();
    this.ecosystem = createIntegratedEcosystem(seed);
    const eco = this.requireEco();
    const atmosphere = eco.world.ledger.getPool("atmosphere");
    const substrate = eco.world.ledger.getPool("substrate");
    this.initialAtmosphereCarbonMg = Math.max(1e-12, atmosphere.carbonMg);
    this.initialAtmosphereWaterG = Math.max(1e-12, atmosphere.waterG);
    this.initialSubstrateWaterG = Math.max(1e-12, substrate.waterG);
    this.history.clear();
    this.foodWebCarbonMg.clear();
    this.sampledDay = -1;
    this.transferUnsubscribe = eco.world.ledger.observeTransfers((event) => {
      this.observeFoodWebTransfer(event.from, event.to, event.amount.carbonMg);
    });
    this.applyLightMultiplier(1);
    this.applyVentilationRate(0);
    this.sampleHistoryIfNeeded();
  }

  private stepCore(count: number): void {
    const eco = this.requireEco();
    eco.scheduler.step(count);
    eco.invariants.check(eco.world);
    this.sampleHistoryIfNeeded();
  }

  private requireEco(): IntegratedEcosystem {
    if (!this.ecosystem) throw new Error("Integrated ecosystem runtime is not initialized");
    return this.ecosystem;
  }

  private sampleHistoryIfNeeded(): void {
    const eco = this.requireEco();
    const day = Math.floor(eco.world.timeSeconds / DAY_SECONDS);
    if (day === this.sampledDay) return;
    this.sampledDay = day;
    const counts: Record<string, number> = {
      fittonia_albivenis: livingCount(eco.plants.fittonia),
      peperomia_caperata: livingCount(eco.plants.peperomia),
      pilea_depressa: livingCount(eco.plants.pilea),
      folsomia_candida: livingCount(eco.animals.folsomia),
      trichorhina_tomentosa: livingCount(eco.animals.trichorhina),
      bradysia_impatiens: livingCount(eco.animals.bradysia),
      dalotia_coriaria: livingCount(eco.animals.dalotia)
    };
    for (const [speciesId, value] of Object.entries(counts)) {
      const series = this.history.get(speciesId) ?? [];
      series.push({ timeSeconds: eco.world.timeSeconds, value });
      if (series.length > 730) series.splice(0, series.length - 730);
      this.history.set(speciesId, series);
    }
  }

  private environmentSnapshot(): Record<string, JsonValue> {
    const eco = this.requireEco();
    const atmosphere = eco.world.ledger.getPool("atmosphere");
    const substrate = eco.world.ledger.getPool("substrate");
    return {
      timeSeconds: eco.world.timeSeconds,
      temperatureC: eco.world.environment.temperatureC.mean(),
      relativeHumidity: clamp01(
        0.9 * atmosphere.waterG / this.initialAtmosphereWaterG
      ),
      soilWater: clamp01(substrate.waterG / this.initialSubstrateWaterG),
      lightPar: 186 * this.lightMultiplier,
      co2Ppm: Math.max(
        0,
        600 * atmosphere.carbonMg / this.initialAtmosphereCarbonMg
      ),
      o2Percent: null,
      nh4MgKg: null,
      no3MgKg: null,
      availablePMgKg: null,
      fungalBiomassMg: eco.world.ledger.getPool("linnemannia_biomass").carbonMg,
      bacterialBiomassMg: eco.world.ledger.getPool("bacillus_biomass").carbonMg,
      litterMg: eco.world.ledger.getPool("litter").carbonMg,
      availableNitrogenMg: eco.world.ledger.getPool("available_nutrients").nitrogenMg,
      availablePhosphorusMg: eco.world.ledger.getPool("available_nutrients").phosphorusMg,
      humidityModel: "atmospheric-water proxy",
      co2Model: "atmospheric-carbon proxy"
    };
  }

  private appendAnimalRenderEntities(
    target: RenderEntityDto[],
    speciesId: string,
    individuals: readonly {
      id: number;
      stage: string;
      ageSeconds: number;
      material: Material;
      reserveCarbonMg: number;
      starvationSeconds: number;
    }[],
    slots: number
  ): number {
    if (slots <= 0) return 0;
    const eco = this.requireEco();
    for (const individual of individuals) {
      if (slots <= 0) break;
      const ref = entityRef(speciesId, individual.id);
      const habitat = eco.habitat.get(ref);
      const fallbackX = Math.floor(hash01(`${ref}:x`) * eco.habitat.width);
      const fallbackZ = Math.floor(hash01(`${ref}:z`) * eco.habitat.depth);
      const cellX = habitat?.x ?? fallbackX;
      const cellZ = habitat?.z ?? fallbackZ;
      const layer = habitat?.layer ?? (speciesId === "bradysia_impatiens" && individual.stage === "adult" ? "air" : "substrate");
      const x = ((cellX + 0.5) / eco.habitat.width - 0.5) * WORLD_WIDTH_M * 0.96;
      const z = ((cellZ + 0.5) / eco.habitat.depth - 0.5) * WORLD_DEPTH_M * 0.94;
      const airT = hash01(`${ref}:height`);
      const y = layer === "air"
        ? AIR_Y_MIN_M + (AIR_Y_MAX_M - AIR_Y_MIN_M) * airT
        : SUBSTRATE_Y_M;
      target.push({
        entityId: ref,
        speciesId,
        lifeStage: individual.stage,
        position: { x, y, z },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
        displayScale: stageScale(individual.stage),
        action: this.actionFor(speciesId, individual.stage, individual.starvationSeconds),
        debugAttributes: {
          ageSeconds: individual.ageSeconds,
          carbonMg: individual.material.carbonMg,
          reserveCarbonMg: individual.reserveCarbonMg
        }
      });
      slots--;
    }
    return slots;
  }

  private actionFor(speciesId: string, stage: string, starvationSeconds: number): string {
    if (stage === "egg" || stage === "pupa" || stage === "manca") return "develop";
    if (speciesId === "dalotia_coriaria" && (stage === "larva" || stage === "adult")) return "hunt";
    if (speciesId === "bradysia_impatiens" && stage === "adult") return "fly";
    if (starvationSeconds > 0) return "forage";
    if (speciesId === "trichorhina_tomentosa") return "detritus-feed";
    return "forage";
  }

  private baseAnimalDetails(
    speciesId: string,
    individual: {
      id: number;
      parentId?: number;
      stage: string;
      sex?: string;
      alive: boolean;
      ageSeconds: number;
      birthTimeSeconds: number;
      material: Material;
      reserveCarbonMg: number;
      starvationSeconds: number;
      dehydrationSeconds: number;
    },
    record: { offspringIds: number[]; deathCause?: string }
  ): Record<string, unknown> {
    const meta = SPECIES[speciesId]!;
    return {
      kind: "animal",
      id: entityRef(speciesId, individual.id),
      numericId: individual.id,
      speciesId,
      commonName: meta.commonName,
      scientificName: meta.scientificName,
      lifeStage: individual.stage,
      alive: individual.alive,
      ageSeconds: individual.ageSeconds,
      biomassMg: individual.material.carbonMg,
      reserveEnergy: clamp01(
        individual.reserveCarbonMg / Math.max(1e-12, individual.material.carbonMg * 0.35)
      ),
      hydration: clamp01(
        individual.material.waterG / Math.max(1e-12, individual.material.waterG + individual.dehydrationSeconds / DAY_SECONDS * 0.001)
      ),
      currentAction: this.actionFor(speciesId, individual.stage, individual.starvationSeconds),
      birthTimeSeconds: individual.birthTimeSeconds,
      parentIds: individual.parentId === undefined ? [] : [entityRef(speciesId, individual.parentId)],
      offspringCount: record.offspringIds.length,
      reproductiveState: individual.stage === "adult"
        ? individual.sex ?? "asexual"
        : "immature",
      deathCause: record.deathCause ?? null
    };
  }

  private genealogy(
    speciesId: string,
    currentId: number,
    record: { parentId?: number; offspringIds: number[] },
    find: (id: number) => { stage: string; alive: boolean } | undefined
  ): JsonValue[] {
    const result: JsonValue[] = [];
    if (record.parentId !== undefined) {
      const parent = find(record.parentId);
      result.push(toJsonValue({
        entityId: entityRef(speciesId, record.parentId),
        label: `#${record.parentId}`,
        lifeStage: parent?.stage ?? "unknown",
        relation: "parent",
        alive: parent?.alive ?? false
      }));
    }
    const current = find(currentId);
    result.push(toJsonValue({
      entityId: entityRef(speciesId, currentId),
      label: `#${currentId}`,
      lifeStage: current?.stage ?? "unknown",
      relation: "current",
      alive: current?.alive ?? false
    }));
    for (const childId of record.offspringIds.slice(-12)) {
      const child = find(childId);
      result.push(toJsonValue({
        entityId: entityRef(speciesId, childId),
        label: `#${childId}`,
        lifeStage: child?.stage ?? "unknown",
        relation: "offspring",
        alive: child?.alive ?? false
      }));
    }
    return result;
  }

  private folsomiaDetails(id: number): JsonValue {
    const population = this.requireEco().animals.folsomia;
    const individual = population.get(id);
    const record = population.record(id);
    return toJsonValue({
      entity: this.baseAnimalDetails("folsomia_candida", individual, record),
      genealogy: this.genealogy("folsomia_candida", id, record, (candidateId) => population.all()[candidateId - 1]),
      why: [
        { label: "RESERVE", score: clamp01(individual.reserveCarbonMg / Math.max(1e-12, individual.material.carbonMg * 0.25)) },
        { label: "STARVATION PRESSURE", score: clamp01(individual.starvationSeconds / (3 * DAY_SECONDS)) },
        { label: "HYDRATION STRESS", score: clamp01(individual.dehydrationSeconds / DAY_SECONDS) }
      ]
    });
  }

  private trichorhinaDetails(id: number): JsonValue {
    const population = this.requireEco().animals.trichorhina;
    const individual = population.all()[id - 1];
    if (!individual || individual.id !== id) throw new Error(`Unknown Trichorhina individual: ${id}`);
    const record = population.record(id);
    return toJsonValue({
      entity: this.baseAnimalDetails("trichorhina_tomentosa", individual, record),
      genealogy: this.genealogy("trichorhina_tomentosa", id, record, (candidateId) => population.all()[candidateId - 1]),
      why: [
        { label: "RESERVE", score: clamp01(individual.reserveCarbonMg / Math.max(1e-12, individual.material.carbonMg * 0.25)) },
        { label: "STARVATION PRESSURE", score: clamp01(individual.starvationSeconds / (4 * DAY_SECONDS)) },
        { label: "HYDRATION STRESS", score: clamp01(individual.dehydrationSeconds / DAY_SECONDS) }
      ]
    });
  }

  private bradysiaDetails(id: number): JsonValue {
    const population = this.requireEco().animals.bradysia;
    const individual = population.get(id);
    const record = population.record(id);
    return toJsonValue({
      entity: this.baseAnimalDetails("bradysia_impatiens", individual, record),
      genealogy: this.genealogy("bradysia_impatiens", id, record, (candidateId) => population.all()[candidateId - 1]),
      why: [
        { label: "RESERVE", score: clamp01(individual.reserveCarbonMg / Math.max(1e-12, individual.material.carbonMg * 0.25)) },
        { label: "STARVATION PRESSURE", score: clamp01(individual.starvationSeconds / (3 * DAY_SECONDS)) },
        { label: "HYDRATION STRESS", score: clamp01(individual.dehydrationSeconds / DAY_SECONDS) }
      ]
    });
  }

  private dalotiaDetails(id: number): JsonValue {
    const population = this.requireEco().animals.dalotia;
    const individual = population.get(id);
    const record = population.record(id);
    return toJsonValue({
      entity: this.baseAnimalDetails("dalotia_coriaria", individual, record),
      genealogy: this.genealogy("dalotia_coriaria", id, record, (candidateId) => population.all()[candidateId - 1]),
      why: [
        { label: "PREY CAPTURES", score: clamp01(record.preyIds.length / 20) },
        { label: "RESERVE", score: clamp01(individual.reserveCarbonMg / Math.max(1e-12, individual.material.carbonMg * 0.45)) },
        { label: "STARVATION PRESSURE", score: clamp01(individual.starvationSeconds / (3 * DAY_SECONDS)) }
      ],
      preyHistory: record.preyIds.slice(-20)
    });
  }

  private plantDetails(
    speciesId: string,
    population: IntegratedEcosystem["plants"]["fittonia"],
    id: number,
    poolPrefix: string
  ): JsonValue {
    const eco = this.requireEco();
    const ramet = population.all().find((item) => item.id === id);
    if (!ramet) throw new Error(`Unknown plant ramet: ${entityRef(speciesId, id)}`);
    const record = population.record(id);
    const structural = eco.world.ledger.getPool(`${poolPrefix}_structural`);
    const reserve = eco.world.ledger.getPool(`${poolPrefix}_reserve`);
    const water = eco.world.ledger.getPool(`${poolPrefix}_water`);
    const nutrient = eco.world.ledger.getPool("available_nutrients");
    const meta = SPECIES[speciesId]!;
    return toJsonValue({
      entity: {
        kind: "plant",
        id: entityRef(speciesId, id),
        numericId: id,
        speciesId,
        commonName: meta.commonName,
        scientificName: meta.scientificName,
        lifeStage: "ramet",
        alive: ramet.alive,
        rametAgeSeconds: ramet.ageSeconds,
        biomassMg: structural.carbonMg * ramet.share,
        reserveMg: reserve.carbonMg * ramet.share,
        waterStatus: clamp01(
          (water.waterG * ramet.share) /
          Math.max(1e-12, structural.carbonMg * ramet.share * 0.02)
        ),
        nutrientLimitation:
          nutrient.nitrogenMg <= 0 && nutrient.phosphorusMg <= 0
            ? "mixed"
            : nutrient.nitrogenMg <= 0
              ? "nitrogen"
              : nutrient.phosphorusMg <= 0
                ? "phosphorus"
                : "none",
        parentRametId: ramet.parentId === undefined ? null : entityRef(speciesId, ramet.parentId),
        offspringRametIds: record.offspringIds.map((childId) => entityRef(speciesId, childId))
      },
      genealogy: this.genealogy(speciesId, id, record, (candidateId) => {
        const candidate = population.all().find((item) => item.id === candidateId);
        return candidate ? { stage: "ramet", alive: candidate.alive } : undefined;
      }),
      why: [
        { label: "WATER STATUS", score: clamp01((water.waterG * ramet.share) / Math.max(1e-12, structural.carbonMg * ramet.share * 0.02)) },
        { label: "LIGHT", score: clamp01(this.lightMultiplier) },
        { label: "N AVAILABILITY", score: clamp01(nutrient.nitrogenMg / 10) }
      ]
    });
  }

  private applyAtBoundary(envelope: UserActionEnvelope): void {
    const eco = this.requireEco();
    const action = envelope.action;
    switch (action.type) {
      case "add_water": {
        const target = action.targetPool ?? "surface_water";
        eco.world.ledger.applyBoundaryFlux(target, {
          ...zeroMaterial(),
          waterG: action.waterG
        });
        return;
      }
      case "add_litter": {
        const target = action.targetPool ?? "litter";
        eco.world.ledger.applyBoundaryFlux(target, cloneMaterial(action.material));
        return;
      }
      case "set_light":
        this.applyLightMultiplier(action.intensity);
        return;
      case "set_ventilation":
        this.applyVentilationRate(action.ratePerSecond);
        return;
      case "add_hardscape":
        this.hardscape.set(action.hardscapeId, toJsonValue(action));
        return;
      case "remove_hardscape":
        this.hardscape.delete(action.hardscapeId);
        return;
      case "introduce_organisms":
        this.introduceOrganisms(
          normalizeSpeciesId(action.speciesId),
          action.count,
          action.lifeStage
        );
        return;
      case "remove_organisms":
        for (const ref of action.entityIds) this.removeOrganism(ref);
        return;
    }
  }

  private applyLightMultiplier(multiplier: number): void {
    this.lightMultiplier = multiplier;
    for (const system of this.requireEco().scheduler.systems) {
      if (system instanceof PlantPhysiologySystem) {
        system.setLightMultiplier(multiplier);
      }
    }
  }

  private applyVentilationRate(ratePerSecond: number): void {
    this.ventilationRatePerSecond = ratePerSecond;
    for (const system of this.requireEco().scheduler.systems) {
      if (system instanceof VentilationBoundarySystem) {
        system.setRatePerSecond(ratePerSecond);
      }
    }
  }

  private introduceOrganisms(
    speciesId: string,
    count: number,
    requestedStage?: string
  ): void {
    const eco = this.requireEco();
    if (speciesId === "fittonia_albivenis") {
      this.introducePlant(speciesId, eco.plants.fittonia, "fittonia", count);
      return;
    }
    if (speciesId === "peperomia_caperata") {
      this.introducePlant(speciesId, eco.plants.peperomia, "peperomia", count);
      return;
    }
    if (speciesId === "pilea_depressa") {
      this.introducePlant(speciesId, eco.plants.pilea, "pilea", count);
      return;
    }

    for (let index = 0; index < count; index++) {
      if (speciesId === "folsomia_candida") {
        const population = eco.animals.folsomia;
        const template = population.living()[0] ?? population.all()[0];
        if (!template) throw new Error("Cannot introduce Folsomia without a material template");
        const material = cloneMaterial(template.material);
        eco.world.ledger.applyBoundaryFlux("folsomia_biomass", material);
        population.create({
          stage: (requestedStage === "egg" || requestedStage === "adult" || requestedStage === "juvenile") ? requestedStage : template.stage,
          ageSeconds: 0,
          stageAgeSeconds: 0,
          birthTimeSeconds: eco.world.timeSeconds,
          material,
          reserveCarbonMg: Math.min(material.carbonMg * 0.25, template.reserveCarbonMg),
          lastReproductionSeconds: eco.world.timeSeconds,
          starvationSeconds: 0,
          dehydrationSeconds: 0
        });
        continue;
      }
      if (speciesId === "trichorhina_tomentosa") {
        const population = eco.animals.trichorhina;
        const template = population.living()[0] ?? population.all()[0];
        if (!template) throw new Error("Cannot introduce Trichorhina without a material template");
        const material = cloneMaterial(template.material);
        eco.world.ledger.applyBoundaryFlux("trichorhina_biomass", material);
        population.create({
          stage: (requestedStage === "manca" || requestedStage === "adult" || requestedStage === "juvenile") ? requestedStage : template.stage,
          ageSeconds: 0,
          stageAgeSeconds: 0,
          birthTimeSeconds: eco.world.timeSeconds,
          material,
          reserveCarbonMg: Math.min(material.carbonMg * 0.25, template.reserveCarbonMg),
          lastBroodSeconds: eco.world.timeSeconds,
          starvationSeconds: 0,
          dehydrationSeconds: 0
        });
        continue;
      }
      if (speciesId === "bradysia_impatiens") {
        const population = eco.animals.bradysia;
        const template = population.living()[0] ?? population.all()[0];
        if (!template) throw new Error("Cannot introduce Bradysia without a material template");
        const material = cloneMaterial(template.material);
        eco.world.ledger.applyBoundaryFlux("bradysia_biomass", material);
        const stage = (requestedStage === "egg" || requestedStage === "larva" || requestedStage === "pupa" || requestedStage === "adult") ? requestedStage : template.stage;
        population.create({
          stage,
          ...(stage === "adult" ? { sex: index % 2 === 0 ? "female" as const : "male" as const } : {}),
          ageSeconds: 0,
          stageAgeSeconds: 0,
          adultAgeSeconds: 0,
          birthTimeSeconds: eco.world.timeSeconds,
          material,
          reserveCarbonMg: Math.min(material.carbonMg * 0.25, template.reserveCarbonMg),
          starvationSeconds: 0,
          dehydrationSeconds: 0,
          hasOviposited: false
        });
        continue;
      }
      if (speciesId === "dalotia_coriaria") {
        const population = eco.animals.dalotia;
        const template = population.living()[0] ?? population.all()[0];
        if (!template) throw new Error("Cannot introduce Dalotia without a material template");
        const material = cloneMaterial(template.material);
        eco.world.ledger.applyBoundaryFlux("dalotia_biomass", material);
        const stage = (requestedStage === "egg" || requestedStage === "larva" || requestedStage === "pupa" || requestedStage === "adult") ? requestedStage : template.stage;
        population.create({
          stage,
          ...(stage === "adult" ? { sex: index % 2 === 0 ? "female" as const : "male" as const } : {}),
          ageSeconds: 0,
          stageAgeSeconds: 0,
          adultAgeSeconds: 0,
          birthTimeSeconds: eco.world.timeSeconds,
          material,
          reserveCarbonMg: Math.min(material.carbonMg * 0.35, template.reserveCarbonMg),
          starvationSeconds: 0,
          dehydrationSeconds: 0,
          eggsLaid: 0,
          eggAccumulator: 0,
          attackAccumulator: 0,
          hasMated: false
        });
        continue;
      }
      throw new Error(`Species ${speciesId} cannot be introduced by this runtime`);
    }
  }

  private introducePlant(
    speciesId: string,
    population: IntegratedEcosystem["plants"]["fittonia"],
    poolPrefix: string,
    count: number
  ): void {
    const eco = this.requireEco();
    for (let index = 0; index < count; index++) {
      const living = population.living();
      const divisor = Math.max(1, living.length);
      const structuralPool = eco.world.ledger.getPool(`${poolPrefix}_structural`);
      const reservePool = eco.world.ledger.getPool(`${poolPrefix}_reserve`);
      const waterPool = eco.world.ledger.getPool(`${poolPrefix}_water`);
      const structuralInput = scaleMaterial(structuralPool, 1 / divisor);
      const reserveInput = scaleMaterial(reservePool, 1 / divisor);
      const waterInput = scaleMaterial(waterPool, 1 / divisor);
      if (!materialNonZero(structuralInput)) {
        throw new Error(`Cannot introduce ${speciesId}: no plant material template`);
      }
      eco.world.ledger.applyBoundaryFlux(`${poolPrefix}_structural`, structuralInput);
      eco.world.ledger.applyBoundaryFlux(`${poolPrefix}_reserve`, reserveInput);
      eco.world.ledger.applyBoundaryFlux(`${poolPrefix}_water`, waterInput);
      const newShare = 1 / (living.length + 1);
      for (const ramet of living) ramet.share *= 1 - newShare;
      population.create({
        birthTimeSeconds: eco.world.timeSeconds,
        ageSeconds: 0,
        share: newShare,
        lastCloneSeconds: eco.world.timeSeconds
      });
      population.normalizeShares();
      population.assertShares();
    }
  }

  private removeOrganism(ref: string): void {
    const eco = this.requireEco();
    const { speciesId, id } = parseEntityRef(ref);
    if (speciesId === "folsomia_candida") {
      const individual = eco.animals.folsomia.get(id);
      if (!individual.alive) return;
      eco.world.ledger.applyBoundaryFlux("folsomia_biomass", negativeMaterial(individual.material));
      individual.material = zeroMaterial();
      individual.reserveCarbonMg = 0;
      eco.animals.folsomia.markDead(individual, "user_removal", eco.world.timeSeconds);
      eco.habitat.remove(ref);
      return;
    }
    if (speciesId === "trichorhina_tomentosa") {
      const individual = eco.animals.trichorhina.all()[id - 1];
      if (!individual || individual.id !== id || !individual.alive) return;
      eco.world.ledger.applyBoundaryFlux("trichorhina_biomass", negativeMaterial(individual.material));
      individual.material = zeroMaterial();
      individual.reserveCarbonMg = 0;
      eco.animals.trichorhina.markDead(individual, "user_removal", eco.world.timeSeconds);
      eco.habitat.remove(ref);
      return;
    }
    if (speciesId === "bradysia_impatiens") {
      const individual = eco.animals.bradysia.get(id);
      if (!individual.alive) return;
      eco.world.ledger.applyBoundaryFlux("bradysia_biomass", negativeMaterial(individual.material));
      individual.material = zeroMaterial();
      individual.reserveCarbonMg = 0;
      eco.animals.bradysia.markDead(individual, "user_removal", eco.world.timeSeconds);
      eco.habitat.remove(ref);
      return;
    }
    if (speciesId === "dalotia_coriaria") {
      const individual = eco.animals.dalotia.get(id);
      if (!individual.alive) return;
      eco.world.ledger.applyBoundaryFlux("dalotia_biomass", negativeMaterial(individual.material));
      individual.material = zeroMaterial();
      individual.reserveCarbonMg = 0;
      eco.animals.dalotia.markDead(individual, "user_removal", eco.world.timeSeconds);
      eco.habitat.remove(ref);
      return;
    }
    if (speciesId === "fittonia_albivenis") {
      this.removePlant(eco.plants.fittonia, id, "fittonia");
      return;
    }
    if (speciesId === "peperomia_caperata") {
      this.removePlant(eco.plants.peperomia, id, "peperomia");
      return;
    }
    if (speciesId === "pilea_depressa") {
      this.removePlant(eco.plants.pilea, id, "pilea");
      return;
    }
    throw new Error(`Species ${speciesId} cannot be removed by this runtime`);
  }

  private removePlant(
    population: IntegratedEcosystem["plants"]["fittonia"],
    id: number,
    poolPrefix: string
  ): void {
    const eco = this.requireEco();
    const ramet = population.all().find((item) => item.id === id);
    if (!ramet || !ramet.alive) return;
    const share = ramet.share;
    for (const poolName of [
      `${poolPrefix}_structural`,
      `${poolPrefix}_reserve`,
      `${poolPrefix}_water`
    ]) {
      const removal = scaleMaterial(eco.world.ledger.getPool(poolName), share);
      if (materialNonZero(removal)) {
        eco.world.ledger.applyBoundaryFlux(poolName, negativeMaterial(removal));
      }
    }
    population.markDead(id, eco.world.timeSeconds);
    population.normalizeShares();
    population.assertShares();
  }

  private observeFoodWebTransfer(from: string, to: string, carbonMg: number): void {
    if (carbonMg <= 0) return;
    let source: string | undefined;
    let target: string | undefined;

    if (to === "linnemannia_biomass") {
      source = "detritus";
      target = "linnemannia_elongata";
    } else if (to === "bacillus_biomass") {
      source = "detritus";
      target = "bacillus_subtilis";
    } else if (to === "folsomia_feed_buffer") {
      source = from === "bacillus_biomass" ? "bacillus_subtilis" : "linnemannia_elongata";
      target = "folsomia_candida";
    } else if (to === "trichorhina_feed_buffer") {
      source = from === "linnemannia_biomass" ? "linnemannia_elongata" : "detritus";
      target = "trichorhina_tomentosa";
    } else if (to === "bradysia_feed_buffer") {
      if (from === "linnemannia_biomass") source = "linnemannia_elongata";
      else if (from === "fittonia_structural") source = "fittonia_albivenis";
      else if (from === "peperomia_structural") source = "peperomia_caperata";
      else if (from === "pilea_structural") source = "pilea_depressa";
      else source = "detritus";
      target = "bradysia_impatiens";
    } else if (to === "dalotia_feed_buffer") {
      if (from === "folsomia_biomass") source = "folsomia_candida";
      if (from === "bradysia_biomass") source = "bradysia_impatiens";
      target = "dalotia_coriaria";
    }

    if (!source || !target) return;
    const key = `${source}->${target}`;
    this.foodWebCarbonMg.set(key, (this.foodWebCarbonMg.get(key) ?? 0) + carbonMg);
  }
}

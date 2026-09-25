import {
  addMaterial,
  cloneMaterial,
  scaleMaterial,
  subtractMaterial,
  type Material,
  zeroMaterial
} from "./material.js";
import type { SimSystem } from "./systems.js";
import type { WorldState } from "./world.js";
import type { LocalEncounterIndex } from "./spatial.js";
import type {
  BradysiaIndividual,
  BradysiaPopulation
} from "./phase5.js";
import type {
  FolsomiaIndividual,
  FolsomiaPopulation
} from "./phase3.js";

export type DalotiaStage = "egg" | "larva" | "pupa" | "adult";
export type DalotiaSex = "female" | "male";
export type DalotiaDeathCause =
  | "starvation"
  | "dehydration"
  | "senescence"
  | "carbon_exhaustion";

export interface DalotiaIndividual {
  id: number;
  parentId?: number;
  stage: DalotiaStage;
  sex?: DalotiaSex;
  alive: boolean;

  ageSeconds: number;
  stageAgeSeconds: number;
  adultAgeSeconds: number;
  birthTimeSeconds: number;

  material: Material;
  reserveCarbonMg: number;
  starvationSeconds: number;
  dehydrationSeconds: number;

  eggsLaid: number;
  eggAccumulator: number;
  attackAccumulator: number;
}

export interface DalotiaRecord {
  id: number;
  parentId?: number;
  sex?: DalotiaSex;
  birthTimeSeconds: number;
  deathTimeSeconds?: number;
  deathCause?: DalotiaDeathCause;
  offspringIds: number[];
  preyIds: string[];
}

export type DalotiaEvent =
  | { type: "birth"; timeSeconds: number; id: number; parentId?: number; stage: DalotiaStage }
  | { type: "stage"; timeSeconds: number; id: number; from: DalotiaStage; to: DalotiaStage }
  | { type: "sex"; timeSeconds: number; id: number; sex: DalotiaSex }
  | { type: "predation"; timeSeconds: number; predatorId: number; preyRef: string; preySpecies: "bradysia_impatiens" | "folsomia_candida" }
  | { type: "oviposition"; timeSeconds: number; parentId: number; offspringIds: number[] }
  | { type: "death"; timeSeconds: number; id: number; cause: DalotiaDeathCause };

export class DalotiaPopulation {
  private nextId = 1;
  private readonly individuals: DalotiaIndividual[] = [];
  private readonly records = new Map<number, DalotiaRecord>();
  private readonly events: DalotiaEvent[] = [];

  create(input: Omit<DalotiaIndividual, "id" | "alive">): number {
    const id = this.nextId++;
    const individual: DalotiaIndividual = {
      ...input,
      id,
      alive: true,
      material: cloneMaterial(input.material)
    };
    this.individuals.push(individual);

    const record: DalotiaRecord = {
      id,
      birthTimeSeconds: input.birthTimeSeconds,
      offspringIds: [],
      preyIds: []
    };
    if (input.parentId !== undefined) record.parentId = input.parentId;
    if (input.sex !== undefined) record.sex = input.sex;
    this.records.set(id, record);

    const event: DalotiaEvent = {
      type: "birth",
      timeSeconds: input.birthTimeSeconds,
      id,
      stage: input.stage
    };
    if (input.parentId !== undefined) event.parentId = input.parentId;
    this.events.push(event);
    return id;
  }

  living(): DalotiaIndividual[] {
    return this.individuals.filter((x) => x.alive);
  }

  all(): readonly DalotiaIndividual[] {
    return this.individuals;
  }

  record(id: number): DalotiaRecord {
    const record = this.records.get(id);
    if (!record) throw new Error(`Unknown Dalotia record: ${id}`);
    return record;
  }

  eventLog(): readonly DalotiaEvent[] {
    return this.events;
  }

  transitionStage(
    individual: DalotiaIndividual,
    next: DalotiaStage,
    timeSeconds: number
  ): void {
    const previous = individual.stage;
    individual.stage = next;
    individual.stageAgeSeconds = 0;
    if (next === "adult") individual.adultAgeSeconds = 0;
    this.events.push({
      type: "stage",
      timeSeconds,
      id: individual.id,
      from: previous,
      to: next
    });
  }

  assignSex(
    individual: DalotiaIndividual,
    sex: DalotiaSex,
    timeSeconds: number
  ): void {
    individual.sex = sex;
    this.record(individual.id).sex = sex;
    this.events.push({ type: "sex", timeSeconds, id: individual.id, sex });
  }

  registerPredation(
    predator: DalotiaIndividual,
    preyRef: string,
    preySpecies: "bradysia_impatiens" | "folsomia_candida",
    timeSeconds: number
  ): void {
    this.record(predator.id).preyIds.push(preyRef);
    this.events.push({
      type: "predation",
      timeSeconds,
      predatorId: predator.id,
      preyRef,
      preySpecies
    });
  }

  registerEggs(
    parent: DalotiaIndividual,
    offspringIds: number[],
    timeSeconds: number
  ): void {
    parent.eggsLaid += offspringIds.length;
    this.record(parent.id).offspringIds.push(...offspringIds);
    this.events.push({
      type: "oviposition",
      timeSeconds,
      parentId: parent.id,
      offspringIds: [...offspringIds]
    });
  }

  markDead(
    individual: DalotiaIndividual,
    cause: DalotiaDeathCause,
    timeSeconds: number
  ): void {
    if (!individual.alive) return;
    individual.alive = false;
    const record = this.record(individual.id);
    record.deathTimeSeconds = timeSeconds;
    record.deathCause = cause;
    this.events.push({
      type: "death",
      timeSeconds,
      id: individual.id,
      cause
    });
  }

  totalLivingMaterial(): Material {
    let total = zeroMaterial();
    for (const individual of this.individuals) {
      if (individual.alive) total = addMaterial(total, individual.material);
    }
    return total;
  }

  assertMatchesAggregate(aggregate: Material, tolerance = 1e-8): void {
    const actual = this.totalLivingMaterial();
    for (const key of ["carbonMg", "nitrogenMg", "phosphorusMg", "waterG"] as const) {
      const residual = actual[key] - aggregate[key];
      if (Math.abs(residual) > tolerance + Math.abs(aggregate[key]) * tolerance) {
        throw new Error(
          `Dalotia aggregate mismatch for ${key}: individuals=${actual[key]} ledger=${aggregate[key]}`
        );
      }
    }
  }
}

export interface DalotiaParameters {
  biomassPool: string;
  feedBufferPool: string;
  litterPool: string;
  atmospherePool: string;
  substratePool: string;
  corpsePool: string;
  bradysiaBiomassPool: string;
  folsomiaBiomassPool: string;

  referenceTemperatureC: number;
  temperatureSigmaC: number;
  eggDevelopmentDays: number;
  larvalDevelopmentDays: number;
  pupalDevelopmentDays: number;
  femaleAdultLifespanDays: number;
  maleAdultLifespanDays: number;
  femaleProbability: number;

  lifetimeFecundity: number;
  reproductivePeriodDays: number;
  preOvipositionDays: number;

  maxAdultPreyPerDay: number;
  maxLarvalPreyPerDay: number;
  preyHalfSaturationCount: number;
  captureProbability: number;
  assimilationEfficiency: number;
  reserveTargetFraction: number;

  basalMetabolismCarbonMgPerSecond: number;
  adultCarbonTargetMg: number;
  pupationCarbonFractionOfAdult: number;
  reproductionReserveFraction: number;
  eggCarbonMg: number;
  adultBodyWaterG: number;

  moistureHalfSaturationWaterG: number;
  reproductionMoistureThreshold: number;
  starvationDeathDays: number;
  desiccationRatePerSecond: number;
  hydrationRatePerSecond: number;
}

export interface DalotiaPreyContext {
  bradysia: BradysiaPopulation;
  folsomia: FolsomiaPopulation;
}

const DAY = 86400;

function temperatureResponse(
  temperatureC: number,
  optimumC: number,
  sigmaC: number
): number {
  const z = (temperatureC - optimumC) / Math.max(1e-9, sigmaC);
  return Math.exp(-0.5 * z * z);
}

function stageMetabolicFactor(stage: DalotiaStage): number {
  if (stage === "egg") return 0.08;
  if (stage === "larva") return 0.75;
  if (stage === "pupa") return 0.25;
  return 1;
}

function stageWaterTarget(stage: DalotiaStage, adultBodyWaterG: number): number {
  if (stage === "egg") return adultBodyWaterG * 0.04;
  if (stage === "larva") return adultBodyWaterG * 0.55;
  if (stage === "pupa") return adultBodyWaterG * 0.4;
  return adultBodyWaterG;
}

export class DalotiaPredatorSystem implements SimSystem {
  readonly name = "dalotia-predator";

  constructor(
    readonly population: DalotiaPopulation,
    readonly prey: DalotiaPreyContext,
    private readonly p: DalotiaParameters,
    private readonly spatial?: LocalEncounterIndex
  ) {
    if (
      p.captureProbability < 0 ||
      p.captureProbability > 1 ||
      p.assimilationEfficiency < 0 ||
      p.assimilationEfficiency > 1 ||
      p.femaleProbability < 0 ||
      p.femaleProbability > 1 ||
      p.reserveTargetFraction <= 0 ||
      p.reserveTargetFraction > 1
    ) {
      throw new Error("Probability/efficiency parameters must be in [0,1]");
    }
  }

  step(world: WorldState, dtSeconds: number): void {
    const temperature = world.environment.temperatureC.mean();
    const development = temperatureResponse(
      temperature,
      this.p.referenceTemperatureC,
      this.p.temperatureSigmaC
    );
    const substrateWater = world.ledger.getPool(this.p.substratePool).waterG;
    const moisture =
      substrateWater /
      Math.max(1e-12, substrateWater + this.p.moistureHalfSaturationWaterG);

    const current = [...this.population.living()];
    for (const individual of current) {
      individual.ageSeconds += dtSeconds;
      individual.stageAgeSeconds += dtSeconds * development;
      if (individual.stage === "adult") individual.adultAgeSeconds += dtSeconds;

      this.advanceStage(world, individual);
      if (!individual.alive) continue;

      if (individual.stage === "adult") {
        const lifespanDays =
          individual.sex === "female"
            ? this.p.femaleAdultLifespanDays
            : this.p.maleAdultLifespanDays;
        if (individual.adultAgeSeconds >= lifespanDays * DAY) {
          this.die(world, individual, "senescence");
          continue;
        }
      }

      this.waterBalance(world, individual, moisture, dtSeconds);
      this.metabolize(world, individual, development, dtSeconds);
      if (!individual.alive) continue;

      if (individual.stage === "larva" || individual.stage === "adult") {
        this.hunt(world, individual, dtSeconds);
      }
      if (individual.stage === "adult") {
        this.reproduce(world, individual, moisture, dtSeconds);
      }

      this.evaluateStress(world, individual, moisture, dtSeconds);
    }

    this.population.assertMatchesAggregate(
      world.ledger.getPool(this.p.biomassPool)
    );
    this.prey.bradysia.assertMatchesAggregate(
      world.ledger.getPool(this.p.bradysiaBiomassPool)
    );
    this.prey.folsomia.assertMatchesAggregate(
      world.ledger.getPool(this.p.folsomiaBiomassPool)
    );
  }

  private advanceStage(world: WorldState, individual: DalotiaIndividual): void {
    if (
      individual.stage === "egg" &&
      individual.stageAgeSeconds >= this.p.eggDevelopmentDays * DAY
    ) {
      this.population.transitionStage(individual, "larva", world.timeSeconds);
      return;
    }
    if (
      individual.stage === "larva" &&
      individual.stageAgeSeconds >= this.p.larvalDevelopmentDays * DAY &&
      individual.material.carbonMg >=
        this.p.adultCarbonTargetMg * this.p.pupationCarbonFractionOfAdult
    ) {
      this.population.transitionStage(individual, "pupa", world.timeSeconds);
      return;
    }
    if (
      individual.stage === "pupa" &&
      individual.stageAgeSeconds >= this.p.pupalDevelopmentDays * DAY
    ) {
      this.population.transitionStage(individual, "adult", world.timeSeconds);
      const sex: DalotiaSex =
        world.rng.nextFloat() < this.p.femaleProbability ? "female" : "male";
      this.population.assignSex(individual, sex, world.timeSeconds);
    }
  }

  private waterBalance(
    world: WorldState,
    individual: DalotiaIndividual,
    moisture: number,
    dtSeconds: number
  ): void {
    const target = stageWaterTarget(individual.stage, this.p.adultBodyWaterG);
    const deficit = Math.max(0, target - individual.material.waterG);
    const uptakeFraction =
      1 - Math.exp(-this.p.hydrationRatePerSecond * moisture * dtSeconds);
    const uptake = Math.min(
      world.ledger.getPool(this.p.substratePool).waterG,
      deficit * uptakeFraction
    );
    if (uptake > 0) {
      const amount = { ...zeroMaterial(), waterG: uptake };
      world.ledger.transfer(this.p.substratePool, this.p.biomassPool, amount);
      individual.material.waterG += uptake;
    }

    const lossFraction =
      1 -
      Math.exp(
        -this.p.desiccationRatePerSecond *
          Math.max(0, 1 - moisture) *
          dtSeconds
      );
    const loss = individual.material.waterG * lossFraction;
    if (loss > 0) {
      const amount = { ...zeroMaterial(), waterG: loss };
      world.ledger.transfer(this.p.biomassPool, this.p.atmospherePool, amount);
      individual.material.waterG -= loss;
    }
  }

  private metabolize(
    world: WorldState,
    individual: DalotiaIndividual,
    temperatureSuitability: number,
    dtSeconds: number
  ): void {
    const cost = Math.min(
      individual.material.carbonMg,
      this.p.basalMetabolismCarbonMgPerSecond *
        stageMetabolicFactor(individual.stage) *
        Math.max(0.2, temperatureSuitability) *
        dtSeconds
    );

    if (cost > 0) {
      world.ledger.transfer(
        this.p.biomassPool,
        this.p.atmospherePool,
        { ...zeroMaterial(), carbonMg: cost }
      );
      individual.material.carbonMg -= cost;
      individual.reserveCarbonMg = Math.max(0, individual.reserveCarbonMg - cost);
    }

    if (individual.material.carbonMg <= 1e-12) {
      this.die(world, individual, "carbon_exhaustion");
    }
  }

  private hunt(
    world: WorldState,
    predator: DalotiaIndividual,
    dtSeconds: number
  ): void {
    const reserveTarget =
      predator.material.carbonMg * this.p.reserveTargetFraction;
    const hunger =
      reserveTarget > 0
        ? Math.max(0, 1 - predator.reserveCarbonMg / reserveTarget)
        : 0;
    const growthNeed =
      predator.stage === "larva"
        ? Math.max(
            0,
            1 -
              predator.material.carbonMg /
                Math.max(1e-12, this.p.adultCarbonTargetMg)
          )
        : 0;
    const feedingDrive = Math.max(hunger, growthNeed);
    if (feedingDrive <= 0) return;

    const candidates = this.collectPrey(predator);
    const available = candidates.length;
    if (available === 0) return;

    const maxPerDay =
      predator.stage === "adult"
        ? this.p.maxAdultPreyPerDay
        : this.p.maxLarvalPreyPerDay;
    const densityFactor =
      available /
      Math.max(1e-12, available + this.p.preyHalfSaturationCount);

    predator.attackAccumulator +=
      maxPerDay *
      (dtSeconds / DAY) *
      densityFactor *
      this.p.captureProbability *
      feedingDrive;

    let attempts = Math.floor(predator.attackAccumulator);
    predator.attackAccumulator -= attempts;

    while (attempts > 0) {
      const liveCandidates = this.collectPrey(predator);
      if (liveCandidates.length === 0) break;
      const target = liveCandidates[world.rng.nextInt(liveCandidates.length)]!;
      this.consumePrey(world, predator, target);
      attempts--;
    }
  }

  private collectPrey(predator: DalotiaIndividual): PreyCandidate[] {
    const predatorRef = `dalotia_coriaria#${predator.id}`;
    const isLocal = (preyRef: string): boolean =>
      this.spatial === undefined || this.spatial.isLocal(predatorRef, preyRef, 1);

    const bradysia: PreyCandidate[] = this.prey.bradysia
      .living()
      .filter((x) => x.stage === "egg" || x.stage === "larva")
      .filter((x) => isLocal(`bradysia_impatiens#${x.id}`))
      .map((individual) => ({
        species: "bradysia_impatiens" as const,
        individual
      }));

    const folsomia: PreyCandidate[] = this.prey.folsomia
      .living()
      .filter((x) => x.stage === "juvenile" || x.stage === "adult")
      .filter((x) => isLocal(`folsomia_candida#${x.id}`))
      .map((individual) => ({
        species: "folsomia_candida" as const,
        individual
      }));

    return [...bradysia, ...folsomia];
  }

  private consumePrey(
    world: WorldState,
    predator: DalotiaIndividual,
    target: PreyCandidate
  ): void {
    const preyMaterial = cloneMaterial(target.individual.material);
    if (preyMaterial.carbonMg <= 0) return;

    const sourcePool =
      target.species === "bradysia_impatiens"
        ? this.p.bradysiaBiomassPool
        : this.p.folsomiaBiomassPool;
    world.ledger.transfer(sourcePool, this.p.feedBufferPool, preyMaterial);

    const assimilated = scaleMaterial(
      preyMaterial,
      this.p.assimilationEfficiency
    );
    const waste = subtractMaterial(preyMaterial, assimilated);

    world.ledger.transfer(this.p.feedBufferPool, this.p.biomassPool, assimilated);
    world.ledger.transfer(this.p.feedBufferPool, this.p.litterPool, waste);

    predator.material = addMaterial(predator.material, assimilated);
    predator.reserveCarbonMg += assimilated.carbonMg * 0.65;

    const preyRef = `${target.species}#${target.individual.id}`;
    if (target.species === "bradysia_impatiens") {
      target.individual.material = zeroMaterial();
      target.individual.reserveCarbonMg = 0;
      this.prey.bradysia.markDead(
        target.individual,
        "predation",
        world.timeSeconds
      );
    } else {
      target.individual.material = zeroMaterial();
      target.individual.reserveCarbonMg = 0;
      this.prey.folsomia.markDead(
        target.individual,
        "predation",
        world.timeSeconds
      );
    }

    this.population.registerPredation(
      predator,
      preyRef,
      target.species,
      world.timeSeconds
    );
  }

  private reproduce(
    world: WorldState,
    female: DalotiaIndividual,
    moisture: number,
    dtSeconds: number
  ): void {
    if (female.sex !== "female") return;
    if (female.adultAgeSeconds < this.p.preOvipositionDays * DAY) return;
    if (female.adultAgeSeconds > this.p.reproductivePeriodDays * DAY) return;
    if (female.eggsLaid >= this.p.lifetimeFecundity) return;
    if (moisture < this.p.reproductionMoistureThreshold) return;

    const reserveFraction =
      female.material.carbonMg > 0
        ? female.reserveCarbonMg / female.material.carbonMg
        : 0;
    if (reserveFraction < this.p.reproductionReserveFraction) return;

    const malePresent = this.population
      .living()
      .some(
        (candidate) =>
          candidate.id !== female.id &&
          candidate.stage === "adult" &&
          candidate.sex === "male"
      );
    if (!malePresent) return;

    const eggsPerDay =
      this.p.lifetimeFecundity /
      Math.max(1e-12, this.p.reproductivePeriodDays);
    female.eggAccumulator += eggsPerDay * (dtSeconds / DAY);

    let count = Math.floor(female.eggAccumulator);
    if (count <= 0) return;
    count = Math.min(count, this.p.lifetimeFecundity - female.eggsLaid);

    const maxAffordable = Math.floor(
      Math.max(0, female.material.carbonMg * 0.45) /
        Math.max(1e-12, this.p.eggCarbonMg)
    );
    count = Math.min(count, maxAffordable);
    if (count <= 0) return;

    female.eggAccumulator -= count;

    const nPerC =
      female.material.nitrogenMg /
      Math.max(1e-12, female.material.carbonMg);
    const pPerC =
      female.material.phosphorusMg /
      Math.max(1e-12, female.material.carbonMg);
    const wPerC =
      female.material.waterG /
      Math.max(1e-12, female.material.carbonMg);

    const eggMaterial: Material = {
      carbonMg: this.p.eggCarbonMg,
      nitrogenMg: this.p.eggCarbonMg * nPerC,
      phosphorusMg: this.p.eggCarbonMg * pPerC,
      waterG: Math.min(
        this.p.adultBodyWaterG * 0.04,
        this.p.eggCarbonMg * wPerC
      )
    };
    const batch = scaleMaterial(eggMaterial, count);
    if (
      female.material.nitrogenMg < batch.nitrogenMg ||
      female.material.phosphorusMg < batch.phosphorusMg ||
      female.material.waterG < batch.waterG
    ) return;

    female.material = subtractMaterial(female.material, batch);
    female.reserveCarbonMg = Math.max(
      0,
      female.reserveCarbonMg - batch.carbonMg
    );

    const offspring: number[] = [];
    for (let i = 0; i < count; i++) {
      offspring.push(
        this.population.create({
          parentId: female.id,
          stage: "egg",
          ageSeconds: 0,
          stageAgeSeconds: 0,
          adultAgeSeconds: 0,
          birthTimeSeconds: world.timeSeconds,
          material: eggMaterial,
          reserveCarbonMg: eggMaterial.carbonMg * 0.75,
          starvationSeconds: 0,
          dehydrationSeconds: 0,
          eggsLaid: 0,
          eggAccumulator: 0,
          attackAccumulator: 0
        })
      );
    }
    this.population.registerEggs(female, offspring, world.timeSeconds);
  }

  private evaluateStress(
    world: WorldState,
    individual: DalotiaIndividual,
    moisture: number,
    dtSeconds: number
  ): void {
    const reserveFraction =
      individual.material.carbonMg > 0
        ? individual.reserveCarbonMg / individual.material.carbonMg
        : 0;
    individual.starvationSeconds =
      reserveFraction < 0.01 ? individual.starvationSeconds + dtSeconds : 0;

    const target = stageWaterTarget(individual.stage, this.p.adultBodyWaterG);
    const hydration = target > 0 ? individual.material.waterG / target : 1;
    individual.dehydrationSeconds =
      hydration < 0.12 && moisture < 0.4
        ? individual.dehydrationSeconds + dtSeconds
        : 0;

    if (individual.starvationSeconds >= this.p.starvationDeathDays * DAY) {
      this.die(world, individual, "starvation");
      return;
    }
    if (individual.dehydrationSeconds >= 2 * DAY) {
      this.die(world, individual, "dehydration");
    }
  }

  private die(
    world: WorldState,
    individual: DalotiaIndividual,
    cause: DalotiaDeathCause
  ): void {
    if (!individual.alive) return;
    world.ledger.transfer(
      this.p.biomassPool,
      this.p.corpsePool,
      cloneMaterial(individual.material)
    );
    individual.material = zeroMaterial();
    individual.reserveCarbonMg = 0;
    this.population.markDead(individual, cause, world.timeSeconds);
  }
}

type PreyCandidate =
  | {
      species: "bradysia_impatiens";
      individual: BradysiaIndividual;
    }
  | {
      species: "folsomia_candida";
      individual: FolsomiaIndividual;
    };

export function seedDalotiaLarvae(input: {
  count: number;
  ageDays: number;
  carbonMg: number;
  reserveCarbonMg: number;
  nitrogenPerCarbon: number;
  phosphorusPerCarbon: number;
  adultBodyWaterG: number;
}): DalotiaPopulation {
  const population = new DalotiaPopulation();
  for (let i = 0; i < input.count; i++) {
    population.create({
      stage: "larva",
      ageSeconds: input.ageDays * DAY,
      stageAgeSeconds: input.ageDays * DAY,
      adultAgeSeconds: 0,
      birthTimeSeconds: -input.ageDays * DAY,
      material: {
        carbonMg: input.carbonMg,
        nitrogenMg: input.carbonMg * input.nitrogenPerCarbon,
        phosphorusMg: input.carbonMg * input.phosphorusPerCarbon,
        waterG: input.adultBodyWaterG * 0.55
      },
      reserveCarbonMg: input.reserveCarbonMg,
      starvationSeconds: 0,
      dehydrationSeconds: 0,
      eggsLaid: 0,
      eggAccumulator: 0,
      attackAccumulator: 0
    });
  }
  return population;
}

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

export type BradysiaStage = "egg" | "larva" | "pupa" | "adult";
export type BradysiaSex = "female" | "male";
export type BradysiaDeathCause =
  | "starvation"
  | "dehydration"
  | "senescence"
  | "carbon_exhaustion"
  | "developmental_mortality"
  | "predation";

export interface BradysiaIndividual {
  id: number;
  parentId?: number;
  stage: BradysiaStage;
  sex?: BradysiaSex;
  alive: boolean;

  ageSeconds: number;
  stageAgeSeconds: number;
  adultAgeSeconds: number;
  birthTimeSeconds: number;

  material: Material;
  reserveCarbonMg: number;

  starvationSeconds: number;
  dehydrationSeconds: number;
  hasOviposited: boolean;
}

export interface BradysiaLifeRecord {
  id: number;
  parentId?: number;
  sex?: BradysiaSex;
  birthTimeSeconds: number;
  deathTimeSeconds?: number;
  deathCause?: BradysiaDeathCause;
  offspringIds: number[];
}

export type BradysiaEvent =
  | { type: "birth"; timeSeconds: number; id: number; parentId?: number; stage: BradysiaStage }
  | { type: "stage"; timeSeconds: number; id: number; from: BradysiaStage; to: BradysiaStage }
  | { type: "sex"; timeSeconds: number; id: number; sex: BradysiaSex }
  | { type: "oviposition"; timeSeconds: number; parentId: number; offspringIds: number[] }
  | { type: "death"; timeSeconds: number; id: number; cause: BradysiaDeathCause };

export class BradysiaPopulation {
  private nextId = 1;
  private readonly individuals: BradysiaIndividual[] = [];
  private readonly livingIndividuals = new Set<BradysiaIndividual>();
  private readonly adultMaleIds = new Set<number>();
  private readonly records = new Map<number, BradysiaLifeRecord>();
  private readonly events: BradysiaEvent[] = [];

  create(input: Omit<BradysiaIndividual, "id" | "alive">): number {
    const id = this.nextId++;
    const individual: BradysiaIndividual = {
      ...input,
      id,
      alive: true,
      material: cloneMaterial(input.material)
    };
    this.individuals.push(individual);
    this.livingIndividuals.add(individual);
    if (individual.stage === "adult" && individual.sex === "male") {
      this.adultMaleIds.add(id);
    }

    const record: BradysiaLifeRecord = {
      id,
      birthTimeSeconds: input.birthTimeSeconds,
      offspringIds: []
    };
    if (input.parentId !== undefined) record.parentId = input.parentId;
    if (input.sex !== undefined) record.sex = input.sex;
    this.records.set(id, record);

    const event: BradysiaEvent = {
      type: "birth",
      timeSeconds: input.birthTimeSeconds,
      id,
      stage: input.stage
    };
    if (input.parentId !== undefined) event.parentId = input.parentId;
    this.events.push(event);
    return id;
  }

  living(): BradysiaIndividual[] {
    return [...this.livingIndividuals];
  }

  all(): readonly BradysiaIndividual[] {
    return this.individuals;
  }

  get(id: number): BradysiaIndividual {
    const individual = this.individuals[id - 1];
    if (!individual || individual.id !== id) {
      throw new Error(`Unknown Bradysia individual: ${id}`);
    }
    return individual;
  }

  record(id: number): BradysiaLifeRecord {
    const record = this.records.get(id);
    if (!record) throw new Error(`Unknown Bradysia record: ${id}`);
    return record;
  }

  eventLog(): readonly BradysiaEvent[] {
    return this.events;
  }

  hasAdultMale(excludeId?: number): boolean {
    if (this.adultMaleIds.size === 0) return false;
    if (excludeId === undefined) return true;
    return this.adultMaleIds.size > 1 || !this.adultMaleIds.has(excludeId);
  }

  transitionStage(
    individual: BradysiaIndividual,
    next: BradysiaStage,
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
    individual: BradysiaIndividual,
    sex: BradysiaSex,
    timeSeconds: number
  ): void {
    individual.sex = sex;
    if (individual.stage === "adult" && sex === "male") {
      this.adultMaleIds.add(individual.id);
    }
    this.record(individual.id).sex = sex;
    this.events.push({ type: "sex", timeSeconds, id: individual.id, sex });
  }

  registerOviposition(
    parent: BradysiaIndividual,
    offspringIds: number[],
    timeSeconds: number
  ): void {
    parent.hasOviposited = true;
    this.record(parent.id).offspringIds.push(...offspringIds);
    this.events.push({
      type: "oviposition",
      timeSeconds,
      parentId: parent.id,
      offspringIds: [...offspringIds]
    });
  }

  markDead(
    individual: BradysiaIndividual,
    cause: BradysiaDeathCause,
    timeSeconds: number
  ): void {
    if (!individual.alive) return;
    individual.alive = false;
    this.livingIndividuals.delete(individual);
    this.adultMaleIds.delete(individual.id);
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
    for (const individual of this.livingIndividuals) {
      total = addMaterial(total, individual.material);
    }
    return total;
  }

  assertMatchesAggregate(aggregate: Material, tolerance = 1e-8): void {
    const actual = this.totalLivingMaterial();
    for (const key of ["carbonMg", "nitrogenMg", "phosphorusMg", "waterG"] as const) {
      const residual = actual[key] - aggregate[key];
      if (Math.abs(residual) > tolerance + Math.abs(aggregate[key]) * tolerance) {
        throw new Error(
          `Bradysia aggregate mismatch for ${key}: individuals=${actual[key]} ledger=${aggregate[key]}`
        );
      }
    }
  }
}

export interface BradysiaParameters {
  biomassPool: string;
  feedBufferPool: string;
  fungusPool: string;
  rootTissuePool?: string;
  rootTissuePools?: string[];
  litterPool: string;
  atmospherePool: string;
  substratePool: string;
  corpsePool: string;

  referenceTemperatureC: number;
  temperatureSigmaC: number;
  eggDevelopmentDays: number;
  larvalDevelopmentDays: number;
  pupalDevelopmentDays: number;
  adultLifespanDays: number;
  preOvipositionHours: number;
  fecundityEggsPerFemale: number;
  femaleProbability: number;
  immatureSurvivalProbability: number;
  reproductionReserveFraction: number;

  larvalFeedingCarbonMgPerSecond: number;
  assimilationEfficiency: number;
  fungusPreference: number;
  basalMetabolismCarbonMgPerSecond: number;
  adultFlightMetabolismMultiplier: number;
  adultCarbonTargetMg: number;
  pupationCarbonFractionOfAdult: number;
  eggCarbonMg: number;

  adultBodyWaterG: number;
  moistureHalfSaturationWaterG: number;
  ovipositionMoistureThreshold: number;
}

const DAY = 86400;
const HOUR = 3600;

function response(value: number, optimum: number, sigma: number): number {
  const z = (value - optimum) / Math.max(1e-9, sigma);
  return Math.exp(-0.5 * z * z);
}

function stageMetabolism(stage: BradysiaStage): number {
  if (stage === "egg") return 0.1;
  if (stage === "larva") return 0.8;
  if (stage === "pupa") return 0.35;
  return 1;
}

function stageWaterTarget(stage: BradysiaStage, adultBodyWaterG: number): number {
  if (stage === "egg") return adultBodyWaterG * 0.04;
  if (stage === "larva") return adultBodyWaterG * 0.65;
  if (stage === "pupa") return adultBodyWaterG * 0.45;
  return adultBodyWaterG;
}

function proportionalByCarbon(source: Material, carbonMg: number): Material {
  if (source.carbonMg <= 0 || carbonMg <= 0) return zeroMaterial();
  return scaleMaterial(source, Math.min(1, carbonMg / source.carbonMg));
}

export class BradysiaLifecycleSystem implements SimSystem {
  readonly name = "bradysia-lifecycle";

  constructor(
    readonly population: BradysiaPopulation,
    private readonly p: BradysiaParameters,
    private readonly spatial?: LocalEncounterIndex,
    private readonly matingRadiusCells = 1
  ) {
    if (!Number.isInteger(p.fecundityEggsPerFemale) || p.fecundityEggsPerFemale < 1) {
      throw new Error("fecundityEggsPerFemale must be a positive integer");
    }
    if (p.femaleProbability < 0 || p.femaleProbability > 1) {
      throw new Error("femaleProbability must be in [0,1]");
    }
    if (p.assimilationEfficiency < 0 || p.assimilationEfficiency > 1) {
      throw new Error("assimilationEfficiency must be in [0,1]");
    }
    if (
      p.immatureSurvivalProbability < 0 ||
      p.immatureSurvivalProbability > 1 ||
      p.reproductionReserveFraction < 0 ||
      p.reproductionReserveFraction > 1
    ) {
      throw new Error("Survival/reserve fractions must be in [0,1]");
    }
  }

  step(world: WorldState, dtSeconds: number): void {
    const temperature = world.environment.temperatureC.mean();
    const development = response(
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

      if (
        individual.stage === "adult" &&
        individual.adultAgeSeconds >= this.p.adultLifespanDays * DAY
      ) {
        this.die(world, individual, "senescence");
        continue;
      }

      this.waterBalance(world, individual, moisture, dtSeconds);
      this.metabolize(world, individual, development, dtSeconds);
      if (!individual.alive) continue;

      if (individual.stage === "larva") {
        this.feedLarva(world, individual, dtSeconds);
      }
      if (individual.stage === "adult") {
        this.tryOviposition(world, individual, moisture);
      }

      this.evaluateStress(world, individual, moisture, dtSeconds);
    }

    this.population.assertMatchesAggregate(
      world.ledger.getPool(this.p.biomassPool)
    );
  }

  private advanceStage(world: WorldState, individual: BradysiaIndividual): void {
    if (
      individual.stage === "egg" &&
      individual.stageAgeSeconds >= this.p.eggDevelopmentDays * DAY
    ) {
      if (!this.survivesImmatureTransition(world)) {
        this.die(world, individual, "developmental_mortality");
        return;
      }
      this.population.transitionStage(individual, "larva", world.timeSeconds);
      return;
    }

    if (
      individual.stage === "larva" &&
      individual.stageAgeSeconds >= this.p.larvalDevelopmentDays * DAY &&
      individual.material.carbonMg >=
        this.p.adultCarbonTargetMg * this.p.pupationCarbonFractionOfAdult
    ) {
      if (!this.survivesImmatureTransition(world)) {
        this.die(world, individual, "developmental_mortality");
        return;
      }
      this.population.transitionStage(individual, "pupa", world.timeSeconds);
      return;
    }

    if (
      individual.stage === "pupa" &&
      individual.stageAgeSeconds >= this.p.pupalDevelopmentDays * DAY
    ) {
      if (!this.survivesImmatureTransition(world)) {
        this.die(world, individual, "developmental_mortality");
        return;
      }
      this.population.transitionStage(individual, "adult", world.timeSeconds);
      const sex: BradysiaSex =
        world.rng.nextFloat() < this.p.femaleProbability ? "female" : "male";
      this.population.assignSex(individual, sex, world.timeSeconds);
    }
  }

  private survivesImmatureTransition(world: WorldState): boolean {
    // The fixture provides aggregate egg-to-adult immature survival. With no
    // stage-specific measurements yet, distribute that survival equally over
    // the three stage transitions. The product remains the measured aggregate
    // probability while mortality occurs before cohorts consume full larval
    // CPU/resources.
    const perTransition = Math.cbrt(this.p.immatureSurvivalProbability);
    return world.rng.nextFloat() < perTransition;
  }

  private waterBalance(
    world: WorldState,
    individual: BradysiaIndividual,
    moisture: number,
    dtSeconds: number
  ): void {
    const target = stageWaterTarget(individual.stage, this.p.adultBodyWaterG);
    const deficit = Math.max(0, target - individual.material.waterG);
    const uptakeRate =
      individual.stage === "adult" ? 0.000004 : 0.000015;
    const uptakeFraction = 1 - Math.exp(-uptakeRate * moisture * dtSeconds);
    const uptake = Math.min(
      world.ledger.getPool(this.p.substratePool).waterG,
      deficit * uptakeFraction
    );

    if (uptake > 0) {
      const amount = { ...zeroMaterial(), waterG: uptake };
      world.ledger.transfer(this.p.substratePool, this.p.biomassPool, amount);
      individual.material.waterG += uptake;
    }

    const dryStress = Math.max(0, 1 - moisture);
    const lossRate = individual.stage === "adult" ? 0.000004 : 0.0000015;
    const lossFraction = 1 - Math.exp(-lossRate * dryStress * dtSeconds);
    const loss = individual.material.waterG * lossFraction;
    if (loss > 0) {
      const amount = { ...zeroMaterial(), waterG: loss };
      world.ledger.transfer(this.p.biomassPool, this.p.atmospherePool, amount);
      individual.material.waterG -= loss;
    }
  }

  private metabolize(
    world: WorldState,
    individual: BradysiaIndividual,
    temperatureSuitability: number,
    dtSeconds: number
  ): void {
    const flightMultiplier =
      individual.stage === "adult" ? this.p.adultFlightMetabolismMultiplier : 1;
    const cost = Math.min(
      individual.material.carbonMg,
      this.p.basalMetabolismCarbonMgPerSecond *
        stageMetabolism(individual.stage) *
        flightMultiplier *
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

  private feedLarva(
    world: WorldState,
    individual: BradysiaIndividual,
    dtSeconds: number
  ): void {
    const growthNeed = Math.max(
      0,
      1 -
        individual.material.carbonMg /
          Math.max(1e-12, this.p.adultCarbonTargetMg)
    );
    const reserveTarget = individual.material.carbonMg * 0.2;
    const hunger =
      reserveTarget > 0
        ? Math.max(0, 1 - individual.reserveCarbonMg / reserveTarget)
        : 0;
    const drive = Math.max(growthNeed, hunger);
    if (drive <= 0) return;

    let desiredC =
      this.p.larvalFeedingCarbonMgPerSecond *
      Math.min(1, drive) *
      dtSeconds;

    const fungusDesired = desiredC * this.p.fungusPreference;
    desiredC -= this.consumeFood(
      world,
      individual,
      this.p.fungusPool,
      fungusDesired
    );

    if (desiredC > 0) {
      const rootPools =
        this.p.rootTissuePools ??
        (this.p.rootTissuePool !== undefined ? [this.p.rootTissuePool] : []);
      for (const rootPool of rootPools) {
        if (desiredC <= 0) break;
        desiredC -= this.consumeFood(
          world,
          individual,
          rootPool,
          desiredC
        );
      }
    }

    if (desiredC > 0) {
      this.consumeFood(
        world,
        individual,
        this.p.fungusPool,
        desiredC
      );
    }
  }

  private hasMate(female: BradysiaIndividual): boolean {
    if (this.spatial === undefined) {
      return this.population.hasAdultMale(female.id);
    }

    const femaleRef = `bradysia_impatiens#${female.id}`;
    for (const ref of this.spatial.nearbyRefs(femaleRef, this.matingRadiusCells)) {
      if (!ref.startsWith("bradysia_impatiens#")) continue;
      const id = Number(ref.slice("bradysia_impatiens#".length));
      if (!Number.isInteger(id) || id <= 0 || id === female.id) continue;
      const candidate = this.population.get(id);
      if (
        candidate.alive &&
        candidate.stage === "adult" &&
        candidate.sex === "male"
      ) {
        return true;
      }
    }
    return false;
  }

  private consumeFood(
    world: WorldState,
    individual: BradysiaIndividual,
    sourcePool: string,
    desiredC: number
  ): number {
    if (desiredC <= 0) return 0;
    const source = world.ledger.getPool(sourcePool);
    const consumed = proportionalByCarbon(source, desiredC);
    if (consumed.carbonMg <= 0) return 0;

    world.ledger.transfer(sourcePool, this.p.feedBufferPool, consumed);
    const assimilated = scaleMaterial(consumed, this.p.assimilationEfficiency);
    const waste = subtractMaterial(consumed, assimilated);
    world.ledger.transfer(this.p.feedBufferPool, this.p.biomassPool, assimilated);
    world.ledger.transfer(this.p.feedBufferPool, this.p.litterPool, waste);

    individual.material = addMaterial(individual.material, assimilated);
    individual.reserveCarbonMg += assimilated.carbonMg * 0.6;
    return consumed.carbonMg;
  }

  private tryOviposition(
    world: WorldState,
    female: BradysiaIndividual,
    moisture: number
  ): void {
    if (female.sex !== "female" || female.hasOviposited) return;
    if (female.adultAgeSeconds < this.p.preOvipositionHours * HOUR) return;
    if (moisture < this.p.ovipositionMoistureThreshold) return;

    const reserveFraction =
      female.material.carbonMg > 0
        ? female.reserveCarbonMg / female.material.carbonMg
        : 0;
    if (reserveFraction < this.p.reproductionReserveFraction) return;

    if (!this.hasMate(female)) return;

    const eggC = this.p.eggCarbonMg;
    const count = this.p.fecundityEggsPerFemale;
    const totalEggC = eggC * count;
    if (female.material.carbonMg <= totalEggC * 1.2) return;

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
      carbonMg: eggC,
      nitrogenMg: eggC * nPerC,
      phosphorusMg: eggC * pPerC,
      waterG: Math.min(
        this.p.adultBodyWaterG * 0.04,
        eggC * wPerC
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
      female.reserveCarbonMg - totalEggC
    );

    const offspringIds: number[] = [];
    for (let i = 0; i < count; i++) {
      offspringIds.push(
        this.population.create({
          parentId: female.id,
          stage: "egg",
          ageSeconds: 0,
          stageAgeSeconds: 0,
          adultAgeSeconds: 0,
          birthTimeSeconds: world.timeSeconds,
          material: eggMaterial,
          reserveCarbonMg: eggMaterial.carbonMg * 0.8,
          starvationSeconds: 0,
          dehydrationSeconds: 0,
          hasOviposited: false
        })
      );
    }
    this.population.registerOviposition(
      female,
      offspringIds,
      world.timeSeconds
    );
  }

  private evaluateStress(
    world: WorldState,
    individual: BradysiaIndividual,
    moisture: number,
    dtSeconds: number
  ): void {
    const reserveFraction =
      individual.material.carbonMg > 0
        ? individual.reserveCarbonMg / individual.material.carbonMg
        : 0;
    individual.starvationSeconds =
      reserveFraction < 0.005 ? individual.starvationSeconds + dtSeconds : 0;

    const target = stageWaterTarget(individual.stage, this.p.adultBodyWaterG);
    const hydration = target > 0 ? individual.material.waterG / target : 1;
    individual.dehydrationSeconds =
      hydration < 0.1 && moisture < 0.4
        ? individual.dehydrationSeconds + dtSeconds
        : 0;

    if (individual.starvationSeconds >= 3 * DAY) {
      this.die(world, individual, "starvation");
      return;
    }
    if (individual.dehydrationSeconds >= DAY) {
      this.die(world, individual, "dehydration");
    }
  }

  private die(
    world: WorldState,
    individual: BradysiaIndividual,
    cause: BradysiaDeathCause
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

export function seedBradysiaLarvae(input: {
  count: number;
  ageDays: number;
  carbonMg: number;
  reserveCarbonMg: number;
  nitrogenPerCarbon: number;
  phosphorusPerCarbon: number;
  adultBodyWaterG: number;
}): BradysiaPopulation {
  const population = new BradysiaPopulation();
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
        waterG: input.adultBodyWaterG * 0.65
      },
      reserveCarbonMg: input.reserveCarbonMg,
      starvationSeconds: 0,
      dehydrationSeconds: 0,
      hasOviposited: false
    });
  }
  return population;
}

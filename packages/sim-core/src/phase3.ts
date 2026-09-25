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

export type FolsomiaStage = "egg" | "juvenile" | "adult";
export type FolsomiaDeathCause =
  | "starvation"
  | "dehydration"
  | "senescence"
  | "carbon_exhaustion"
  | "predation";

export interface FolsomiaIndividual {
  id: number;
  parentId?: number;
  stage: FolsomiaStage;
  alive: boolean;

  ageSeconds: number;
  stageAgeSeconds: number;
  birthTimeSeconds: number;

  material: Material;
  reserveCarbonMg: number;

  lastReproductionSeconds: number;
  starvationSeconds: number;
  dehydrationSeconds: number;
  offspringCount: number;
}

export interface FolsomiaLifeRecord {
  id: number;
  parentId?: number;
  birthTimeSeconds: number;
  deathTimeSeconds?: number;
  deathCause?: FolsomiaDeathCause;
  offspringIds: number[];
}

export type FolsomiaEvent =
  | { type: "birth"; timeSeconds: number; id: number; parentId?: number; stage: FolsomiaStage }
  | { type: "stage"; timeSeconds: number; id: number; from: FolsomiaStage; to: FolsomiaStage }
  | { type: "reproduction"; timeSeconds: number; parentId: number; offspringIds: number[] }
  | { type: "death"; timeSeconds: number; id: number; cause: FolsomiaDeathCause };

export class FolsomiaPopulation {
  private nextId = 1;
  private readonly individuals: FolsomiaIndividual[] = [];
  private readonly livingIndividuals = new Set<FolsomiaIndividual>();
  private readonly records = new Map<number, FolsomiaLifeRecord>();
  private readonly events: FolsomiaEvent[] = [];

  create(input: Omit<FolsomiaIndividual, "id" | "alive" | "offspringCount">): number {
    const id = this.nextId++;
    const individual: FolsomiaIndividual = {
      ...input,
      id,
      alive: true,
      offspringCount: 0,
      material: cloneMaterial(input.material)
    };
    this.individuals.push(individual);
    this.livingIndividuals.add(individual);

    const record: FolsomiaLifeRecord = {
      id,
      birthTimeSeconds: input.birthTimeSeconds,
      offspringIds: []
    };
    if (input.parentId !== undefined) {
      record.parentId = input.parentId;
    }
    this.records.set(id, record);

    const event: FolsomiaEvent = {
      type: "birth",
      timeSeconds: input.birthTimeSeconds,
      id,
      stage: input.stage
    };
    if (input.parentId !== undefined) event.parentId = input.parentId;
    this.events.push(event);

    return id;
  }

  living(): FolsomiaIndividual[] {
    return [...this.livingIndividuals];
  }

  all(): readonly FolsomiaIndividual[] {
    return this.individuals;
  }

  get(id: number): FolsomiaIndividual {
    const individual = this.individuals[id - 1];
    if (!individual || individual.id !== id) {
      throw new Error(`Unknown Folsomia individual: ${id}`);
    }
    return individual;
  }

  record(id: number): FolsomiaLifeRecord {
    const record = this.records.get(id);
    if (!record) throw new Error(`Unknown Folsomia life record: ${id}`);
    return record;
  }

  eventLog(): readonly FolsomiaEvent[] {
    return this.events;
  }

  transitionStage(
    individual: FolsomiaIndividual,
    next: FolsomiaStage,
    timeSeconds: number
  ): void {
    const previous = individual.stage;
    if (previous === next) return;
    individual.stage = next;
    individual.stageAgeSeconds = 0;
    this.events.push({
      type: "stage",
      timeSeconds,
      id: individual.id,
      from: previous,
      to: next
    });
  }

  registerReproduction(
    parent: FolsomiaIndividual,
    offspringIds: number[],
    timeSeconds: number
  ): void {
    parent.offspringCount += offspringIds.length;
    const record = this.record(parent.id);
    record.offspringIds.push(...offspringIds);
    this.events.push({
      type: "reproduction",
      timeSeconds,
      parentId: parent.id,
      offspringIds: [...offspringIds]
    });
  }

  markDead(
    individual: FolsomiaIndividual,
    cause: FolsomiaDeathCause,
    timeSeconds: number
  ): void {
    if (!individual.alive) return;
    individual.alive = false;
    this.livingIndividuals.delete(individual);
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

  assertMatchesAggregate(aggregate: Material, tolerance = 1e-10): void {
    const actual = this.totalLivingMaterial();
    for (const key of ["carbonMg", "nitrogenMg", "phosphorusMg", "waterG"] as const) {
      const residual = actual[key] - aggregate[key];
      if (Math.abs(residual) > tolerance + Math.abs(aggregate[key]) * tolerance) {
        throw new Error(
          `Folsomia aggregate mismatch for ${key}: individuals=${actual[key]} ledger=${aggregate[key]}`
        );
      }
    }
  }
}

export interface FolsomiaParameters {
  biomassPool: string;
  feedBufferPool: string;
  foodPools: string[];
  litterPool: string;
  corpsePool: string;
  atmospherePool: string;
  substratePool: string;

  temperatureOptimumC: number;
  temperatureSigmaC: number;
  eggDevelopmentDays: number;
  adultDevelopmentDays: number;
  reproductionIntervalDays: number;
  clutchSize: number;
  adultLifespanDays: number;

  feedingCarbonRateMgPerSecond: number;
  assimilationEfficiency: number;
  reserveTargetFraction: number;
  reproductionReserveFraction: number;
  basalMetabolismCarbonMgPerSecond: number;
  starvationDeathDays: number;

  moistureHalfSaturationWaterG: number;
  reproductionMoistureThreshold: number;
  desiccationRatePerSecond: number;
  hydrationRatePerSecond: number;

  adultBodyWaterG: number;
  adultCarbonTargetMg: number;
  maturationCarbonFractionOfAdult: number;
  eggCarbonMg: number;
}

const DAY_SECONDS = 86400;

function temperatureFactor(temperatureC: number, optimumC: number, sigmaC: number): number {
  const z = (temperatureC - optimumC) / Math.max(1e-9, sigmaC);
  return Math.exp(-0.5 * z * z);
}

function stageMetabolismFactor(stage: FolsomiaStage): number {
  if (stage === "egg") return 0.15;
  if (stage === "juvenile") return 0.7;
  return 1;
}

function stageFeedingFactor(stage: FolsomiaStage): number {
  if (stage === "egg") return 0;
  if (stage === "juvenile") return 0.7;
  return 1;
}

function stageWaterTarget(stage: FolsomiaStage, adultBodyWaterG: number): number {
  if (stage === "egg") return adultBodyWaterG * 0.08;
  if (stage === "juvenile") return adultBodyWaterG * 0.6;
  return adultBodyWaterG;
}

function proportionalByCarbon(source: Material, carbonMg: number): Material {
  if (source.carbonMg <= 0 || carbonMg <= 0) return zeroMaterial();
  return scaleMaterial(source, Math.min(1, carbonMg / source.carbonMg));
}

export class FolsomiaLifecycleSystem implements SimSystem {
  readonly name = "folsomia-lifecycle";

  constructor(
    readonly population: FolsomiaPopulation,
    private readonly p: FolsomiaParameters
  ) {
    if (p.clutchSize < 1 || !Number.isInteger(p.clutchSize)) {
      throw new Error("clutchSize must be a positive integer");
    }
    if (p.assimilationEfficiency < 0 || p.assimilationEfficiency > 1) {
      throw new Error("assimilationEfficiency must be in [0,1]");
    }
    if (
      p.reproductionMoistureThreshold < 0 ||
      p.reproductionMoistureThreshold > 1
    ) {
      throw new Error("reproductionMoistureThreshold must be in [0,1]");
    }
  }

  step(world: WorldState, dtSeconds: number): void {
    const temp = world.environment.temperatureC.mean();
    const developmentFactor = temperatureFactor(
      temp,
      this.p.temperatureOptimumC,
      this.p.temperatureSigmaC
    );
    const substrateWater = world.ledger.getPool(this.p.substratePool).waterG;
    const moisture =
      substrateWater /
      Math.max(1e-12, substrateWater + this.p.moistureHalfSaturationWaterG);

    const current = [...this.population.living()];
    for (const individual of current) {
      individual.ageSeconds += dtSeconds;
      individual.stageAgeSeconds += dtSeconds * developmentFactor;

      this.advanceStage(world, individual);
      if (!individual.alive) continue;

      if (
        individual.stage === "adult" &&
        individual.ageSeconds >= this.p.adultLifespanDays * DAY_SECONDS
      ) {
        this.die(world, individual, "senescence");
        continue;
      }

      this.updateWater(world, individual, moisture, dtSeconds);
      this.metabolize(world, individual, temp, dtSeconds);
      if (!individual.alive) continue;

      this.feed(world, individual, dtSeconds);
      this.reproduce(world, individual, moisture);
      this.evaluateMortality(world, individual, moisture, dtSeconds);
    }

    this.population.assertMatchesAggregate(
      world.ledger.getPool(this.p.biomassPool),
      1e-8
    );
  }

  private advanceStage(world: WorldState, individual: FolsomiaIndividual): void {
    if (
      individual.stage === "egg" &&
      individual.stageAgeSeconds >= this.p.eggDevelopmentDays * DAY_SECONDS
    ) {
      this.population.transitionStage(individual, "juvenile", world.timeSeconds);
      return;
    }

    if (
      individual.stage === "juvenile" &&
      individual.stageAgeSeconds >= this.p.adultDevelopmentDays * DAY_SECONDS &&
      individual.material.carbonMg >=
        this.p.adultCarbonTargetMg * this.p.maturationCarbonFractionOfAdult
    ) {
      this.population.transitionStage(individual, "adult", world.timeSeconds);
    }
  }

  private updateWater(
    world: WorldState,
    individual: FolsomiaIndividual,
    moisture: number,
    dtSeconds: number
  ): void {
    const target = stageWaterTarget(individual.stage, this.p.adultBodyWaterG);
    const deficit = Math.max(0, target - individual.material.waterG);
    const substrateWater = world.ledger.getPool(this.p.substratePool).waterG;
    const uptakeFraction =
      1 - Math.exp(-this.p.hydrationRatePerSecond * moisture * dtSeconds);
    const uptake = Math.min(substrateWater, deficit * uptakeFraction);

    if (uptake > 0) {
      const material = { ...zeroMaterial(), waterG: uptake };
      world.ledger.transfer(this.p.substratePool, this.p.biomassPool, material);
      individual.material.waterG += uptake;
    }

    const lossFraction =
      1 -
      Math.exp(
        -this.p.desiccationRatePerSecond *
          Math.max(0, 1 - moisture) *
          dtSeconds
      );
    const waterLoss = individual.material.waterG * lossFraction;
    if (waterLoss > 0) {
      const material = { ...zeroMaterial(), waterG: waterLoss };
      world.ledger.transfer(this.p.biomassPool, this.p.atmospherePool, material);
      individual.material.waterG -= waterLoss;
    }
  }

  private metabolize(
    world: WorldState,
    individual: FolsomiaIndividual,
    temperatureC: number,
    dtSeconds: number
  ): void {
    const tempFactor = Math.max(
      0.2,
      temperatureFactor(
        temperatureC,
        this.p.temperatureOptimumC,
        this.p.temperatureSigmaC
      )
    );
    const requested =
      this.p.basalMetabolismCarbonMgPerSecond *
      stageMetabolismFactor(individual.stage) *
      tempFactor *
      dtSeconds;
    const consumed = Math.min(individual.material.carbonMg, requested);

    if (consumed > 0) {
      world.ledger.transfer(
        this.p.biomassPool,
        this.p.atmospherePool,
        { ...zeroMaterial(), carbonMg: consumed }
      );
      individual.material.carbonMg -= consumed;
      individual.reserveCarbonMg = Math.max(
        0,
        individual.reserveCarbonMg - consumed
      );
    }

    if (individual.material.carbonMg <= 1e-12) {
      this.die(world, individual, "carbon_exhaustion");
    }
  }

  private feed(
    world: WorldState,
    individual: FolsomiaIndividual,
    dtSeconds: number
  ): void {
    const stageFactor = stageFeedingFactor(individual.stage);
    if (stageFactor <= 0 || individual.material.carbonMg <= 0) return;

    const reserveTarget =
      individual.material.carbonMg * this.p.reserveTargetFraction;
    const reserveHunger =
      reserveTarget > 0
        ? Math.max(0, 1 - individual.reserveCarbonMg / reserveTarget)
        : 0;
    const growthNeed =
      individual.stage === "juvenile"
        ? Math.max(
            0,
            1 - individual.material.carbonMg / Math.max(1e-12, this.p.adultCarbonTargetMg)
          )
        : 0;
    const feedingDrive = Math.max(reserveHunger, growthNeed);
    if (feedingDrive <= 0) return;

    let desiredC =
      this.p.feedingCarbonRateMgPerSecond *
      stageFactor *
      Math.min(1, feedingDrive) *
      dtSeconds;

    for (const foodPool of this.p.foodPools) {
      if (desiredC <= 0) break;
      const source = world.ledger.getPool(foodPool);
      if (source.carbonMg <= 0) continue;

      const consumed = proportionalByCarbon(source, desiredC);
      if (consumed.carbonMg <= 0) continue;

      world.ledger.transfer(foodPool, this.p.feedBufferPool, consumed);
      const assimilated = scaleMaterial(consumed, this.p.assimilationEfficiency);
      const egested = subtractMaterial(consumed, assimilated);

      world.ledger.transfer(
        this.p.feedBufferPool,
        this.p.biomassPool,
        assimilated
      );
      world.ledger.transfer(this.p.feedBufferPool, this.p.litterPool, egested);

      individual.material = addMaterial(individual.material, assimilated);
      individual.reserveCarbonMg += assimilated.carbonMg * 0.65;
      desiredC -= consumed.carbonMg;
    }
  }

  private reproduce(
    world: WorldState,
    parent: FolsomiaIndividual,
    moisture: number
  ): void {
    if (parent.stage !== "adult") return;
    if (moisture < this.p.reproductionMoistureThreshold) return;

    const interval = this.p.reproductionIntervalDays * DAY_SECONDS;
    if (world.timeSeconds - parent.lastReproductionSeconds < interval) return;

    const reserveFraction =
      parent.material.carbonMg > 0
        ? parent.reserveCarbonMg / parent.material.carbonMg
        : 0;
    if (reserveFraction < this.p.reproductionReserveFraction) return;

    const eggC = this.p.eggCarbonMg;
    const totalEggC = eggC * this.p.clutchSize;
    if (parent.material.carbonMg <= totalEggC * 1.25) return;

    const nPerC =
      parent.material.carbonMg > 0
        ? parent.material.nitrogenMg / parent.material.carbonMg
        : 0;
    const pPerC =
      parent.material.carbonMg > 0
        ? parent.material.phosphorusMg / parent.material.carbonMg
        : 0;
    const waterPerC =
      parent.material.carbonMg > 0
        ? parent.material.waterG / parent.material.carbonMg
        : 0;

    const eggMaterial: Material = {
      carbonMg: eggC,
      nitrogenMg: eggC * nPerC,
      phosphorusMg: eggC * pPerC,
      waterG: Math.min(
        this.p.adultBodyWaterG * 0.08,
        eggC * waterPerC
      )
    };
    const clutchMaterial = scaleMaterial(eggMaterial, this.p.clutchSize);

    if (
      parent.material.nitrogenMg < clutchMaterial.nitrogenMg ||
      parent.material.phosphorusMg < clutchMaterial.phosphorusMg ||
      parent.material.waterG < clutchMaterial.waterG
    ) {
      return;
    }

    parent.material = subtractMaterial(parent.material, clutchMaterial);
    parent.reserveCarbonMg = Math.max(
      0,
      parent.reserveCarbonMg - totalEggC
    );
    parent.lastReproductionSeconds = world.timeSeconds;

    const offspringIds: number[] = [];
    for (let i = 0; i < this.p.clutchSize; i++) {
      const id = this.population.create({
        parentId: parent.id,
        stage: "egg",
        ageSeconds: 0,
        stageAgeSeconds: 0,
        birthTimeSeconds: world.timeSeconds,
        material: eggMaterial,
        reserveCarbonMg: eggMaterial.carbonMg * 0.8,
        lastReproductionSeconds: Number.NEGATIVE_INFINITY,
        starvationSeconds: 0,
        dehydrationSeconds: 0
      });
      offspringIds.push(id);
    }
    this.population.registerReproduction(parent, offspringIds, world.timeSeconds);
  }

  private evaluateMortality(
    world: WorldState,
    individual: FolsomiaIndividual,
    moisture: number,
    dtSeconds: number
  ): void {
    const reserveFraction =
      individual.material.carbonMg > 0
        ? individual.reserveCarbonMg / individual.material.carbonMg
        : 0;

    if (reserveFraction < 0.01) {
      individual.starvationSeconds += dtSeconds;
    } else {
      individual.starvationSeconds = 0;
    }

    const waterTarget = stageWaterTarget(individual.stage, this.p.adultBodyWaterG);
    const hydration =
      waterTarget > 0 ? individual.material.waterG / waterTarget : 1;
    if (hydration < 0.15 && moisture < 0.5) {
      individual.dehydrationSeconds += dtSeconds;
    } else {
      individual.dehydrationSeconds = 0;
    }

    if (
      individual.starvationSeconds >=
      this.p.starvationDeathDays * DAY_SECONDS
    ) {
      this.die(world, individual, "starvation");
      return;
    }

    if (individual.dehydrationSeconds >= DAY_SECONDS) {
      this.die(world, individual, "dehydration");
      return;
    }

  }

  private die(
    world: WorldState,
    individual: FolsomiaIndividual,
    cause: FolsomiaDeathCause
  ): void {
    if (!individual.alive) return;
    const remains = cloneMaterial(individual.material);
    world.ledger.transfer(this.p.biomassPool, this.p.corpsePool, remains);
    individual.material = zeroMaterial();
    individual.reserveCarbonMg = 0;
    this.population.markDead(individual, cause, world.timeSeconds);
  }
}

export function seedFolsomiaJuveniles(input: {
  count: number;
  ageDays: number;
  carbonMg: number;
  reserveCarbonMg: number;
  nitrogenPerCarbon: number;
  phosphorusPerCarbon: number;
  bodyWaterG: number;
}): FolsomiaPopulation {
  const population = new FolsomiaPopulation();
  for (let i = 0; i < input.count; i++) {
    population.create({
      stage: "juvenile",
      ageSeconds: input.ageDays * DAY_SECONDS,
      stageAgeSeconds: input.ageDays * DAY_SECONDS,
      birthTimeSeconds: -input.ageDays * DAY_SECONDS,
      material: {
        carbonMg: input.carbonMg,
        nitrogenMg: input.carbonMg * input.nitrogenPerCarbon,
        phosphorusMg: input.carbonMg * input.phosphorusPerCarbon,
        waterG: input.bodyWaterG * 0.6
      },
      reserveCarbonMg: input.reserveCarbonMg,
      lastReproductionSeconds: Number.NEGATIVE_INFINITY,
      starvationSeconds: 0,
      dehydrationSeconds: 0
    });
  }
  return population;
}

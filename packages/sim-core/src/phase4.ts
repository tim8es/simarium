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

export type TrichorhinaStage = "manca" | "juvenile" | "adult";
export type TrichorhinaDeathCause =
  | "starvation"
  | "dehydration"
  | "senescence"
  | "carbon_exhaustion";

export interface TrichorhinaIndividual {
  id: number;
  parentId?: number;
  stage: TrichorhinaStage;
  alive: boolean;
  ageSeconds: number;
  stageAgeSeconds: number;
  birthTimeSeconds: number;
  material: Material;
  reserveCarbonMg: number;
  lastBroodSeconds: number;
  starvationSeconds: number;
  dehydrationSeconds: number;
  offspringCount: number;
}

export interface TrichorhinaLifeRecord {
  id: number;
  parentId?: number;
  birthTimeSeconds: number;
  deathTimeSeconds?: number;
  deathCause?: TrichorhinaDeathCause;
  offspringIds: number[];
}

export class TrichorhinaPopulation {
  private nextId = 1;
  private readonly individuals: TrichorhinaIndividual[] = [];
  private readonly livingIndividuals = new Set<TrichorhinaIndividual>();
  private readonly records = new Map<number, TrichorhinaLifeRecord>();

  create(
    input: Omit<TrichorhinaIndividual, "id" | "alive" | "offspringCount">
  ): number {
    const id = this.nextId++;
    const individual: TrichorhinaIndividual = {
      ...input,
      id,
      alive: true,
      offspringCount: 0,
      material: cloneMaterial(input.material)
    };
    this.individuals.push(individual);
    this.livingIndividuals.add(individual);

    const record: TrichorhinaLifeRecord = {
      id,
      birthTimeSeconds: input.birthTimeSeconds,
      offspringIds: []
    };
    if (input.parentId !== undefined) record.parentId = input.parentId;
    this.records.set(id, record);
    return id;
  }

  living(): TrichorhinaIndividual[] {
    return [...this.livingIndividuals];
  }

  all(): readonly TrichorhinaIndividual[] {
    return this.individuals;
  }

  record(id: number): TrichorhinaLifeRecord {
    const record = this.records.get(id);
    if (!record) throw new Error(`Unknown Trichorhina record: ${id}`);
    return record;
  }

  transition(individual: TrichorhinaIndividual, next: TrichorhinaStage): void {
    individual.stage = next;
    individual.stageAgeSeconds = 0;
  }

  registerBrood(
    parent: TrichorhinaIndividual,
    offspringIds: number[]
  ): void {
    parent.offspringCount += offspringIds.length;
    this.record(parent.id).offspringIds.push(...offspringIds);
  }

  markDead(
    individual: TrichorhinaIndividual,
    cause: TrichorhinaDeathCause,
    timeSeconds: number
  ): void {
    individual.alive = false;
    this.livingIndividuals.delete(individual);
    const record = this.record(individual.id);
    record.deathTimeSeconds = timeSeconds;
    record.deathCause = cause;
  }

  totalLivingMaterial(): Material {
    let total = zeroMaterial();
    for (const individual of this.livingIndividuals) {
      total = addMaterial(total, individual.material);
    }
    return total;
  }

  assertMatchesAggregate(aggregate: Material, tolerance = 1e-9): void {
    const total = this.totalLivingMaterial();
    for (const key of ["carbonMg", "nitrogenMg", "phosphorusMg", "waterG"] as const) {
      const residual = total[key] - aggregate[key];
      if (Math.abs(residual) > tolerance + Math.abs(aggregate[key]) * tolerance) {
        throw new Error(
          `Trichorhina aggregate mismatch for ${key}: individuals=${total[key]} ledger=${aggregate[key]}`
        );
      }
    }
  }
}

export interface TrichorhinaParameters {
  biomassPool: string;
  feedBufferPool: string;
  coarseLitterPool: string;
  fineDetritusPool: string;
  fungusPool?: string;
  atmospherePool: string;
  substratePool: string;
  corpsePool: string;

  temperatureOptimumC: number;
  temperatureSigmaC: number;
  mancaDevelopmentDays: number;
  adultDevelopmentDays: number;
  broodIntervalDays: number;
  broodSize: number;
  adultLifespanDays: number;

  feedingCarbonRateMgPerSecond: number;
  assimilationEfficiency: number;
  reserveTargetFraction: number;
  reproductionReserveFraction: number;
  basalMetabolismCarbonMgPerSecond: number;

  moistureHalfSaturationWaterG: number;
  reproductionMoistureThreshold: number;
  desiccationRatePerSecond: number;
  hydrationRatePerSecond: number;

  adultCarbonTargetMg: number;
  adultBodyWaterG: number;
  mancaCarbonMg: number;
}

const DAY = 86400;

function tempFactor(temperatureC: number, optimumC: number, sigmaC: number): number {
  const z = (temperatureC - optimumC) / Math.max(1e-9, sigmaC);
  return Math.exp(-0.5 * z * z);
}

function stageFactor(stage: TrichorhinaStage): number {
  if (stage === "manca") return 0.35;
  if (stage === "juvenile") return 0.7;
  return 1;
}

function waterTarget(stage: TrichorhinaStage, adultWaterG: number): number {
  if (stage === "manca") return adultWaterG * 0.15;
  if (stage === "juvenile") return adultWaterG * 0.55;
  return adultWaterG;
}

function proportionalByCarbon(source: Material, carbonMg: number): Material {
  if (source.carbonMg <= 0 || carbonMg <= 0) return zeroMaterial();
  return scaleMaterial(source, Math.min(1, carbonMg / source.carbonMg));
}

export class TrichorhinaDetritivoreSystem implements SimSystem {
  readonly name = "trichorhina-detritivore";

  constructor(
    readonly population: TrichorhinaPopulation,
    private readonly p: TrichorhinaParameters
  ) {
    if (!Number.isInteger(p.broodSize) || p.broodSize < 1) {
      throw new Error("broodSize must be a positive integer");
    }
    if (p.assimilationEfficiency < 0 || p.assimilationEfficiency > 1) {
      throw new Error("assimilationEfficiency must be in [0,1]");
    }
  }

  step(world: WorldState, dtSeconds: number): void {
    const temperature = world.environment.temperatureC.mean();
    const development = tempFactor(
      temperature,
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
      individual.stageAgeSeconds += dtSeconds * development;

      this.advanceStage(individual);
      if (
        individual.stage === "adult" &&
        individual.ageSeconds >= this.p.adultLifespanDays * DAY
      ) {
        this.die(world, individual, "senescence");
        continue;
      }

      this.waterBalance(world, individual, moisture, dtSeconds);
      this.metabolize(world, individual, development, dtSeconds);
      if (!individual.alive) continue;

      this.feed(world, individual, dtSeconds);
      this.reproduce(world, individual, moisture);
      this.evaluateStress(world, individual, moisture, dtSeconds);
    }

    this.population.assertMatchesAggregate(
      world.ledger.getPool(this.p.biomassPool)
    );
  }

  private advanceStage(individual: TrichorhinaIndividual): void {
    if (
      individual.stage === "manca" &&
      individual.stageAgeSeconds >= this.p.mancaDevelopmentDays * DAY
    ) {
      this.population.transition(individual, "juvenile");
      return;
    }
    if (
      individual.stage === "juvenile" &&
      individual.stageAgeSeconds >= this.p.adultDevelopmentDays * DAY
    ) {
      this.population.transition(individual, "adult");
    }
  }

  private waterBalance(
    world: WorldState,
    individual: TrichorhinaIndividual,
    moisture: number,
    dtSeconds: number
  ): void {
    const target = waterTarget(individual.stage, this.p.adultBodyWaterG);
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
    individual: TrichorhinaIndividual,
    temperatureSuitability: number,
    dtSeconds: number
  ): void {
    const cost = Math.min(
      individual.material.carbonMg,
      this.p.basalMetabolismCarbonMgPerSecond *
        stageFactor(individual.stage) *
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

  private feed(
    world: WorldState,
    individual: TrichorhinaIndividual,
    dtSeconds: number
  ): void {
    const reserveTarget =
      individual.material.carbonMg * this.p.reserveTargetFraction;
    const reserveHunger =
      reserveTarget > 0
        ? Math.max(0, 1 - individual.reserveCarbonMg / reserveTarget)
        : 0;
    const growthNeed =
      individual.stage !== "adult"
        ? Math.max(
            0,
            1 -
              individual.material.carbonMg /
                Math.max(1e-12, this.p.adultCarbonTargetMg)
          )
        : 0;
    const drive = Math.max(reserveHunger, growthNeed);
    if (drive <= 0) return;

    let desiredC =
      this.p.feedingCarbonRateMgPerSecond *
      stageFactor(individual.stage) *
      Math.min(1, drive) *
      dtSeconds;

    const foodPools = [this.p.coarseLitterPool];
    if (this.p.fungusPool !== undefined) foodPools.push(this.p.fungusPool);

    for (const foodPool of foodPools) {
      if (desiredC <= 0) break;
      const source = world.ledger.getPool(foodPool);
      const consumed = proportionalByCarbon(source, desiredC);
      if (consumed.carbonMg <= 0) continue;

      world.ledger.transfer(foodPool, this.p.feedBufferPool, consumed);
      const assimilated = scaleMaterial(consumed, this.p.assimilationEfficiency);
      const fragmented = subtractMaterial(consumed, assimilated);

      world.ledger.transfer(
        this.p.feedBufferPool,
        this.p.biomassPool,
        assimilated
      );
      world.ledger.transfer(
        this.p.feedBufferPool,
        this.p.fineDetritusPool,
        fragmented
      );

      individual.material = addMaterial(individual.material, assimilated);
      individual.reserveCarbonMg += assimilated.carbonMg * 0.55;
      desiredC -= consumed.carbonMg;
    }
  }

  private reproduce(
    world: WorldState,
    parent: TrichorhinaIndividual,
    moisture: number
  ): void {
    if (parent.stage !== "adult") return;
    if (moisture < this.p.reproductionMoistureThreshold) return;
    if (
      world.timeSeconds - parent.lastBroodSeconds <
      this.p.broodIntervalDays * DAY
    ) {
      return;
    }

    const reserveFraction =
      parent.material.carbonMg > 0
        ? parent.reserveCarbonMg / parent.material.carbonMg
        : 0;
    if (reserveFraction < this.p.reproductionReserveFraction) return;

    const totalBroodC = this.p.mancaCarbonMg * this.p.broodSize;
    if (parent.material.carbonMg <= totalBroodC * 1.5) return;

    const nPerC =
      parent.material.nitrogenMg /
      Math.max(1e-12, parent.material.carbonMg);
    const pPerC =
      parent.material.phosphorusMg /
      Math.max(1e-12, parent.material.carbonMg);
    const wPerC =
      parent.material.waterG /
      Math.max(1e-12, parent.material.carbonMg);

    const mancaMaterial: Material = {
      carbonMg: this.p.mancaCarbonMg,
      nitrogenMg: this.p.mancaCarbonMg * nPerC,
      phosphorusMg: this.p.mancaCarbonMg * pPerC,
      waterG: Math.min(
        this.p.adultBodyWaterG * 0.15,
        this.p.mancaCarbonMg * wPerC
      )
    };
    const brood = scaleMaterial(mancaMaterial, this.p.broodSize);

    if (
      parent.material.nitrogenMg < brood.nitrogenMg ||
      parent.material.phosphorusMg < brood.phosphorusMg ||
      parent.material.waterG < brood.waterG
    ) return;

    parent.material = subtractMaterial(parent.material, brood);
    parent.reserveCarbonMg = Math.max(
      0,
      parent.reserveCarbonMg - totalBroodC
    );
    parent.lastBroodSeconds = world.timeSeconds;

    const children: number[] = [];
    for (let i = 0; i < this.p.broodSize; i++) {
      children.push(
        this.population.create({
          parentId: parent.id,
          stage: "manca",
          ageSeconds: 0,
          stageAgeSeconds: 0,
          birthTimeSeconds: world.timeSeconds,
          material: mancaMaterial,
          reserveCarbonMg: mancaMaterial.carbonMg * 0.7,
          lastBroodSeconds: Number.NEGATIVE_INFINITY,
          starvationSeconds: 0,
          dehydrationSeconds: 0
        })
      );
    }
    this.population.registerBrood(parent, children);
  }

  private evaluateStress(
    world: WorldState,
    individual: TrichorhinaIndividual,
    moisture: number,
    dtSeconds: number
  ): void {
    const reserveFraction =
      individual.material.carbonMg > 0
        ? individual.reserveCarbonMg / individual.material.carbonMg
        : 0;
    individual.starvationSeconds =
      reserveFraction < 0.01 ? individual.starvationSeconds + dtSeconds : 0;

    const target = waterTarget(individual.stage, this.p.adultBodyWaterG);
    const hydration = target > 0 ? individual.material.waterG / target : 1;
    individual.dehydrationSeconds =
      hydration < 0.15 && moisture < 0.5
        ? individual.dehydrationSeconds + dtSeconds
        : 0;

    if (individual.starvationSeconds >= 14 * DAY) {
      this.die(world, individual, "starvation");
      return;
    }
    if (individual.dehydrationSeconds >= 2 * DAY) {
      this.die(world, individual, "dehydration");
    }
  }

  private die(
    world: WorldState,
    individual: TrichorhinaIndividual,
    cause: TrichorhinaDeathCause
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

export function seedTrichorhinaJuveniles(input: {
  count: number;
  ageDays: number;
  carbonMg: number;
  reserveCarbonMg: number;
  nitrogenPerCarbon: number;
  phosphorusPerCarbon: number;
  adultBodyWaterG: number;
}): TrichorhinaPopulation {
  const population = new TrichorhinaPopulation();
  for (let i = 0; i < input.count; i++) {
    population.create({
      stage: "juvenile",
      ageSeconds: input.ageDays * DAY,
      stageAgeSeconds: input.ageDays * DAY,
      birthTimeSeconds: -input.ageDays * DAY,
      material: {
        carbonMg: input.carbonMg,
        nitrogenMg: input.carbonMg * input.nitrogenPerCarbon,
        phosphorusMg: input.carbonMg * input.phosphorusPerCarbon,
        waterG: input.adultBodyWaterG * 0.55
      },
      reserveCarbonMg: input.reserveCarbonMg,
      lastBroodSeconds: Number.NEGATIVE_INFINITY,
      starvationSeconds: 0,
      dehydrationSeconds: 0
    });
  }
  return population;
}

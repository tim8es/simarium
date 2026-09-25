import type { SimSystem } from "./systems.js";
import {
  scaleMaterial,
  type Material,
  zeroMaterial
} from "./material.js";
import type { WorldState } from "./world.js";

function onlyCarbon(carbonMg: number): Material {
  return { ...zeroMaterial(), carbonMg };
}

function onlyNutrients(nitrogenMg: number, phosphorusMg: number): Material {
  return { ...zeroMaterial(), nitrogenMg, phosphorusMg };
}

function temperatureResponse(
  temperatureC: number,
  optimumC: number,
  sigmaC: number
): number {
  if (sigmaC <= 0) throw new Error("temperatureSigmaC must be positive");
  const z = (temperatureC - optimumC) / sigmaC;
  return Math.exp(-0.5 * z * z);
}

export interface PlantProducerParameters {
  atmospherePool: string;
  reservePool: string;
  structuralPool: string;
  nutrientPool: string;
  litterPool: string;

  relativeLight: number;
  lightHalfSaturation: number;
  temperatureOptimumC: number;
  temperatureSigmaC: number;

  maxPhotosynthesisCarbonMgPerSecond: number;
  structuralGrowthRatePerSecond: number;
  nitrogenMgPerCarbonMg: number;
  phosphorusMgPerCarbonMg: number;
  senescenceRatePerSecond: number;
}

export class PlantProducerSystem implements SimSystem {
  readonly name = "plant-producer";

  constructor(private readonly p: PlantProducerParameters) {}

  step(world: WorldState, dtSeconds: number): void {
    const lightFactor =
      this.p.relativeLight /
      Math.max(1e-12, this.p.relativeLight + this.p.lightHalfSaturation);
    const tempFactor = temperatureResponse(
      world.environment.temperatureC.mean(),
      this.p.temperatureOptimumC,
      this.p.temperatureSigmaC
    );

    const atmosphere = world.ledger.getPool(this.p.atmospherePool);
    const photosynthesisC = Math.min(
      atmosphere.carbonMg,
      this.p.maxPhotosynthesisCarbonMgPerSecond *
        lightFactor *
        tempFactor *
        dtSeconds
    );

    if (photosynthesisC > 0) {
      world.ledger.transfer(
        this.p.atmospherePool,
        this.p.reservePool,
        onlyCarbon(photosynthesisC)
      );
    }

    const reserve = world.ledger.getPool(this.p.reservePool);
    const nutrients = world.ledger.getPool(this.p.nutrientPool);
    const requestedGrowthC =
      reserve.carbonMg *
      (1 - Math.exp(-this.p.structuralGrowthRatePerSecond * dtSeconds));

    const nLimited =
      this.p.nitrogenMgPerCarbonMg > 0
        ? nutrients.nitrogenMg / this.p.nitrogenMgPerCarbonMg
        : Infinity;
    const pLimited =
      this.p.phosphorusMgPerCarbonMg > 0
        ? nutrients.phosphorusMg / this.p.phosphorusMgPerCarbonMg
        : Infinity;

    const growthC = Math.max(0, Math.min(requestedGrowthC, nLimited, pLimited));

    if (growthC > 0) {
      world.ledger.transfer(
        this.p.reservePool,
        this.p.structuralPool,
        onlyCarbon(growthC)
      );
      world.ledger.transfer(
        this.p.nutrientPool,
        this.p.structuralPool,
        onlyNutrients(
          growthC * this.p.nitrogenMgPerCarbonMg,
          growthC * this.p.phosphorusMgPerCarbonMg
        )
      );
    }

    const structural = world.ledger.getPool(this.p.structuralPool);
    const senescenceFraction =
      1 - Math.exp(-this.p.senescenceRatePerSecond * dtSeconds);

    if (senescenceFraction > 0) {
      const senesced = scaleMaterial(structural, senescenceFraction);
      world.ledger.transfer(
        this.p.structuralPool,
        this.p.litterPool,
        senesced
      );
    }
  }
}

export interface MicrobialDecomposerParameters {
  litterPool: string;
  bufferPool: string;
  fungusPool: string;
  bacteriaPool: string;
  atmospherePool: string;
  nutrientPool: string;
  substratePool: string;

  decompositionRatePerSecond: number;
  carbonUseEfficiency: number;
  fungalShare: number;
  microbialTurnoverRatePerSecond: number;
}

export class MicrobialDecomposerSystem implements SimSystem {
  readonly name = "microbial-decomposer";

  constructor(private readonly p: MicrobialDecomposerParameters) {
    if (p.carbonUseEfficiency < 0 || p.carbonUseEfficiency > 1) {
      throw new Error("carbonUseEfficiency must be in [0,1]");
    }
    if (p.fungalShare < 0 || p.fungalShare > 1) {
      throw new Error("fungalShare must be in [0,1]");
    }
  }

  step(world: WorldState, dtSeconds: number): void {
    const litter = world.ledger.getPool(this.p.litterPool);
    const decayFraction =
      1 - Math.exp(-this.p.decompositionRatePerSecond * dtSeconds);
    const decayed = scaleMaterial(litter, decayFraction);

    if (
      decayed.carbonMg > 0 ||
      decayed.nitrogenMg > 0 ||
      decayed.phosphorusMg > 0 ||
      decayed.waterG > 0
    ) {
      world.ledger.transfer(this.p.litterPool, this.p.bufferPool, decayed);

      const retained = this.p.carbonUseEfficiency;
      const fungal = this.p.fungalShare;
      const fungalGrowth: Material = {
        carbonMg: decayed.carbonMg * retained * fungal,
        nitrogenMg: decayed.nitrogenMg * retained * fungal,
        phosphorusMg: decayed.phosphorusMg * retained * fungal,
        waterG: 0
      };
      const bacterialGrowth: Material = {
        carbonMg: decayed.carbonMg * retained * (1 - fungal),
        nitrogenMg: decayed.nitrogenMg * retained * (1 - fungal),
        phosphorusMg: decayed.phosphorusMg * retained * (1 - fungal),
        waterG: 0
      };

      world.ledger.transfer(this.p.bufferPool, this.p.fungusPool, fungalGrowth);
      world.ledger.transfer(this.p.bufferPool, this.p.bacteriaPool, bacterialGrowth);

      let remainder = world.ledger.getPool(this.p.bufferPool);
      if (remainder.carbonMg > 0) {
        world.ledger.transfer(
          this.p.bufferPool,
          this.p.atmospherePool,
          onlyCarbon(remainder.carbonMg)
        );
      }

      remainder = world.ledger.getPool(this.p.bufferPool);
      if (remainder.nitrogenMg > 0 || remainder.phosphorusMg > 0) {
        world.ledger.transfer(
          this.p.bufferPool,
          this.p.nutrientPool,
          onlyNutrients(remainder.nitrogenMg, remainder.phosphorusMg)
        );
      }

      remainder = world.ledger.getPool(this.p.bufferPool);
      if (remainder.waterG > 0) {
        world.ledger.transfer(
          this.p.bufferPool,
          this.p.substratePool,
          { ...zeroMaterial(), waterG: remainder.waterG }
        );
      }
    }

    const turnoverFraction =
      1 - Math.exp(-this.p.microbialTurnoverRatePerSecond * dtSeconds);

    for (const poolName of [this.p.fungusPool, this.p.bacteriaPool]) {
      const biomass = world.ledger.getPool(poolName);
      const turnover = scaleMaterial(biomass, turnoverFraction);
      if (
        turnover.carbonMg > 0 ||
        turnover.nitrogenMg > 0 ||
        turnover.phosphorusMg > 0 ||
        turnover.waterG > 0
      ) {
        world.ledger.transfer(poolName, this.p.litterPool, turnover);
      }
    }
  }
}


export interface PlantPhysiologyParameters extends PlantProducerParameters {
  substratePool: string;
  mobileWaterPool: string;

  targetWaterGPerStructuralCarbonMg: number;
  rootWaterUptakeRatePerSecond: number;
  transpirationRatePerSecond: number;
  waterStressHalfSaturation: number;
  maintenanceRespirationCarbonPerStructuralCarbonPerSecond: number;
}

export class PlantPhysiologySystem implements SimSystem {
  readonly name = "plant-physiology";

  constructor(private readonly p: PlantPhysiologyParameters) {
    const nonNegative = [
      p.targetWaterGPerStructuralCarbonMg,
      p.rootWaterUptakeRatePerSecond,
      p.transpirationRatePerSecond,
      p.waterStressHalfSaturation,
      p.maintenanceRespirationCarbonPerStructuralCarbonPerSecond
    ];
    if (nonNegative.some((value) => !Number.isFinite(value) || value < 0)) {
      throw new Error("Plant physiology rates must be finite and non-negative");
    }
  }

  step(world: WorldState, dtSeconds: number): void {
    const structuralBefore = world.ledger.getPool(this.p.structuralPool);
    const mobileWaterBefore = world.ledger.getPool(this.p.mobileWaterPool);
    const targetWater =
      structuralBefore.carbonMg * this.p.targetWaterGPerStructuralCarbonMg;
    const waterDeficit = Math.max(0, targetWater - mobileWaterBefore.waterG);
    const substrateWater = world.ledger.getPool(this.p.substratePool).waterG;
    const uptakeFraction =
      1 - Math.exp(-this.p.rootWaterUptakeRatePerSecond * dtSeconds);
    const uptake = Math.min(substrateWater, waterDeficit * uptakeFraction);

    if (uptake > 0) {
      world.ledger.transfer(
        this.p.substratePool,
        this.p.mobileWaterPool,
        { ...zeroMaterial(), waterG: uptake }
      );
    }

    const lightFactor =
      this.p.relativeLight /
      Math.max(1e-12, this.p.relativeLight + this.p.lightHalfSaturation);

    const mobileWater = world.ledger.getPool(this.p.mobileWaterPool);
    const transpirationFraction =
      1 - Math.exp(
        -this.p.transpirationRatePerSecond * Math.max(0.05, lightFactor) * dtSeconds
      );
    const transpired = mobileWater.waterG * transpirationFraction;

    if (transpired > 0) {
      world.ledger.transfer(
        this.p.mobileWaterPool,
        this.p.atmospherePool,
        { ...zeroMaterial(), waterG: transpired }
      );
    }

    const structural = world.ledger.getPool(this.p.structuralPool);
    const currentWater = world.ledger.getPool(this.p.mobileWaterPool).waterG;
    const currentTarget =
      structural.carbonMg * this.p.targetWaterGPerStructuralCarbonMg;
    const relativeWater =
      currentTarget > 0 ? Math.max(0, currentWater / currentTarget) : 1;
    const waterFactor =
      this.p.waterStressHalfSaturation > 0
        ? relativeWater /
          (relativeWater + this.p.waterStressHalfSaturation)
        : 1;

    const tempFactor = temperatureResponse(
      world.environment.temperatureC.mean(),
      this.p.temperatureOptimumC,
      this.p.temperatureSigmaC
    );

    const atmosphere = world.ledger.getPool(this.p.atmospherePool);
    const photosynthesisC = Math.min(
      atmosphere.carbonMg,
      this.p.maxPhotosynthesisCarbonMgPerSecond *
        lightFactor *
        tempFactor *
        waterFactor *
        dtSeconds
    );

    if (photosynthesisC > 0) {
      world.ledger.transfer(
        this.p.atmospherePool,
        this.p.reservePool,
        onlyCarbon(photosynthesisC)
      );
    }

    const reserveBeforeRespiration = world.ledger.getPool(this.p.reservePool);
    const respirationC = Math.min(
      reserveBeforeRespiration.carbonMg,
      structural.carbonMg *
        this.p.maintenanceRespirationCarbonPerStructuralCarbonPerSecond *
        Math.max(0.1, tempFactor) *
        dtSeconds
    );

    if (respirationC > 0) {
      world.ledger.transfer(
        this.p.reservePool,
        this.p.atmospherePool,
        onlyCarbon(respirationC)
      );
    }

    const reserve = world.ledger.getPool(this.p.reservePool);
    const nutrients = world.ledger.getPool(this.p.nutrientPool);
    const requestedGrowthC =
      reserve.carbonMg *
      (1 - Math.exp(-this.p.structuralGrowthRatePerSecond * waterFactor * dtSeconds));

    const nLimited =
      this.p.nitrogenMgPerCarbonMg > 0
        ? nutrients.nitrogenMg / this.p.nitrogenMgPerCarbonMg
        : Infinity;
    const pLimited =
      this.p.phosphorusMgPerCarbonMg > 0
        ? nutrients.phosphorusMg / this.p.phosphorusMgPerCarbonMg
        : Infinity;
    const growthC = Math.max(0, Math.min(requestedGrowthC, nLimited, pLimited));

    if (growthC > 0) {
      world.ledger.transfer(
        this.p.reservePool,
        this.p.structuralPool,
        onlyCarbon(growthC)
      );
      world.ledger.transfer(
        this.p.nutrientPool,
        this.p.structuralPool,
        onlyNutrients(
          growthC * this.p.nitrogenMgPerCarbonMg,
          growthC * this.p.phosphorusMgPerCarbonMg
        )
      );
    }

    const structuralAfterGrowth = world.ledger.getPool(this.p.structuralPool);
    const stressMultiplier = 1 + Math.max(0, 1 - waterFactor) * 2;
    const senescenceFraction =
      1 -
      Math.exp(
        -this.p.senescenceRatePerSecond * stressMultiplier * dtSeconds
      );

    if (senescenceFraction > 0) {
      const senesced = scaleMaterial(structuralAfterGrowth, senescenceFraction);
      senesced.waterG = 0;
      world.ledger.transfer(this.p.structuralPool, this.p.litterPool, senesced);
    }
  }
}

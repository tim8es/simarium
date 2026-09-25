import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BradysiaLifecycleSystem,
  BradysiaPopulation,
  DalotiaPopulation,
  DalotiaPredatorSystem,
  DeterministicRng,
  FixedStepScheduler,
  FolsomiaLifecycleSystem,
  InvariantMonitor,
  MassLedger,
  MicrobialDecomposerSystem,
  PlantClonalLineageSystem,
  PlantPhysiologySystem,
  PlantRametPopulation,
  ScalarGrid3D,
  SpatialEcologySystem,
  SpatialHabitat,
  TemperatureBoundarySystem,
  TemperatureDiffusionSystem,
  TrichorhinaDetritivoreSystem,
  WaterCycleSystem,
  WorldState,
  seedBradysiaLarvae,
  seedFolsomiaJuveniles,
  seedTrichorhinaJuveniles,
  type BradysiaParameters,
  type DalotiaParameters,
  type FolsomiaParameters,
  type Material,
  type PlantClonalParameters,
  type TrichorhinaParameters
} from "../packages/sim-core/src/index.js";

function readJson(path: string): any {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8"));
}

const plantFixture = readJson("data/experiments/phase2-multiplant.json");
const folsomiaFixture = readJson("data/experiments/phase3-folsomia.json");
const trichorhinaFixture = readJson("data/experiments/phase4-trichorhina.json");
const bradysiaFixture = readJson("data/experiments/phase5-bradysia.json");
const dalotiaFixture = readJson("data/experiments/phase6-dalotia.json");
const integratedFixture = readJson("data/experiments/phase7-integrated.json");

function value(entry: any): number {
  return Number(entry.value);
}

function createPlantPopulation(agesDays: number[]): PlantRametPopulation {
  const population = new PlantRametPopulation();
  const share = 1 / agesDays.length;
  for (const ageDays of agesDays) {
    population.create({
      birthTimeSeconds: -ageDays * 86400,
      ageSeconds: ageDays * 86400,
      share
    });
  }
  population.assertShares();
  return population;
}

function adultBradysiaMaterial(): Material {
  const p = bradysiaFixture.parameters;
  return {
    carbonMg: value(p.adultCarbonTargetMg),
    nitrogenMg: value(p.adultCarbonTargetMg) * value(p.nitrogenPerCarbon),
    phosphorusMg:
      value(p.adultCarbonTargetMg) * value(p.phosphorusPerCarbon),
    waterG: value(p.adultBodyWaterG)
  };
}

function addBradysiaAdultPair(population: BradysiaPopulation): void {
  const material = adultBradysiaMaterial();
  for (const sex of ["female", "male"] as const) {
    population.create({
      stage: "adult",
      sex,
      ageSeconds: 22 * 86400,
      stageAgeSeconds: 0,
      adultAgeSeconds: 0,
      birthTimeSeconds: -22 * 86400,
      material,
      reserveCarbonMg: material.carbonMg * 0.35,
      starvationSeconds: 0,
      dehydrationSeconds: 0,
      hasOviposited: false
    });
  }
}

function adultDalotiaMaterial(): Material {
  const p = dalotiaFixture.parameters;
  return {
    carbonMg: value(p.adultCarbonTargetMg),
    nitrogenMg: value(p.adultCarbonTargetMg) * value(p.nitrogenPerCarbon),
    phosphorusMg:
      value(p.adultCarbonTargetMg) * value(p.phosphorusPerCarbon),
    waterG: value(p.adultBodyWaterG)
  };
}

function createDalotiaAdultPair(): DalotiaPopulation {
  const population = new DalotiaPopulation();
  const material = adultDalotiaMaterial();
  for (const sex of ["female", "male"] as const) {
    population.create({
      stage: "adult",
      sex,
      ageSeconds: 17 * 86400,
      stageAgeSeconds: 0,
      adultAgeSeconds: 0,
      birthTimeSeconds: -17 * 86400,
      material,
      reserveCarbonMg: material.carbonMg * 0.3,
      starvationSeconds: 0,
      dehydrationSeconds: 0,
      eggsLaid: 0,
      eggAccumulator: 0,
      attackAccumulator: 0
    });
  }
  return population;
}

function plantPhysiology(
  speciesId: "fittonia_albivenis" | "peperomia_caperata" | "pilea_depressa",
  prefix: "fittonia" | "peperomia" | "pilea"
): PlantPhysiologySystem {
  const p = plantFixture.plants[speciesId];
  return new PlantPhysiologySystem({
    atmospherePool: "atmosphere",
    reservePool: `${prefix}_reserve`,
    structuralPool: `${prefix}_structural`,
    nutrientPool: "available_nutrients",
    litterPool: "litter",
    substratePool: "substrate",
    mobileWaterPool: `${prefix}_water`,

    relativeLight: value(p.relativeLight),
    lightHalfSaturation: value(p.lightHalfSaturation),
    temperatureOptimumC: value(p.temperatureOptimumC),
    temperatureSigmaC: value(p.temperatureSigmaC),
    maxPhotosynthesisCarbonMgPerSecond:
      value(p.maxPhotosynthesisCarbonMgPerSecond),
    structuralGrowthRatePerSecond:
      value(p.structuralGrowthRatePerSecond),
    nitrogenMgPerCarbonMg:
      value(plantFixture.shared.nitrogenMgPerCarbonMg),
    phosphorusMgPerCarbonMg:
      value(plantFixture.shared.phosphorusMgPerCarbonMg),
    senescenceRatePerSecond: value(p.senescenceRatePerSecond),

    targetWaterGPerStructuralCarbonMg:
      value(p.targetWaterGPerStructuralCarbonMg),
    rootWaterUptakeRatePerSecond:
      value(p.rootWaterUptakeRatePerSecond),
    transpirationRatePerSecond: value(p.transpirationRatePerSecond),
    waterStressHalfSaturation: value(p.waterStressHalfSaturation),
    maintenanceRespirationCarbonPerStructuralCarbonPerSecond:
      value(p.maintenanceRespirationCarbonPerStructuralCarbonPerSecond),
    photosynthesisReferenceStructuralCarbonMg: 100
  });
}

function clonalParameters(
  speciesId: "fittonia_albivenis" | "peperomia_caperata" | "pilea_depressa",
  prefix: "fittonia" | "peperomia" | "pilea"
): PlantClonalParameters {
  const p = integratedFixture.plants[speciesId];
  return {
    structuralPool: `${prefix}_structural`,
    reservePool: `${prefix}_reserve`,
    waterPool: `${prefix}_water`,
    litterPool: "litter",
    substratePool: "substrate",
    maturityDays: p.maturityDays,
    cloneIntervalDays: p.cloneIntervalDays,
    cloneFraction: p.cloneFraction,
    minimumStructuralCarbonMgForClone:
      p.minimumStructuralCarbonMgForClone,
    rametLifespanDays: p.rametLifespanDays
  };
}

function decomposer(
  litterPool: string,
  bufferPool: string,
  multiplier: number,
  turnover: number
): MicrobialDecomposerSystem {
  const p = plantFixture.decomposer;
  return new MicrobialDecomposerSystem({
    litterPool,
    bufferPool,
    fungusPool: "linnemannia_biomass",
    bacteriaPool: "bacillus_biomass",
    atmospherePool: "atmosphere",
    nutrientPool: "available_nutrients",
    substratePool: "substrate",
    decompositionRatePerSecond:
      value(p.decompositionRatePerSecond) * multiplier,
    carbonUseEfficiency: value(p.carbonUseEfficiency),
    fungalShare: value(p.fungalShare),
    microbialTurnoverRatePerSecond: turnover,
    moisturePool: "substrate",
    moistureHalfSaturationWaterG:
      value(p.moistureHalfSaturationWaterG),
    temperatureOptimumC: value(p.temperatureOptimumC),
    temperatureSigmaC: value(p.temperatureSigmaC)
  });
}

function folsomiaParameters(): FolsomiaParameters {
  const p = folsomiaFixture.parameters;
  return {
    biomassPool: "folsomia_biomass",
    feedBufferPool: "folsomia_feed_buffer",
    foodPools: ["linnemannia_biomass", "bacillus_biomass"],
    litterPool: "litter",
    corpsePool: "animal_corpses",
    atmospherePool: "atmosphere",
    substratePool: "substrate",

    temperatureOptimumC: value(p.temperatureOptimumC),
    temperatureSigmaC: value(p.temperatureSigmaC),
    eggDevelopmentDays: value(p.eggDevelopmentDays),
    adultDevelopmentDays: value(p.adultDevelopmentDays),
    reproductionIntervalDays: value(p.reproductionIntervalDays),
    clutchSize: value(p.clutchSize),
    adultLifespanDays: value(p.adultLifespanDays),
    feedingCarbonRateMgPerSecond: value(p.feedingCarbonRateMgPerSecond),
    assimilationEfficiency: value(p.assimilationEfficiency),
    reserveTargetFraction: value(p.reserveTargetFraction),
    reproductionReserveFraction: value(p.reproductionReserveFraction),
    basalMetabolismCarbonMgPerSecond:
      value(p.basalMetabolismCarbonMgPerSecond),
    starvationDeathDays: value(p.starvationDeathDays),
    moistureHalfSaturationWaterG: value(p.moistureHalfSaturationWaterG),
    reproductionMoistureThreshold: value(p.reproductionMoistureThreshold),
    desiccationRatePerSecond: value(p.desiccationRatePerSecond),
    hydrationRatePerSecond: value(p.hydrationRatePerSecond),
    adultBodyWaterG: value(p.adultBodyWaterG),
    adultCarbonTargetMg: value(p.adultCarbonMg),
    maturationCarbonFractionOfAdult: value(p.maturationCarbonFractionOfAdult),
    eggCarbonMg: value(p.eggCarbonMg)
  };
}

function trichorhinaParameters(): TrichorhinaParameters {
  const p = trichorhinaFixture.parameters;
  return {
    biomassPool: "trichorhina_biomass",
    feedBufferPool: "trichorhina_feed_buffer",
    coarseLitterPool: "litter",
    fineDetritusPool: "fine_detritus",
    fungusPool: "linnemannia_biomass",
    atmospherePool: "atmosphere",
    substratePool: "substrate",
    corpsePool: "animal_corpses",

    temperatureOptimumC: value(p.temperatureOptimumC),
    temperatureSigmaC: value(p.temperatureSigmaC),
    mancaDevelopmentDays: value(p.mancaDevelopmentDays),
    adultDevelopmentDays: value(p.adultDevelopmentDays),
    broodIntervalDays: value(p.broodIntervalDays),
    broodSize: value(p.broodSize),
    adultLifespanDays: value(p.adultLifespanDays),
    feedingCarbonRateMgPerSecond: value(p.feedingCarbonRateMgPerSecond),
    assimilationEfficiency: value(p.assimilationEfficiency),
    reserveTargetFraction: value(p.reserveTargetFraction),
    reproductionReserveFraction: value(p.reproductionReserveFraction),
    basalMetabolismCarbonMgPerSecond:
      value(p.basalMetabolismCarbonMgPerSecond),
    moistureHalfSaturationWaterG:
      value(p.moistureHalfSaturationWaterG),
    reproductionMoistureThreshold:
      value(p.reproductionMoistureThreshold),
    desiccationRatePerSecond: value(p.desiccationRatePerSecond),
    hydrationRatePerSecond: value(p.hydrationRatePerSecond),
    adultCarbonTargetMg: value(p.adultCarbonMg),
    maturationCarbonFractionOfAdult: value(p.maturationCarbonFractionOfAdult),
    adultBodyWaterG: value(p.adultBodyWaterG),
    mancaCarbonMg: value(p.mancaCarbonMg)
  };
}

function bradysiaParameters(): BradysiaParameters {
  const p = bradysiaFixture.parameters;
  return {
    biomassPool: "bradysia_biomass",
    feedBufferPool: "bradysia_feed_buffer",
    fungusPool: "linnemannia_biomass",
    rootTissuePools: [
      "fittonia_structural",
      "peperomia_structural",
      "pilea_structural"
    ],
    litterPool: "litter",
    atmospherePool: "atmosphere",
    substratePool: "substrate",
    corpsePool: "animal_corpses",

    referenceTemperatureC: value(p.referenceTemperatureC),
    temperatureSigmaC: value(p.temperatureSigmaC),
    eggDevelopmentDays: value(p.eggDevelopmentDays),
    larvalDevelopmentDays: value(p.larvalDevelopmentDays),
    pupalDevelopmentDays: value(p.pupalDevelopmentDays),
    adultLifespanDays: value(p.adultLifespanDays),
    preOvipositionHours: value(p.preOvipositionHours),
    fecundityEggsPerFemale: value(p.fecundityEggsPerFemale),
    femaleProbability: value(p.femaleProbability),
    immatureSurvivalProbability: value(p.immatureSurvivalProbability),
    larvalFeedingCarbonMgPerSecond:
      value(p.larvalFeedingCarbonMgPerSecond),
    assimilationEfficiency: value(p.assimilationEfficiency),
    fungusPreference: value(p.fungusPreference),
    basalMetabolismCarbonMgPerSecond:
      value(p.basalMetabolismCarbonMgPerSecond),
    adultFlightMetabolismMultiplier:
      value(p.adultFlightMetabolismMultiplier),
    adultCarbonTargetMg: value(p.adultCarbonTargetMg),
    pupationCarbonFractionOfAdult: value(p.pupationCarbonFractionOfAdult),
    eggCarbonMg: value(p.eggCarbonMg),
    adultBodyWaterG: value(p.adultBodyWaterG),
    moistureHalfSaturationWaterG:
      value(p.moistureHalfSaturationWaterG),
    ovipositionMoistureThreshold:
      value(p.ovipositionMoistureThreshold)
  };
}

function dalotiaParameters(): DalotiaParameters {
  const p = dalotiaFixture.parameters;
  return {
    biomassPool: "dalotia_biomass",
    feedBufferPool: "dalotia_feed_buffer",
    litterPool: "litter",
    atmospherePool: "atmosphere",
    substratePool: "substrate",
    corpsePool: "animal_corpses",
    bradysiaBiomassPool: "bradysia_biomass",
    folsomiaBiomassPool: "folsomia_biomass",

    referenceTemperatureC: value(p.referenceTemperatureC),
    temperatureSigmaC: value(p.temperatureSigmaC),
    eggDevelopmentDays: value(p.eggDevelopmentDays),
    larvalDevelopmentDays: value(p.larvalDevelopmentDays),
    pupalDevelopmentDays: value(p.pupalDevelopmentDays),
    femaleAdultLifespanDays: value(p.femaleAdultLifespanDays),
    maleAdultLifespanDays: value(p.maleAdultLifespanDays),
    femaleProbability: value(p.femaleProbability),
    immatureSurvivalProbability: value(p.immatureSurvivalProbability),
    lifetimeFecundity: value(p.lifetimeFecundity),
    reproductivePeriodDays: value(p.reproductivePeriodDays),
    preOvipositionDays: value(p.preOvipositionDays),
    maxAdultPreyPerDay: value(p.maxAdultPreyPerDay),
    maxLarvalPreyPerDay: value(p.maxLarvalPreyPerDay),
    preyHalfSaturationCount: value(p.preyHalfSaturationCount),
    captureProbability: value(p.captureProbability),
    assimilationEfficiency: value(p.assimilationEfficiency),
    reserveTargetFraction: value(p.reserveTargetFraction),
    basalMetabolismCarbonMgPerSecond:
      value(p.basalMetabolismCarbonMgPerSecond),
    adultCarbonTargetMg: value(p.adultCarbonTargetMg),
    pupationCarbonFractionOfAdult: value(p.pupationCarbonFractionOfAdult),
    reproductionReserveFraction: value(p.reproductionReserveFraction),
    eggCarbonMg: value(p.eggCarbonMg),
    adultBodyWaterG: value(p.adultBodyWaterG),
    moistureHalfSaturationWaterG:
      value(p.moistureHalfSaturationWaterG),
    reproductionMoistureThreshold:
      value(p.reproductionMoistureThreshold),
    starvationDeathDays: value(p.starvationDeathDays),
    desiccationRatePerSecond: value(p.desiccationRatePerSecond),
    hydrationRatePerSecond: value(p.hydrationRatePerSecond)
  };
}

export interface IntegratedEcosystem {
  world: WorldState;
  scheduler: FixedStepScheduler;
  invariants: InvariantMonitor;
  habitat: SpatialHabitat;
  plants: {
    fittonia: PlantRametPopulation;
    peperomia: PlantRametPopulation;
    pilea: PlantRametPopulation;
  };
  animals: {
    folsomia: ReturnType<typeof seedFolsomiaJuveniles>;
    trichorhina: ReturnType<typeof seedTrichorhinaJuveniles>;
    bradysia: BradysiaPopulation;
    dalotia: DalotiaPopulation;
  };
}

export function createIntegratedEcosystem(seed = integratedFixture.seed): IntegratedEcosystem {
  const plantPools = structuredClone(plantFixture.initialPools);
  Object.assign(plantPools, {
    fine_detritus: { carbonMg: 0, nitrogenMg: 0, phosphorusMg: 0, waterG: 0 },
    fine_decomposition_buffer: { carbonMg: 0, nitrogenMg: 0, phosphorusMg: 0, waterG: 0 },
    corpse_decomposition_buffer: { carbonMg: 0, nitrogenMg: 0, phosphorusMg: 0, waterG: 0 },
    animal_corpses: { carbonMg: 0, nitrogenMg: 0, phosphorusMg: 0, waterG: 0 },

    folsomia_biomass: { carbonMg: 0, nitrogenMg: 0, phosphorusMg: 0, waterG: 0 },
    folsomia_feed_buffer: { carbonMg: 0, nitrogenMg: 0, phosphorusMg: 0, waterG: 0 },
    trichorhina_biomass: { carbonMg: 0, nitrogenMg: 0, phosphorusMg: 0, waterG: 0 },
    trichorhina_feed_buffer: { carbonMg: 0, nitrogenMg: 0, phosphorusMg: 0, waterG: 0 },
    bradysia_biomass: { carbonMg: 0, nitrogenMg: 0, phosphorusMg: 0, waterG: 0 },
    bradysia_feed_buffer: { carbonMg: 0, nitrogenMg: 0, phosphorusMg: 0, waterG: 0 },
    dalotia_biomass: { carbonMg: 0, nitrogenMg: 0, phosphorusMg: 0, waterG: 0 },
    dalotia_feed_buffer: { carbonMg: 0, nitrogenMg: 0, phosphorusMg: 0, waterG: 0 }
  });

  const folsomia = seedFolsomiaJuveniles({
    count: integratedFixture.initialAnimals.folsomiaJuveniles,
    ageDays: 12,
    carbonMg: value(folsomiaFixture.parameters.initialJuvenileCarbonMg),
    reserveCarbonMg: value(folsomiaFixture.parameters.initialReserveCarbonMg),
    nitrogenPerCarbon: value(folsomiaFixture.parameters.nitrogenPerCarbon),
    phosphorusPerCarbon: value(folsomiaFixture.parameters.phosphorusPerCarbon),
    bodyWaterG: value(folsomiaFixture.parameters.adultBodyWaterG)
  });

  const trichorhina = seedTrichorhinaJuveniles({
    count: integratedFixture.initialAnimals.trichorhinaJuveniles,
    ageDays: 50,
    carbonMg: value(trichorhinaFixture.parameters.initialJuvenileCarbonMg),
    reserveCarbonMg: value(trichorhinaFixture.parameters.initialReserveCarbonMg),
    nitrogenPerCarbon: value(trichorhinaFixture.parameters.nitrogenPerCarbon),
    phosphorusPerCarbon: value(trichorhinaFixture.parameters.phosphorusPerCarbon),
    adultBodyWaterG: value(trichorhinaFixture.parameters.adultBodyWaterG)
  });

  const bradysia = seedBradysiaLarvae({
    count: integratedFixture.initialAnimals.bradysiaLarvae,
    ageDays: 2,
    carbonMg: value(bradysiaFixture.parameters.initialLarvaCarbonMg),
    reserveCarbonMg: value(bradysiaFixture.parameters.initialReserveCarbonMg),
    nitrogenPerCarbon: value(bradysiaFixture.parameters.nitrogenPerCarbon),
    phosphorusPerCarbon: value(bradysiaFixture.parameters.phosphorusPerCarbon),
    adultBodyWaterG: value(bradysiaFixture.parameters.adultBodyWaterG)
  });
  if (integratedFixture.initialAnimals.bradysiaAdultPair) {
    addBradysiaAdultPair(bradysia);
  }

  const dalotia = createDalotiaAdultPair();

  plantPools.folsomia_biomass = folsomia.totalLivingMaterial();
  plantPools.trichorhina_biomass = trichorhina.totalLivingMaterial();
  plantPools.bradysia_biomass = bradysia.totalLivingMaterial();
  plantPools.dalotia_biomass = dalotia.totalLivingMaterial();

  const world = new WorldState(
    {
      seed,
      fixedDtSeconds: integratedFixture.fixedDtSeconds,
      roomTemperatureC: integratedFixture.temperatureC
    },
    new MassLedger(plantPools),
    {
      temperatureC: new ScalarGrid3D(4, 3, 4, integratedFixture.temperatureC)
    },
    new DeterministicRng(seed)
  );

  const fittonia = createPlantPopulation(
    integratedFixture.plants.fittonia_albivenis.initialAgesDays
  );
  const peperomia = createPlantPopulation(
    integratedFixture.plants.peperomia_caperata.initialAgesDays
  );
  const pilea = createPlantPopulation(
    integratedFixture.plants.pilea_depressa.initialAgesDays
  );

  const habitat = new SpatialHabitat(
    integratedFixture.spatial.widthCells,
    integratedFixture.spatial.depthCells
  );
  const movement = integratedFixture.spatial.movementRatesPerSecond;

  const systems = [
    new TemperatureBoundarySystem(0.000005),
    new TemperatureDiffusionSystem(0.00005),
    new WaterCycleSystem({
      infiltrationPerSecond: 0.00002,
      evaporationPerSecond: 0.000001,
      condensationPerSecond: 0.0000005
    }),

    plantPhysiology("fittonia_albivenis", "fittonia"),
    new PlantClonalLineageSystem(
      fittonia,
      clonalParameters("fittonia_albivenis", "fittonia")
    ),
    plantPhysiology("peperomia_caperata", "peperomia"),
    new PlantClonalLineageSystem(
      peperomia,
      clonalParameters("peperomia_caperata", "peperomia")
    ),
    plantPhysiology("pilea_depressa", "pilea"),
    new PlantClonalLineageSystem(
      pilea,
      clonalParameters("pilea_depressa", "pilea")
    ),

    decomposer(
      "litter",
      "decomposition_buffer",
      1,
      value(plantFixture.decomposer.microbialTurnoverRatePerSecond)
    ),
    decomposer(
      "fine_detritus",
      "fine_decomposition_buffer",
      integratedFixture.decomposition.fineDetritusRateMultiplier,
      0
    ),
    decomposer(
      "animal_corpses",
      "corpse_decomposition_buffer",
      integratedFixture.decomposition.corpseRateMultiplier,
      0
    ),

    new FolsomiaLifecycleSystem(folsomia, folsomiaParameters()),
    new TrichorhinaDetritivoreSystem(
      trichorhina,
      trichorhinaParameters()
    ),
    new BradysiaLifecycleSystem(
      bradysia,
      bradysiaParameters(),
      habitat,
      integratedFixture.spatial.bradysiaMatingRadiusCells
    ),

    new SpatialEcologySystem(
      habitat,
      { folsomia, trichorhina, bradysia, dalotia },
      {
        folsomiaPerSecond: movement.folsomia,
        trichorhinaPerSecond: movement.trichorhina,
        bradysiaLarvaPerSecond: movement.bradysiaLarva,
        bradysiaAdultPerSecond: movement.bradysiaAdult,
        dalotiaLarvaPerSecond: movement.dalotiaLarva,
        dalotiaAdultPerSecond: movement.dalotiaAdult
      }
    ),

    new DalotiaPredatorSystem(
      dalotia,
      { bradysia, folsomia },
      dalotiaParameters(),
      habitat,
      integratedFixture.spatial.dalotiaMatingRadiusCells
    )
  ];

  const scheduler = new FixedStepScheduler(world, systems);
  return {
    world,
    scheduler,
    invariants: new InvariantMonitor(world, {
      absoluteTolerance: integratedFixture.numerics.invariantAbsoluteTolerance,
      relativeTolerance: integratedFixture.numerics.invariantRelativeTolerance
    }),
    habitat,
    plants: { fittonia, peperomia, pilea },
    animals: { folsomia, trichorhina, bradysia, dalotia }
  };
}

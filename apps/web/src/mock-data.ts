import type { ObservationSnapshot } from "./contracts.js";

const hour = 3600;
const day = 24 * hour;

export const mockObservationSnapshot: ObservationSnapshot = {
  species: [
    { id: "fittonia", commonName: "Nerve plant", scientificName: "Fittonia albivenis", category: "plant", trophicRole: "producer" },
    { id: "peperomia", commonName: "Emerald ripple peperomia", scientificName: "Peperomia caperata", category: "plant", trophicRole: "producer" },
    { id: "pilea", commonName: "Depressed clearweed", scientificName: "Pilea depressa", category: "plant", trophicRole: "producer" },
    { id: "folsomia", commonName: "Springtail", scientificName: "Folsomia candida", category: "animal", trophicRole: "fungivore" },
    { id: "trichorhina", commonName: "Dwarf white isopod", scientificName: "Trichorhina tomentosa", category: "animal", trophicRole: "detritivore" },
    { id: "bradysia", commonName: "Dark-winged fungus gnat", scientificName: "Bradysia impatiens", category: "animal", trophicRole: "fungivore" },
    { id: "dalotia", commonName: "Rove beetle", scientificName: "Dalotia coriaria", category: "animal", trophicRole: "predator" },
    { id: "linnemannia", commonName: "Soil fungus", scientificName: "Linnemannia elongata", category: "fungus", trophicRole: "decomposer" },
    { id: "bacillus", commonName: "Soil bacterium", scientificName: "Bacillus subtilis", category: "bacterium", trophicRole: "decomposer" }
  ],
  entities: [
    {
      kind: "animal",
      id: 1042,
      speciesId: "folsomia",
      commonName: "Springtail",
      scientificName: "Folsomia candida",
      lifeStage: "adult",
      ageSeconds: 18.6 * day,
      biomassMg: 0.23,
      reserveEnergy: 0.74,
      hydration: 0.91,
      currentAction: "FORAGE",
      currentTarget: "fungal patch #18",
      birthTimeSeconds: 42.4 * day,
      parentIds: [781],
      offspringCount: 6
    },
    {
      kind: "animal",
      id: 2007,
      speciesId: "dalotia",
      commonName: "Rove beetle",
      scientificName: "Dalotia coriaria",
      lifeStage: "adult",
      ageSeconds: 34.2 * day,
      biomassMg: 6.8,
      reserveEnergy: 0.56,
      hydration: 0.84,
      currentAction: "HUNT",
      currentTarget: "Bradysia larva #3098",
      birthTimeSeconds: 26.8 * day,
      parentIds: [1603, 1604],
      offspringCount: 3
    },
    {
      kind: "plant",
      id: 501,
      speciesId: "fittonia",
      commonName: "Nerve plant",
      scientificName: "Fittonia albivenis",
      lifeStage: "ramet",
      rametAgeSeconds: 73 * day,
      biomassMg: 4860,
      waterStatus: 0.88,
      nutrientLimitation: "nitrogen",
      parentRametId: 412,
      offspringRametIds: [544, 566]
    }
  ],
  environment: {
    timeSeconds: 61 * day + 13.4 * hour,
    temperatureC: 24.8,
    relativeHumidity: 0.91,
    soilWater: 0.72,
    lightPar: 186,
    co2Ppm: 612,
    o2Percent: 20.4,
    nh4MgKg: 8.1,
    no3MgKg: 14.4,
    availablePMgKg: 3.7,
    fungalBiomassMg: 944,
    bacterialBiomassMg: 1720,
    litterMg: 34800
  },
  populations: [
    {
      speciesId: "folsomia",
      label: "F. candida",
      points: [102, 108, 119, 126, 131, 138, 145, 151, 149, 158, 164, 171].map((value, i) => ({ timeSeconds: (50 + i) * day, value }))
    },
    {
      speciesId: "bradysia",
      label: "B. impatiens",
      points: [28, 32, 30, 36, 41, 39, 47, 45, 43, 51, 48, 55].map((value, i) => ({ timeSeconds: (50 + i) * day, value }))
    },
    {
      speciesId: "dalotia",
      label: "D. coriaria",
      points: [9, 9, 10, 10, 11, 12, 12, 13, 13, 14, 14, 15].map((value, i) => ({ timeSeconds: (50 + i) * day, value }))
    }
  ],
  genealogy: [
    { entityId: 781, label: "#781", lifeStage: "dead · adult", relation: "parent", alive: false },
    { entityId: 1042, label: "#1042", lifeStage: "adult", relation: "current", alive: true },
    { entityId: 1312, label: "#1312", lifeStage: "juvenile", relation: "offspring", alive: true },
    { entityId: 1321, label: "#1321", lifeStage: "juvenile", relation: "offspring", alive: true },
    { entityId: 1378, label: "#1378", lifeStage: "egg", relation: "offspring", alive: true }
  ],
  why: [
    { label: "HUNGRY", score: 0.82 },
    { label: "FOOD NEARBY", score: 0.67 },
    { label: "MOISTURE", score: 0.91 },
    { label: "PREDATOR RISK", score: 0.12 }
  ],
  foodWeb: [
    { sourceSpeciesId: "fittonia", targetSpeciesId: "linnemannia", biomassTransferMg: 73 },
    { sourceSpeciesId: "linnemannia", targetSpeciesId: "folsomia", biomassTransferMg: 48 },
    { sourceSpeciesId: "pilea", targetSpeciesId: "trichorhina", biomassTransferMg: 36 },
    { sourceSpeciesId: "folsomia", targetSpeciesId: "dalotia", biomassTransferMg: 18 },
    { sourceSpeciesId: "bradysia", targetSpeciesId: "dalotia", biomassTransferMg: 26 }
  ]
};

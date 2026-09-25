export interface Material {
  carbonMg: number;
  nitrogenMg: number;
  phosphorusMg: number;
  waterG: number;
}

export const MATERIAL_KEYS = [
  "carbonMg",
  "nitrogenMg",
  "phosphorusMg",
  "waterG"
] as const;

export type MaterialKey = (typeof MATERIAL_KEYS)[number];

export function zeroMaterial(): Material {
  return { carbonMg: 0, nitrogenMg: 0, phosphorusMg: 0, waterG: 0 };
}

export function cloneMaterial(value: Material): Material {
  return { ...value };
}

export function addMaterial(a: Material, b: Material): Material {
  return {
    carbonMg: a.carbonMg + b.carbonMg,
    nitrogenMg: a.nitrogenMg + b.nitrogenMg,
    phosphorusMg: a.phosphorusMg + b.phosphorusMg,
    waterG: a.waterG + b.waterG
  };
}

export function subtractMaterial(a: Material, b: Material): Material {
  return {
    carbonMg: a.carbonMg - b.carbonMg,
    nitrogenMg: a.nitrogenMg - b.nitrogenMg,
    phosphorusMg: a.phosphorusMg - b.phosphorusMg,
    waterG: a.waterG - b.waterG
  };
}

export function scaleMaterial(value: Material, factor: number): Material {
  return {
    carbonMg: value.carbonMg * factor,
    nitrogenMg: value.nitrogenMg * factor,
    phosphorusMg: value.phosphorusMg * factor,
    waterG: value.waterG * factor
  };
}

export function assertFiniteMaterial(value: Material, label = "material"): void {
  for (const key of MATERIAL_KEYS) {
    const current = value[key];
    if (!Number.isFinite(current)) {
      throw new Error(`${label}.${key} must be finite, received ${current}`);
    }
  }
}

export function assertNonNegativeMaterial(
  value: Material,
  label = "material",
  epsilon = 1e-12
): void {
  assertFiniteMaterial(value, label);
  for (const key of MATERIAL_KEYS) {
    if (value[key] < -epsilon) {
      throw new Error(`${label}.${key} must be non-negative, received ${value[key]}`);
    }
  }
}

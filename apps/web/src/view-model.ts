import type {
  EntitySummary,
  EnvironmentSnapshot,
  OverlayKey,
  UserAction,
  UserActionType
} from "./contracts.js";

export function createUserAction(
  type: UserActionType,
  payload: UserAction["payload"],
  nowMs = Date.now()
): UserAction {
  return {
    id: `ui-${nowMs}-${type.toLowerCase()}`,
    source: "USER_ACTION",
    type,
    createdAtUiMs: nowMs,
    status: "queued",
    payload
  };
}

export function formatAge(seconds: number): string {
  const days = seconds / 86_400;
  if (days < 1) return `${Math.max(1, Math.round(seconds / 3600))} h`;
  if (days < 60) return `${days.toFixed(days < 10 ? 1 : 0)} d`;
  return `${(days / 30.4375).toFixed(1)} mo`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function getEntityAgeSeconds(entity: EntitySummary): number {
  return entity.kind === "animal" ? entity.ageSeconds : entity.rametAgeSeconds;
}

export function getOverlayValue(
  environment: EnvironmentSnapshot,
  key: OverlayKey
): string {
  const optional = (value: number | null, suffix: string): string =>
    value === null ? "not modeled" : `${value.toFixed(1)} ${suffix}`;
  const values: Record<OverlayKey, string> = {
    temperature: `${environment.temperatureC.toFixed(1)} °C`,
    humidity: `${Math.round(environment.relativeHumidity * 100)}% RH · proxy`,
    soilWater: `${Math.round(environment.soilWater * 100)}%`,
    light: `${environment.lightPar.toFixed(0)} PAR · proxy`,
    co2: `${environment.co2Ppm.toFixed(0)} ppm · proxy`,
    o2: optional(environment.o2Percent, "%"),
    nh4: optional(environment.nh4MgKg, "mg/kg"),
    no3: optional(environment.no3MgKg, "mg/kg"),
    availableP: `${environment.availablePhosphorusMg.toFixed(2)} mg pool`,
    fungalBiomass: `${environment.fungalBiomassMg.toFixed(2)} mg C`,
    bacterialBiomass: `${environment.bacterialBiomassMg.toFixed(2)} mg C`,
    litter: `${environment.litterMg.toFixed(1)} mg C`
  };
  return values[key];
}

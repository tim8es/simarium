import { ScalarGrid3D } from "./grid.js";
import { MassLedger } from "./ledger.js";
import { DeterministicRng, type RngState } from "./rng.js";

export interface WorldConfig {
  seed: number;
  fixedDtSeconds: number;
  roomTemperatureC: number;
}

export interface EnvironmentState {
  temperatureC: ScalarGrid3D;
}

export class WorldState {
  constructor(
    readonly config: WorldConfig,
    readonly ledger: MassLedger,
    readonly environment: EnvironmentState,
    readonly rng: DeterministicRng,
    public timeSeconds = 0,
    public tick = 0
  ) {}
}

export interface Phase1WorldOptions {
  seed?: number;
  fixedDtSeconds?: number;
  roomTemperatureC?: number;
  grid?: readonly [number, number, number];
  rngState?: RngState;
}

export function createPhase1World(options: Phase1WorldOptions = {}): WorldState {
  const seed = options.seed ?? 1;
  const fixedDtSeconds = options.fixedDtSeconds ?? 60;
  const roomTemperatureC = options.roomTemperatureC ?? 24;
  const [width, height, depth] = options.grid ?? [4, 3, 4];

  const temperatureC = new ScalarGrid3D(width, height, depth, roomTemperatureC);
  temperatureC.set(
    Math.floor(width / 2),
    Math.floor(height / 2),
    Math.floor(depth / 2),
    roomTemperatureC + 4
  );

  const ledger = new MassLedger({
    atmosphere: { carbonMg: 5000, nitrogenMg: 0, phosphorusMg: 0, waterG: 50 },
    substrate: { carbonMg: 100000, nitrogenMg: 1000, phosphorusMg: 200, waterG: 50000 },
    surface_water: { carbonMg: 0, nitrogenMg: 0, phosphorusMg: 0, waterG: 5000 }
  });

  return new WorldState(
    { seed, fixedDtSeconds, roomTemperatureC },
    ledger,
    { temperatureC },
    new DeterministicRng(seed, options.rngState)
  );
}

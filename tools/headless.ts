import { createHash } from "node:crypto";
import {
  FixedStepScheduler,
  InvariantMonitor,
  TemperatureBoundarySystem,
  TemperatureDiffusionSystem,
  WaterCycleSystem,
  createPhase1World,
  serializeWorld
} from "../packages/sim-core/src/index.js";

function readNumberArg(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const raw = process.argv[index + 1];
  const value = Number(raw);
  if (!raw || !Number.isFinite(value)) {
    throw new Error(`--${name} requires a finite number`);
  }
  return value;
}

const days = readNumberArg("days", 365);
const dt = readNumberArg("dt", 60);
const seed = readNumberArg("seed", 1);

if (days <= 0 || dt <= 0 || !Number.isInteger(seed)) {
  throw new Error("days/dt must be positive and seed must be an integer");
}

const durationSeconds = days * 86400;
const steps = durationSeconds / dt;
if (!Number.isInteger(steps)) {
  throw new Error("Requested duration must be exactly divisible by dt");
}

const world = createPhase1World({ seed, fixedDtSeconds: dt });
const scheduler = new FixedStepScheduler(world, [
  new TemperatureBoundarySystem(0.00001),
  new TemperatureDiffusionSystem(0.0005),
  new WaterCycleSystem({
    infiltrationPerSecond: 0.00002,
    evaporationPerSecond: 0.000005,
    condensationPerSecond: 0.000002
  })
]);
const invariants = new InvariantMonitor(world);

const chunkSize = 10_000;
let remaining = steps;
while (remaining > 0) {
  const chunk = Math.min(chunkSize, remaining);
  scheduler.step(chunk);
  invariants.check(world);
  remaining -= chunk;
}

const snapshot = serializeWorld(world);
const stateHash = createHash("sha256").update(snapshot).digest("hex");

process.stdout.write(
  JSON.stringify(
    {
      phase: 1,
      days,
      dt,
      seed,
      ticks: world.tick,
      timeSeconds: world.timeSeconds,
      materialTotals: world.ledger.totals(),
      pools: world.ledger.snapshot().pools,
      temperatureC: {
        min: world.environment.temperatureC.min(),
        mean: world.environment.temperatureC.mean(),
        max: world.environment.temperatureC.max()
      },
      stateHash,
      invariantStatus: "PASS"
    },
    null,
    2
  ) + "\n"
);

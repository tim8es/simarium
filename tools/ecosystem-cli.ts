import { parseSeedSpec } from "./ecosystem-report.js";

export type EcosystemOutputFormat = "json" | "csv";

export interface BatchCliOptions {
  days: number;
  seeds: number[];
  sampleEveryDays: number;
  format: EcosystemOutputFormat;
}

function positiveInteger(raw: string | undefined, name: string): number {
  if (raw === undefined) throw new Error(`${name} requires a value`);
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export function parseBatchCliArgs(argv: string[]): BatchCliOptions {
  const result: BatchCliOptions = {
    days: 30,
    seeds: parseSeedSpec("0:10"),
    sampleEveryDays: 5,
    format: "json"
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--days") {
      result.days = positiveInteger(argv[++i], "--days");
      continue;
    }
    if (arg === "--seeds") {
      const value = argv[++i];
      if (value === undefined) throw new Error("--seeds requires a value");
      result.seeds = parseSeedSpec(value);
      continue;
    }
    if (arg === "--sample") {
      result.sampleEveryDays = positiveInteger(argv[++i], "--sample");
      continue;
    }
    if (arg === "--format") {
      const value = argv[++i];
      if (value !== "json" && value !== "csv") {
        throw new Error("--format must be json or csv");
      }
      result.format = value;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return result;
}
